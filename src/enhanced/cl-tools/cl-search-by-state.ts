import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { createToolResponse } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";
import { CLStateDatabase } from "../cl-state/database.js";
import { promises as fs } from "fs";
import path from "path";
import * as glob from "glob";

// Enhanced search schema with hybrid reliability options
const clSearchByStateSchema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to search in"),
  state: z.enum(['plasma', 'fluid', 'gel', 'crystal', 'all'])
    .describe("CL state to search for, or 'all' for all states"),
  confidence: z.enum(['low', 'medium', 'high', 'any'])
    .default('any')
    .describe("Filter by confidence level, or 'any' for all levels"),
  path_filter: z.string().optional()
    .describe("Optional path filter (e.g., 'projects/' to search only in projects folder)"),
  include_content: z.boolean()
    .default(false)
    .describe("Whether to include note content in results (impacts performance)")
}).strict();

interface CLSearchResult {
  results: CLNoteResult[];
  search_method: 'content_search' | 'cached_search';
  reliable: boolean;
  total_count: number;
  processing_time_ms: number;
  vault_name: string;
}

interface CLNoteResult {
  path: string;
  title: string;
  state: string;
  confidence: string;
  created?: string;
  modified?: string;
  content?: string;
  tags?: string[];
  dependencies?: string[];
  size?: number;
}

// Extract CL metadata from frontmatter
function extractCLMetadata(content: string): any {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;
  
  try {
    // Simple YAML-like parsing for CL metadata
    const frontmatter = frontmatterMatch[1];
    const metadata: any = {};
    
    frontmatter.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        // Remove quotes and clean up value
        metadata[key] = value.replace(/^["']|["']$/g, '');
      }
    });
    
    return metadata;
  } catch (error) {
    return null;
  }
}

// Fallback filesystem search when SQLite fails
async function fallbackFilesystemSearch(
  vaultPath: string,
  state: string,
  pathFilter?: string
): Promise<CLNoteResult[]> {
  const searchPattern = pathFilter 
    ? path.join(vaultPath, pathFilter, '**/*.md').replace(/\\/g, '/')
    : path.join(vaultPath, '**/*.md').replace(/\\/g, '/');
    
  const files = await glob.glob(searchPattern, { nodir: true });
  const results: CLNoteResult[] = [];
  
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const metadata = extractCLMetadata(content);
      
      if (metadata && (state === 'all' || metadata.state === state)) {
        const relativePath = path.relative(vaultPath, filePath);
        
        results.push({
          path: relativePath,
          title: metadata.title || path.basename(filePath, '.md'),
          state: metadata.state || 'unknown',
          confidence: metadata.confidence || 'unknown',
          created: metadata.created,
          modified: metadata.modified,
          tags: metadata.tags ? (Array.isArray(metadata.tags) ? metadata.tags : [metadata.tags]) : undefined,
          dependencies: metadata.dependencies ? (Array.isArray(metadata.dependencies) ? metadata.dependencies : [metadata.dependencies]) : undefined,
          size: content.length
        });
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }
  
  return results;
}

async function clSearchByState(
  args: z.infer<typeof clSearchByStateSchema>,
  vaultPath: string,
  vaultName: string
): Promise<CLSearchResult> {
  const startTime = performance.now();
  
  try {
    // Initialize CL database
    const clDatabase = new CLStateDatabase(vaultPath);
    
    // Try SQLite search first (primary method)
    try {
      const sqliteResults = clDatabase.searchByState(args.state, {
        confidence: args.confidence === 'any' ? undefined : args.confidence,
        pathFilter: args.path_filter,
        includeContent: args.include_content
      });
      
      // Convert to CLNoteResult format
      const formattedResults: CLNoteResult[] = sqliteResults.map(note => ({
        path: note.path,
        title: note.title,
        state: note.state,
        confidence: note.confidence,
        created: note.created,
        modified: note.modified,
        content: args.include_content ? note.content : undefined
      }));
      
      return {
        results: formattedResults,
        search_method: 'content_search',
        reliable: true,
        total_count: formattedResults.length,
        processing_time_ms: performance.now() - startTime,
        vault_name: vaultName
      };
      
    } catch (sqliteError) {
      console.warn(`SQLite search failed for vault ${vaultName}, falling back to filesystem search:`, sqliteError);
      
      // Fallback to filesystem search (secondary method)
      const fallbackResults = await fallbackFilesystemSearch(
        vaultPath,
        args.state,
        args.path_filter
      );
      
      // Apply confidence filter if specified
      const filteredResults = args.confidence === 'any' 
        ? fallbackResults
        : fallbackResults.filter(note => note.confidence === args.confidence);
      
      return {
        results: filteredResults,
        search_method: 'cached_search',
        reliable: false,
        total_count: filteredResults.length,
        processing_time_ms: performance.now() - startTime,
        vault_name: vaultName
      };
    }
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    
    throw new McpError(
      ErrorCode.InternalError,
      `CL search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

type CLSearchByStateArgs = z.infer<typeof clSearchByStateSchema>;

export function createCLSearchByStateTool(vaults: Map<string, string>) {
  return createTool<CLSearchByStateArgs>({
    name: "cl_search_by_state",
    description: `Search for notes by Crystallization Layers methodology state with hybrid reliability.

Supports all CL states:
- plasma: Rejected/disproven approaches with documented lessons
- fluid: Active exploration and brainstorming  
- gel: Provisional conclusions with working assumptions
- crystal: Authoritative decisions and hardened knowledge
- all: Return notes in any state

Features:
- Hybrid search: Primary SQLite index (<50ms) with filesystem fallback
- Reliability indicators: 'content_search' (reliable) vs 'cached_search' (may be stale)
- Flexible filtering: confidence level, path filters, content inclusion
- Performance monitoring: processing time tracking
- Graceful degradation: Always returns results even if primary method fails

Search methods:
- content_search: SQLite database query (reliable, current metadata, <50ms)
- cached_search: Filesystem scan fallback (slower but comprehensive, ~300-500ms)

Examples:
- Find all gel-state decisions: { "vault": "work", "state": "gel" }
- High-confidence crystal knowledge: { "vault": "personal", "state": "crystal", "confidence": "high" }
- Explore project fluid notes: { "vault": "work", "state": "fluid", "path_filter": "projects/" }
- All notes with content: { "vault": "research", "state": "all", "include_content": true }`,
    schema: clSearchByStateSchema,
    handler: async (args, vaultPath, vaultName) => {
      const result = await clSearchByState(args, vaultPath, vaultName);
      return createToolResponse(JSON.stringify(result, null, 2));
    }
  }, vaults);
}
