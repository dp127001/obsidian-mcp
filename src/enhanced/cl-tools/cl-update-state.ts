import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { createToolResponse } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";
import { CLErrorFactory } from "../../utils/errors.js";
import { AtomicFilesystemInterface } from "../filesystem/interface.js";
import { CLStateDatabase } from "../cl-state/database.js";
import { promises as fs } from "fs";
import path from "path";

// State update schema with verification options
const clUpdateStateSchema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault containing the note"),
  path: z.string()
    .min(1, "Note path cannot be empty")
    .describe("Path to the note within the vault"),
  new_state: z.enum(['plasma', 'fluid', 'gel', 'crystal'])
    .describe("New CL state for the note"),
  reason: z.string()
    .min(1, "Reason for state change cannot be empty")
    .describe("Explanation for why the state is being changed"),
  confidence: z.enum(['low', 'medium', 'high']).optional()
    .describe("Optional: Update confidence level along with state"),
  verify_update: z.boolean()
    .default(false)
    .describe("Whether to verify the state update was successful (adds ~100ms)")
}).strict();

interface StateUpdateResult {
  success: boolean;
  message: string;
  previous_state?: string;
  new_state: string;
  processing_time_ms: number;
  verification?: {
    matches: boolean;
    expected: string;
    actual: string;
  };
  indexed_in_sqlite?: boolean;
}

// Validate state transition according to CL methodology rules
async function validateStateTransition(
  currentState: string,
  newState: string,
  reason: string,
  confidence?: string
): Promise<void> {
  // Crystal promotion validation
  if (newState === 'crystal') {
    if (confidence !== 'high') {
      throw CLErrorFactory.stateTransitionError(currentState, newState, reason, confidence);
    }
    
    // Additional validation for crystal state
    if (reason.length < 20) {
      throw CLErrorFactory.stateTransitionError(
        currentState,
        newState,
        'insufficient justification for crystal authority',
        confidence
      );
    }
  }
  
  // Validate problematic transitions
  const problematicTransitions = ['plasma→crystal', 'fluid→crystal'];
  const transition = `${currentState}→${newState}`;
  
  if (problematicTransitions.includes(transition) && reason.length < 20) {
    throw CLErrorFactory.stateTransitionError(currentState, newState, reason, confidence);
  }
  
  // Crystal demotion validation
  if (currentState === 'crystal' && newState !== 'plasma') {
    if (reason.length < 30) {
      throw CLErrorFactory.stateTransitionError(
        currentState,
        newState,
        'insufficient justification for crystal authority demotion',
        confidence
      );
    }
  }
}

