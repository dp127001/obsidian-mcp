import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Enhanced error message structure for CL methodology operations
 */
interface EnhancedErrorMessage {
  operation: string;         // What operation failed
  problem: string;           // Specific problem identification
  context: string;           // Why this matters/what was expected
  remediation: string[];     // Actionable steps to resolve
  methodology?: string;      // CL methodology explanation if relevant
  examples?: string[];       // Valid usage examples
  references?: string[];     // Related documentation or notes
}

/**
 * Creates an enhanced error message with structured format
 */
const createEnhancedError = (
  operation: string,
  problem: string,
  context: string,
  remediation: string[],
  methodology?: string,
  examples?: string[]
): string => {
  let message = `${operation}: ${problem}. ${context}`;
  
  if (remediation.length > 0) {
    message += ` Remediation: ${remediation.join(' ')}`;
  }
  
  if (methodology) {
    message += ` CL Methodology: ${methodology}`;
  }
  
  if (examples && examples.length > 0) {
    message += ` Examples: ${examples.join(', ')}`;
  }
  
  return message;
};

/**
 * Factory for creating enhanced CL-specific error messages
 */
export class CLErrorFactory {
  /**
   * State validation errors with CL methodology guidance
   */
  static stateValidationError(received: string, operation: string): McpError {
    const validStates = ['plasma', 'fluid', 'gel', 'crystal'];
    const message = createEnhancedError(
      `Cannot ${operation}`,
      `state must be one of [${validStates.join(', ')}]. Received '${received}'`,
      'CL Methodology uses four knowledge states to track confidence and authority levels from exploration to authoritative decisions.',
      [
        'Choose appropriate state for your content confidence level.',
        'Start with "fluid" for exploration, brainstorming, or uncertain content.',
        'Use "gel" for working conclusions with reasonable confidence.',
        'Reserve "crystal" for authoritative decisions with high evidence.',
        'Use "plasma" for documented failures or rejected approaches.'
      ],
      'State progression: fluid (exploration) → gel (working conclusions) → crystal (authoritative decisions) or → plasma (rejected/failed)',
      [
        'state: "fluid" (brainstorming, exploration)',
        'state: "gel" (working solution, provisional)',  
        'state: "crystal" (final decision, authoritative)',
        'state: "plasma" (failed attempt, rejected)'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Confidence level validation errors with guidance
   */
  static confidenceValidationError(received: string, operation: string): McpError {
    const validConfidence = ['low', 'medium', 'high'];
    const message = createEnhancedError(
      `Cannot ${operation}`,
      `confidence must be one of [${validConfidence.join(', ')}]. Received '${received}'`,
      'Confidence levels indicate certainty in knowledge and guide appropriate state transitions within CL methodology.',
      [
        'Use "low" for uncertain, speculative, or exploratory content.',
        'Use "medium" for reasonably confident working conclusions.',
        'Use "high" for validated, authoritative, or well-evidenced decisions.',
        'Align confidence with state: fluid/plasma typically low-medium, gel medium-high, crystal high.'
      ],
      'Confidence supports state transitions: low confidence suggests fluid/plasma, high confidence enables crystal promotion',
      [
        'confidence: "low" (uncertain exploration)',
        'confidence: "medium" (working assumption)',
        'confidence: "high" (validated conclusion)'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * State transition validation errors with CL methodology rules
   */
  static stateTransitionError(from: string, to: string, reason: string, confidence?: string): McpError {
    const transitionRules: Record<string, string> = {
      'fluid→crystal': 'Requires intermediate gel state or exceptional evidence',
      'gel→crystal': 'Requires high confidence and substantial supporting evidence',
      'crystal→fluid': 'Requires strong justification - crystal represents established authority',
      'plasma→crystal': 'Requires evidence that contradicts original rejection reason'
    };
    
    const transition = `${from}→${to}`;
    const rule = transitionRules[transition] || 'Unusual transition requiring careful justification';
    
    const message = createEnhancedError(
      `Cannot transition ${transition}`,
      `${rule}. Current: confidence=${confidence || 'unknown'}, justification=${reason}`,
      'CL Methodology enforces evidence-based state transitions to maintain knowledge quality and authority clarity.',
      [
        'Gather additional evidence or validation before crystal promotion.',
        'Consider intermediate gel state for working conclusions.',
        'Document substantial justification for authority-level changes.',
        'Review existing evidence and confidence levels.',
        'Ensure transition serves knowledge graph coherence.'
      ],
      'State transitions follow evidence hierarchy: more evidence enables higher states, contradicting evidence forces demotion',
      [
        'fluid→gel: "sufficient working evidence"',
        'gel→crystal: "high confidence validation"',
        'crystal→plasma: "contradicting evidence emerged"',
        'any→fluid: "return to exploration needed"'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Authority conflict errors with CL one-crystal rule
   */
  static authorityConflictError(topic: string, existingPath: string, operation: string = 'create note'): McpError {
    const message = createEnhancedError(
      `Cannot create second crystal-state note for topic '${topic}'`,
      `crystal authority already exists at '${existingPath}'`,
      'CL Methodology One Crystal Rule prevents conflicting authoritative sources for same topic, maintaining clear knowledge hierarchy.',
      [
        'Extend existing crystal note with additional information using note updates.',
        'Create gel-state alternative approach if proposing different solution methodology.',
        'Promote existing gel note to replace current crystal if better evidence exists.',
        'Review existing crystal completeness before creating competing authority.',
        'Consider sub-topic specialization if scope is genuinely different.'
      ],
      'One crystal per topic ensures clear authority hierarchy and prevents knowledge fragmentation that confuses decision-making',
      [
        `extend: cl_update_note("${existingPath}", additional_content)`,
        'alternative: state="gel" (different approach)',
        'replacement: demote existing→promote better→plasma old',
        'specialization: "topic/subtopic" hierarchy'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Path security errors with vault boundary explanation
   */
  static pathSecurityError(invalidPath: string): McpError {
    const message = createEnhancedError(
      'Cannot create note at invalid path',
      `path '${invalidPath}' escapes vault boundaries or contains security violations`,
      'Security constraints protect your knowledge base from unauthorized access and maintain vault isolation.',
      [
        'Use vault-relative paths without ".." parent directory references.',
        'Ensure path starts from vault root and stays within vault boundaries.',
        'Check path syntax for valid characters and proper structure.',
        'Verify vault name is correct and accessible with current permissions.'
      ],
      'Vault boundaries maintain security isolation between different knowledge bases',
      [
        '✅ "projects/analysis.md"',
        '✅ "personal/goals.md"', 
        '❌ "../other-vault/file.md"',
        '❌ "/absolute/path.md"'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Vault access errors with available options
   */
  static vaultAccessError(vaultName: string, availableVaults: string[]): McpError {
    const message = createEnhancedError(
      'Cannot access vault',
      `vault '${vaultName}' does not exist or insufficient permissions`,
      'Multi-vault system requires explicit vault specification and appropriate access permissions.',
      [
        'Verify vault name spelling matches exactly (case-sensitive).',
        'Check available vaults with list operation.',
        'Confirm read/write permissions for target vault.',
        'Ensure vault is properly connected and accessible.'
      ],
      'Vault isolation ensures secure separation of different knowledge domains',
      [`Available vaults: [${availableVaults.join(', ')}]`, 'vault: "personal"', 'vault: "work"']
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Performance warning errors with optimization guidance
   */
  static performanceWarningError(operation: string, timeMs: number, noteCount?: number): McpError {
    const message = createEnhancedError(
      'Operation performance degradation detected',
      `${operation} taking longer than expected (${timeMs}ms)`,
      `Large vault detected ${noteCount ? `with ${noteCount}+ notes` : ''} impacting search and operation performance.`,
      [
        'Add path_filter parameter to narrow search scope to specific folders.',
        'Use more specific state criteria (crystal, gel) instead of broad searches.',
        'Consider breaking large vaults into focused sub-vaults for better performance.',
        'Apply confidence filters to reduce result set size.',
        'Use content inclusion sparingly for large operations.'
      ],
      'Performance optimization maintains responsive user experience in large knowledge bases',
      [
        'path_filter: "projects/current/"',
        'state: "crystal" (faster indexing)',
        'confidence: "high"',
        'includeContent: false'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Missing required field errors with field-specific guidance
   */
  static missingFieldError(field: string, operation: string): McpError {
    const fieldGuidance: Record<string, string> = {
      'title': 'Descriptive title helps identify and link notes in knowledge graph',
      'content': 'Content is the knowledge being captured - even brief content has value',
      'state': 'State tracks confidence level - start with "fluid" for exploration',
      'path': 'Path determines note location and organization within vault',
      'vault': 'Vault specifies which knowledge base to operate on'
    };
    
    const guidance = fieldGuidance[field] || 'Required for proper CL methodology implementation and knowledge graph building.';
    
    const message = createEnhancedError(
      `Cannot ${operation}`,
      `required field '${field}' is missing`,
      guidance,
      [
        `Provide ${field} value appropriate for your content and intent.`,
        'Review CL note creation requirements for complete parameter list.',
        'Ensure all required fields have meaningful values.',
        'Check operation documentation for field specifications.'
      ],
      'CL methodology requires complete metadata for proper knowledge state tracking and graph building',
      [
        `${field}: "[appropriate_value]"`,
        'title: "Descriptive Knowledge Title"',
        'state: "fluid" (for exploration)',
        'path: "category/note-name.md"'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * File not found errors with helpful context
   */
  static noteNotFoundError(path: string, vault: string): McpError {
    const message = createEnhancedError(
      'Cannot find note',
      `note "${path}" does not exist in vault "${vault}"`,
      'CL operations require existing notes for state management and graph building.',
      [
        'Verify note path spelling and location within vault.',
        'Check if note exists using search or list operations.',
        'Confirm vault name is correct and accessible.',
        'Create note first if it should exist using cl_create_note.',
        'Review recent activity to confirm note was not moved or deleted.'
      ],
      'CL methodology tracks note states and relationships - operations require existing notes',
      [
        'search: cl_search_by_state for similar notes',
        'list: list available notes in target folder',
        'create: cl_create_note if note should exist',
        'verify: check vault and path accuracy'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }

  /**
   * Note already exists errors with clear options
   */
  static noteExistsError(path: string): McpError {
    const message = createEnhancedError(
      'Cannot create note',
      `note already exists at "${path}"`,
      'CL methodology prevents accidental overwriting to protect existing knowledge and relationships.',
      [
        'Use cl_update_note to modify existing note content.',
        'Use cl_update_state to change note state or confidence.',
        'Choose different path if creating genuinely new content.',
        'Read existing note first to understand current content and state.',
        'Consider if you want to extend existing knowledge rather than replace.'
      ],
      'Note protection prevents accidental loss of established knowledge graph relationships',
      [
        'update: cl_update_note for content changes',
        'state: cl_update_state for state transitions',
        'read: read_note to review existing content',
        'rename: choose different path for new content'
      ]
    );
    
    return new McpError(ErrorCode.InvalidRequest, message);
  }
}

/**
 * Enhanced Zod error handling with CL-specific messaging
 */
export function handleEnhancedZodError(error: z.ZodError, operation: string): never {
  const issue = error.issues[0];
  
  switch (issue.code) {
    case 'invalid_enum_value':
      if (issue.path.includes('state')) {
        throw CLErrorFactory.stateValidationError(issue.received as string, operation);
      }
      if (issue.path.includes('confidence')) {
        throw CLErrorFactory.confidenceValidationError(issue.received as string, operation);
      }
      break;
      
    case 'invalid_type':
      if (issue.expected === 'string' && issue.received === 'undefined') {
        const field = issue.path[issue.path.length - 1] as string;
        throw CLErrorFactory.missingFieldError(field, operation);
      }
      break;
      
    case 'too_small':
      if (issue.type === 'string' && issue.minimum === 1) {
        const field = issue.path[issue.path.length - 1] as string;
        throw CLErrorFactory.missingFieldError(field, operation);
      }
      break;
  }
  
  // Fallback to generic enhanced error with some improvement
  const fieldPath = issue.path.join('.');
  const message = createEnhancedError(
    `Cannot ${operation}`,
    `validation failed for field '${fieldPath}': ${issue.message}`,
    'Input validation ensures proper CL methodology implementation and prevents invalid operations.',
    [
      'Review the provided input values for correct format and type.',
      'Check CL operation documentation for required field specifications.',
      'Ensure all required fields are provided with valid values.',
      'Verify field values match expected CL methodology constraints.'
    ],
    'CL methodology requires valid inputs for proper knowledge state management',
    [
      `Check field: ${fieldPath}`,
      'Review operation documentation',
      'Validate input format and values'
    ]
  );
  
  throw new McpError(ErrorCode.InvalidRequest, message);
}
