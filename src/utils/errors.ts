import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { CLErrorFactory, handleEnhancedZodError } from "./enhanced-errors.js";

/**
 * Wraps common file system errors into McpErrors with enhanced messaging
 */
export function handleFsError(error: unknown, operation: string, context?: { path?: string; vault?: string }): never {
  if (error instanceof McpError) {
    throw error;
  }

  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    
    switch (nodeError.code) {
      case 'ENOENT':
        // Enhanced file not found error with CL context
        if (context?.path && context?.vault) {
          throw CLErrorFactory.noteNotFoundError(context.path, context.vault);
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `File or directory not found: ${nodeError.message}. Verify path exists and is accessible within vault boundaries.`
        );
      case 'EACCES':
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Permission denied: ${nodeError.message}. Check file permissions and vault access rights.`
        );
      case 'EEXIST':
        // Enhanced file exists error with CL context
        if (context?.path) {
          throw CLErrorFactory.noteExistsError(context.path);
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          `File or directory already exists: ${nodeError.message}. Use update operations for existing content.`
        );
      case 'ENOSPC':
        throw new McpError(
          ErrorCode.InternalError,
          'Not enough space to write file. Free disk space or reduce content size.'
        );
      default:
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to ${operation}: ${nodeError.message}. Check system resources and file permissions.`
        );
    }
  }

  throw new McpError(
    ErrorCode.InternalError,
    `Unexpected error during ${operation}. Review operation parameters and system state.`
  );
}

/**
 * Handles Zod validation errors with enhanced CL-specific messaging
 */
export function handleZodError(error: z.ZodError, operation: string = 'operation'): never {
  // Use enhanced error handling for better user experience
  handleEnhancedZodError(error, operation);
}

/**
 * Creates an enhanced error for when a note already exists
 * @deprecated Use CLErrorFactory.noteExistsError for enhanced messaging
 */
export function createNoteExistsError(path: string): McpError {
  return CLErrorFactory.noteExistsError(path);
}

/**
 * Creates an enhanced error for when a note is not found
 * @deprecated Use CLErrorFactory.noteNotFoundError for enhanced messaging
 */
export function createNoteNotFoundError(path: string, vault: string = 'vault'): McpError {
  return CLErrorFactory.noteNotFoundError(path, vault);
}

// Re-export enhanced error factory for convenience
export { CLErrorFactory } from "./enhanced-errors.js";