// Extract current state from frontmatter
function extractCurrentState(content: string): { state?: string; confidence?: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};
  
  const frontmatter = frontmatterMatch[1];
  const state = frontmatter.match(/state:\s*([^\n]+)/)?.[1]?.trim().replace(/['"]/g, '');
  const confidence = frontmatter.match(/confidence:\s*([^\n]+)/)?.[1]?.trim().replace(/['"]/g, '');
  
  return { state, confidence };
}

// Update frontmatter with new state and modified timestamp
function updateFrontmatterState(
  content: string, 
  newState: string, 
  reason: string, 
  newConfidence?: string
): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n(.*)$/s);
  if (!frontmatterMatch) {
    throw new Error("Note does not have valid frontmatter");
  }
  
  let frontmatter = frontmatterMatch[1];
  const bodyContent = frontmatterMatch[2];
  const now = new Date().toISOString();
  
  // Update state
  if (frontmatter.includes('state:')) {
    frontmatter = frontmatter.replace(/state:\s*[^\n]+/, `state: ${newState}`);
  } else {
    frontmatter += `\nstate: ${newState}`;
  }
  
  // Update confidence if provided
  if (newConfidence) {
    if (frontmatter.includes('confidence:')) {
      frontmatter = frontmatter.replace(/confidence:\s*[^\n]+/, `confidence: ${newConfidence}`);
    } else {
      frontmatter += `\nconfidence: ${newConfidence}`;
    }
  }
  
  // Update modified timestamp
  if (frontmatter.includes('modified:')) {
    frontmatter = frontmatter.replace(/modified:\s*[^\n]+/, `modified: ${now}`);
  } else {
    frontmatter += `\nmodified: ${now}`;
  }
  
  // Add state history entry
  const historyEntry = {
    from: extractCurrentState(frontmatterMatch[0]).state,
    to: newState,
    timestamp: now,
    reason: reason,
    confidence: newConfidence
  };
  
  // Add to state_history if it exists, otherwise create it
  if (frontmatter.includes('state_history:')) {
    // For simplicity, append as a new entry (would need proper YAML parsing for full implementation)
    frontmatter += `\n  - from: ${historyEntry.from}\n    to: ${historyEntry.to}\n    timestamp: ${historyEntry.timestamp}\n    reason: "${historyEntry.reason}"${newConfidence ? `\n    confidence: ${newConfidence}` : ''}`;
  } else {
    frontmatter += `\nstate_history:\n  - from: ${historyEntry.from}\n    to: ${historyEntry.to}\n    timestamp: ${historyEntry.timestamp}\n    reason: "${historyEntry.reason}"${newConfidence ? `\n    confidence: ${newConfidence}` : ''}`;
  }
  
  return `---\n${frontmatter}\n---\n${bodyContent}`;
}

// Verify state update by reading the file back
async function verifyStateUpdate(
  vaultPath: string,
  notePath: string,
  expectedState: string
): Promise<{ actualState: string; matches: boolean }> {
  try {
    const fullPath = path.join(vaultPath, notePath);
    const content = await fs.readFile(fullPath, 'utf8');
    const { state } = extractCurrentState(content);
    
    return {
      actualState: state || 'unknown',
      matches: state === expectedState
    };
  } catch (error) {
    return {
      actualState: 'error',
      matches: false
    };
  }
}

async function clUpdateState(
  args: z.infer<typeof clUpdateStateSchema>,
  vaultPath: string,
  vaultName: string
): Promise<StateUpdateResult> {
  const startTime = performance.now();
  
  try {
    const fullPath = path.join(vaultPath, args.path);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      throw CLErrorFactory.noteNotFoundError(args.path, vaultName);
    }
    
    // Read current content
    const currentContent = await fs.readFile(fullPath, 'utf8');
    const { state: previousState } = extractCurrentState(currentContent);
    
    if (!previousState) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Cannot update state: note does not have CL frontmatter with state. ' +
        'CL Methodology requires complete metadata for proper knowledge state tracking and graph building. ' +
        'Remediation: Add CL frontmatter using cl_create_note for new notes, or manually add frontmatter with state field. ' +
        'CL methodology requires state field for proper knowledge tracking. ' +
        'Examples: state: "fluid" (exploration), state: "gel" (working conclusion), state: "crystal" (authoritative decision).'
      );
    }
    
    // Validate state transition with enhanced error handling
    await validateStateTransition(previousState, args.new_state, args.reason, args.confidence);
    
    // Update content with new state
    const updatedContent = updateFrontmatterState(
      currentContent,
      args.new_state,
      args.reason,
      args.confidence
    );
    
    // Use atomic filesystem interface for update
    const fsInterface = new AtomicFilesystemInterface(vaultPath);
    await fsInterface.writeNoteAtomic(args.path, updatedContent);
    
    // Update SQLite index
    let indexedInSqlite = false;
    try {
      const clDatabase = new CLStateDatabase(vaultPath);
      const titleMatch = currentContent.match(/title:\s*([^\n]+)/)?.[1]?.trim().replace(/['"]/g, '');
      
      clDatabase.indexNote(args.path, {
        title: titleMatch || path.basename(args.path, '.md'),
        state: args.new_state,
        confidence: args.confidence || extractCurrentState(updatedContent).confidence || 'medium',
        modified: new Date().toISOString()
      });
      indexedInSqlite = true;
    } catch (indexError) {
      console.warn(`State updated but SQLite indexing failed for ${args.path}:`, indexError);
    }
    
    // Verification if requested
    let verification;
    if (args.verify_update) {
      // Small delay to ensure filesystem consistency
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const verifyResult = await verifyStateUpdate(vaultPath, args.path, args.new_state);
      verification = {
        matches: verifyResult.matches,
        expected: args.new_state,
        actual: verifyResult.actualState
      };
    }
    
    return {
      success: true,
      message: `State updated from ${previousState} to ${args.new_state}`,
      previous_state: previousState,
      new_state: args.new_state,
      processing_time_ms: performance.now() - startTime,
      verification,
      indexed_in_sqlite: indexedInSqlite
    };
    
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    return {
      success: false,
      message: `State update failed: ${error instanceof Error ? error.message : String(error)}`,
      new_state: args.new_state,
      processing_time_ms: performance.now() - startTime
    };
  }
}

type CLUpdateStateArgs = z.infer<typeof clUpdateStateSchema>;

export function createCLUpdateStateTool(vaults: Map<string, string>) {
  return createTool<CLUpdateStateArgs>({
    name: "cl_update_state",
    description: `Update the CL methodology state of an existing note with atomic operations and verification.

State transitions in CL methodology:
- fluid → gel: Sufficient evidence for working conclusion
- gel → crystal: High evidence standard met, formal validation complete  
- crystal → plasma: Contradicting evidence emerges that refutes decision
- any → fluid: Return to exploration when uncertainty increases

Features:
- Atomic filesystem operations prevent corruption during updates
- Automatic state history tracking with timestamps and reasons
- Optional verification loop to confirm update success
- Immediate SQLite index updates for fast future searches
- Preserves existing frontmatter while updating CL fields
- Updates modified timestamp automatically

Verification:
- When verify_update=true, reads the file back to confirm state change
- Adds ~50-100ms processing time but provides reliability guarantee
- Returns verification.matches indicating success/failure of update

Examples:
- Promote to gel: { "vault": "work", "path": "analysis/competitor-review.md", "new_state": "gel", "reason": "Analysis complete with working conclusions" }
- Crystallize decision: { "vault": "personal", "path": "decisions/home-security.md", "new_state": "crystal", "reason": "Decision finalized after research and vendor selection", "verify_update": true }
- Reject approach: { "vault": "work", "path": "experiments/microservice-split.md", "new_state": "plasma", "reason": "Testing revealed performance degradation and complexity issues" }`,
    schema: clUpdateStateSchema,
    handler: async (args, vaultPath, vaultName) => {
      const result = await clUpdateState(args, vaultPath, vaultName);
      return createToolResponse(JSON.stringify(result, null, 2));
    }
  }, vaults);
}
