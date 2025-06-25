/**
 * Vault Scanner Tool Factory
 * 
 * Creates a vault scanner tool instance for comprehensive vault analysis
 */

import { z } from "zod";
import { createTool } from "../utils/tool-factory.js";
import { VaultScannerTool } from "./vault-scanner/vault-scanner-impl.js";
import { createToolResponse } from "../utils/responses.js";

// Input validation schema
const schema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to scan and analyze"),
  config: z.object({
    includeContentAnalysis: z.boolean().default(true)
      .describe("Include detailed content analysis (slower but comprehensive)"),
    includeGraphAnalysis: z.boolean().default(true)
      .describe("Include knowledge graph topology analysis"),
    includeCLAnalysis: z.boolean().default(true)
      .describe("Include CL methodology compliance analysis"),
    includeStructureAnalysis: z.boolean().default(true)
      .describe("Include structural organization analysis"),
    maxNotesDetailed: z.number().default(0)
      .describe("Maximum number of notes to analyze in detail (0 = no limit)"),
    maxDepth: z.number().default(0)
      .describe("Maximum depth of directory analysis (0 = all levels)"),
    includePerformanceMetrics: z.boolean().default(false)
      .describe("Include detailed performance timing metrics")
  }).optional().default({})
    .describe("Scanner configuration options")
}).strict();

async function executeVaultScan(
  args: z.infer<typeof schema>,
  vaultPath: string,
  vaultName: string
) {
  const vaultsMap = new Map([[vaultName, vaultPath]]);
  const scanner = new VaultScannerTool(vaultsMap);
  
  const result = await scanner.execute(args.vault, args.config);
  return {
    success: true,
    message: `Vault scan completed for '${args.vault}'`,
    data: result
  };
}

type VaultScanArgs = z.infer<typeof schema>;

/**
 * Create vault scanner tool for server registration
 */
export function createVaultScannerTool(vaults: Map<string, string>) {
  return createTool<VaultScanArgs>({
    name: "vault_scanner",
    description: `Comprehensive vault analysis providing insights into vault structure, content patterns, 
CL methodology compliance, knowledge graph topology, and optimization opportunities. Designed for 
technical analysis and vault maintenance workflows.

Examples:
- Basic scan: { "vault": "personal" }
- Custom config: { "vault": "work", "config": { "includeContentAnalysis": false, "maxNotesDetailed": 100 } }`,
    schema,
    handler: async (args, vaultPath, vaultName) => {
      const result = await executeVaultScan(args, vaultPath, vaultName);
      return createToolResponse(JSON.stringify(result.data, null, 2));
    }
  }, vaults);
}
