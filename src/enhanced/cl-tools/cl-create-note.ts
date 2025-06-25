import { z } from "zod";
import { FileOperationResult } from "../../types.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ensureMarkdownExtension, validateVaultPath } from "../../utils/path.js";
import { ensureDirectory, fileExists } from "../../utils/files.js";
import { handleFsError, CLErrorFactory } from "../../utils/errors.js";
import { createToolResponse, formatFileResult } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";
import { AtomicFilesystemInterface } from "../filesystem/interface.js";
import { CLStateDatabase } from "../cl-state/database.js";
import path from "path";

// Enhanced CL-specific schema with CL methodology fields
const clCreateNoteSchema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to create the note in"),
  path: z.string()
    .min(1, "Note path cannot be empty")
    .describe("Full path for the note within the vault (e.g., 'projects/my-note.md')"),
  title: z.string()
    .min(1, "Title cannot be empty")
    .describe("Note title for CL frontmatter"),
  content: z.string()
    .min(1, "Content cannot be empty")
    .describe("Note content in markdown format"),
  state: z.enum(['plasma', 'fluid', 'gel', 'crystal'])
    .default('fluid')
    .describe("CL methodology state: plasma (rejected), fluid (exploration), gel (working), crystal (authoritative)"),
  confidence: z.enum(['low', 'medium', 'high'])
    .default('medium')
    .describe("Confidence level in the content"),
  tags: z.array(z.string()).optional()
    .describe("Optional tags for the note"),
  dependencies: z.array(z.string()).optional()
    .describe("Optional dependencies (paths to other notes)")
}).strict();

interface CLCreateResult extends FileOperationResult {
  processing_time_ms?: number;
  indexed_in_sqlite?: boolean;
  cl_metadata?: {
    state: string;
    confidence: string;
    title: string;
  };
}

async function clCreateNote(
  args: z.infer<typeof clCreateNoteSchema>,
  vaultPath: string,
  vaultName: string
): Promise<CLCreateResult> {
  const startTime = performance.now();
  
  try {
    // Initialize CL interfaces
    const fsInterface = new AtomicFilesystemInterface(vaultPath);
    const clDatabase = new CLStateDatabase(vaultPath);
    
    const sanitizedPath = ensureMarkdownExtension(args.path);
    const fullPath = path.join(vaultPath, sanitizedPath);
    
    // Validate path is within vault
    validateVaultPath(vaultPath, fullPath);
    
    // Create directory structure if needed
    const noteDir = path.dirname(fullPath);
    await ensureDirectory(noteDir);
    
    // Check if file exists first
    if (await fileExists(fullPath)) {
      throw CLErrorFactory.noteExistsError(sanitizedPath);
    }
    
    // Create note with atomic filesystem operation
    const createResult = await fsInterface.createNote(
      sanitizedPath,
      args.title,
      args.content,
      {
        state: args.state,
        confidence: args.confidence,
        tags: args.tags,
        dependencies: args.dependencies
      }
    );
    
    let indexedInSqlite = false;
    
    // If note creation succeeded, update SQLite index immediately
    if (createResult.success) {
      try {
        clDatabase.indexNote(sanitizedPath, {
          title: args.title,
          state: args.state,
          confidence: args.confidence,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          tags: args.tags,
          dependencies: args.dependencies
        });
        indexedInSqlite = true;
      } catch (indexError) {
        // Note created successfully but indexing failed
        // This is non-fatal - the note exists and can be found via content search
        console.warn(`Note created but SQLite indexing failed for ${sanitizedPath}:`, indexError);
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    return {
      success: createResult.success,
      message: createResult.success 
        ? `CL note created successfully with ${args.state} state` 
        : (createResult.message || 'Unknown error occurred'),
      path: fullPath,
      operation: 'create',
      processing_time_ms: processingTime,
      indexed_in_sqlite: indexedInSqlite,
      cl_metadata: {
        state: args.state,
        confidence: args.confidence,
        title: args.title
      }
    };
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    
    if (error instanceof McpError) {
      throw error;
    }
    
    // Enhanced error handling with context
    handleFsError(error, 'create CL note', { path: args.path, vault: vaultName });
  }
}

type CLCreateNoteArgs = z.infer<typeof clCreateNoteSchema>;

export function createCLCreateNoteTool(vaults: Map<string, string>) {
  return createTool<CLCreateNoteArgs>({
    name: "cl_create_note",
    description: `Create a new note with Crystallization Layers methodology frontmatter and automatic SQLite indexing.

Supports all CL states:
- plasma: Rejected/disproven approaches with documented lessons
- fluid: Active exploration and brainstorming (default)
- gel: Provisional conclusions with working assumptions
- crystal: Authoritative decisions and hardened knowledge

Features:
- Atomic filesystem operations (temp->rename pattern prevents corruption)
- Automatic CL frontmatter generation with proper metadata
- Immediate SQLite indexing for <50ms search performance
- Real-time file monitoring integration
- Comprehensive error handling with rollback capabilities

Examples:
- Fluid exploration: { "vault": "work", "path": "research/ai-integration.md", "title": "AI Integration Research", "state": "fluid" }
- Gel conclusion: { "vault": "personal", "path": "decisions/home-automation.md", "title": "Home Automation Decision", "state": "gel", "confidence": "high" }
- Crystal authority: { "vault": "work", "path": "standards/security-policy.md", "title": "Security Policy", "state": "crystal", "confidence": "high" }`,
    schema: clCreateNoteSchema,
    handler: async (args, vaultPath, vaultName) => {
      const result = await clCreateNote(args, vaultPath, vaultName);
      return createToolResponse(formatFileResult(result));
    }
  }, vaults);
}
