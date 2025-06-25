/**
 * Vault Scanner Tool Integration
 * 
 * Integrates the vault scanner into the main server and tool registry.
 * Provides comprehensive vault analysis capabilities.
 */

import { VaultScannerTool } from "./vault-scanner/index.js";

// Export the vault scanner tool for integration
export { VaultScannerTool } from "./vault-scanner/index.js";
export { KnowledgeGraphScanner } from "./vault-scanner/knowledge-graph-scanner.js";
export { CLMethodologyAnalyzer } from "./vault-scanner/cl-methodology-analyzer.js";
export { ContentAnalyzer } from "./vault-scanner/content-analyzer.js";
export { StructureAnalyzer } from "./vault-scanner/structure-analyzer.js";

// Tool instance for server registration
export const vaultScannerTool = new VaultScannerTool();
