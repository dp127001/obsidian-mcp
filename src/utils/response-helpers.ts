/**
 * Response Helper Utilities
 * 
 * Provides standardized response formatting for tools
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any
): McpError {
  return new McpError(ErrorCode.InternalError, `${code}: ${message}${details ? ` - ${JSON.stringify(details)}` : ''}`);
}

/**
 * Create standardized success response
 */
export function createSuccessResponse(data: any, message?: string) {
  return {
    success: true,
    message: message || 'Operation completed successfully',
    data
  };
}

/**
 * Format content for MCP response
 */
export function formatContent(content: any): Array<{ type: string; text: string }> {
  return [{
    type: "text",
    text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  }];
}
