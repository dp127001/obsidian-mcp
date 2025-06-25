/**
 * Simplified Vault Scanner Implementation
 * 
 * Production-ready vault scanner with essential analysis capabilities
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createErrorResponse, createSuccessResponse } from "../../utils/response-helpers.js";
import { ValidationService } from "../../enhanced/validation-service.js";
import { LinkAnalyzer, LinkAnalysisResult } from "./link-analyzer.js";
import { LinkUpdater } from "./link-updater.js";
import { promises as fs } from 'fs';
import path from 'path';

export interface VaultScannerConfig {
  includeContentAnalysis?: boolean;
  includeGraphAnalysis?: boolean;
  includeCLAnalysis?: boolean;
  includeStructureAnalysis?: boolean;
  includeLinkIntegrity?: boolean;
  maxNotesDetailed?: number;
  maxDepth?: number;
  includePerformanceMetrics?: boolean;
}

export interface LinkIntegrityAnalysis {
  total_links: number;
  valid_links: number;
  broken_links: number;
  link_health_score: number;
  broken_link_details: BrokenLinkSummary[];
  notes_needing_repair: string[];
  link_health_by_directory: Record<string, DirectoryLinkHealth>;
  recommended_fixes: LinkFix[];
}

export interface BrokenLinkSummary {
  source_note: string;
  broken_link: string;
  suggested_fix?: string;
  confidence: number;
}

export interface DirectoryLinkHealth {
  directory: string;
  total_links: number;
  valid_links: number;
  health_score: number;
}

export interface LinkFix {
  action: 'rename_target' | 'update_link' | 'create_redirect' | 'remove_link';
  description: string;
  affected_notes: string[];
  estimated_effort: 'low' | 'medium' | 'high';
  automation_available: boolean;
}

export interface LinkMaintenanceRecommendation {
  type: 'automatic_fix' | 'manual_review' | 'structural_change';
  priority: 'low' | 'medium' | 'high';
  description: string;
  action: string;
  estimated_time: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface VaultScanResults {
  vault_name: string;
  scan_timestamp: string;
  scan_config: VaultScannerConfig;
  
  summary: {
    total_notes: number;
    total_directories: number;
    total_attachments: number;
    vault_size_mb: number;
    scan_duration_ms: number;
  };
  
  structure?: {
    directory_count: number;
    max_depth: number;
    notes_by_depth: Record<number, number>;
    largest_directories: Array<{ path: string; note_count: number }>;
  };
  
  content?: {
    avg_note_length: number;
    total_words: number;
    notes_with_tags: number;
    notes_with_links: number;
    orphaned_notes: string[];
  };
  
  cl_methodology?: {
    state_distribution: Record<string, number>;
    compliance_rate: number;
    non_compliant_notes: string[];
    methodology_health_score: number;
  };
  
  knowledge_graph?: {
    total_connections: number;
    avg_connections_per_note: number;
    hub_notes: Array<{ path: string; connections: number }>;
    isolated_notes: string[];
    link_integrity?: LinkIntegrityAnalysis;
  };
  
  quality_assessment: {
    overall_health_score: number;
    improvement_opportunities: string[];
    maintenance_tasks: string[];
  };
}

export class VaultScannerTool {
  private validationService: ValidationService;
  private vaultsMap: Map<string, string>;

  constructor(vaults?: Map<string, string>) {
    this.validationService = new ValidationService();
    this.vaultsMap = vaults || new Map();
  }

  static getDefinition(): Tool {
    return {
      name: "vault_scanner",
      description: `Comprehensive vault analysis providing insights into vault structure, content patterns, 
CL methodology compliance, knowledge graph topology, and optimization opportunities.`,
      inputSchema: {
        type: "object",
        properties: {
          vault: {
            type: "string",
            description: "Name of the vault to scan and analyze"
          },
          config: {
            type: "object",
            description: "Scanner configuration options",
            properties: {
              includeContentAnalysis: {
                type: "boolean",
                default: true
              },
              includeGraphAnalysis: {
                type: "boolean", 
                default: true
              },
              includeCLAnalysis: {
                type: "boolean",
                default: true
              },
              includeStructureAnalysis: {
                type: "boolean",
                default: true
              },
              includeLinkIntegrity: {
                type: "boolean",
                default: true,
                description: "Include link integrity analysis and broken link detection"
              },
              maxNotesDetailed: {
                type: "number",
                default: 0
              },
              maxDepth: {
                type: "number",
                default: 0
              },
              includePerformanceMetrics: {
                type: "boolean",
                default: false
              }
            }
          }
        },
        required: ["vault"]
      }
    };
  }

  async execute(vault: string, config: VaultScannerConfig = {}): Promise<VaultScanResults> {
    const startTime = Date.now();
    
    // Get vault path
    const vaultPath = this.vaultsMap.get(vault);
    if (!vaultPath) {
      throw createErrorResponse(
        'VAULT_NOT_FOUND',
        `Vault '${vault}' not found`,
        { available_vaults: Array.from(this.vaultsMap.keys()) }
      );
    }

    // Validate vault access
    const validation = await this.validationService.validateVaultAccess(vault, vaultPath);
    if (!validation.isValid) {
      throw createErrorResponse(
        'VAULT_ACCESS_FAILED',
        `Cannot access vault: ${validation.errors.join(', ')}`,
        { vault, path: vaultPath }
      );
    }

    // Apply default configuration
    const scanConfig: VaultScannerConfig = {
      includeContentAnalysis: true,
      includeGraphAnalysis: true,
      includeCLAnalysis: true,
      includeStructureAnalysis: true,
      includeLinkIntegrity: true,
      maxNotesDetailed: 0,
      maxDepth: 0,
      includePerformanceMetrics: false,
      ...config
    };

    try {
      // Basic enumeration
      const summary = await this.performBasicScan(vaultPath);
      
      // Optional analyses
      const structure = scanConfig.includeStructureAnalysis ? 
        await this.analyzeStructure(vaultPath) : undefined;
        
      const content = scanConfig.includeContentAnalysis ? 
        await this.analyzeContent(vaultPath) : undefined;
        
      const clMethodology = scanConfig.includeCLAnalysis ? 
        await this.analyzeCLMethodology(vaultPath) : undefined;
        
      const knowledgeGraph = scanConfig.includeGraphAnalysis ? 
        await this.analyzeKnowledgeGraphWithIntegrity(vaultPath, scanConfig.includeLinkIntegrity) : undefined;

      // Quality assessment
      const qualityAssessment = this.generateQualityAssessment(
        summary, structure, content, clMethodology, knowledgeGraph
      );

      const scanDuration = Date.now() - startTime;

      return {
        vault_name: vault,
        scan_timestamp: new Date().toISOString(),
        scan_config: scanConfig,
        summary: {
          ...summary,
          scan_duration_ms: scanDuration
        },
        structure,
        content,
        cl_methodology: clMethodology,
        knowledge_graph: knowledgeGraph,
        quality_assessment: qualityAssessment
      };

    } catch (error) {
      throw createErrorResponse(
        'VAULT_SCAN_FAILED',
        `Failed to scan vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { vault, path: vaultPath }
      );
    }
  }

  private async performBasicScan(vaultPath: string) {
    let totalNotes = 0;
    let totalDirectories = 0;
    let totalAttachments = 0;
    let totalSize = 0;

    const scanDirectory = async (dirPath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name !== '.obsidian') {
            totalDirectories++;
            await scanDirectory(fullPath);
          }
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          
          if (entry.name.endsWith('.md')) {
            totalNotes++;
          } else if (!entry.name.startsWith('.')) {
            totalAttachments++;
          }
        }
      }
    };

    await scanDirectory(vaultPath);

    return {
      total_notes: totalNotes,
      total_directories: totalDirectories,
      total_attachments: totalAttachments,
      vault_size_mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100
    };
  }

  private async analyzeStructure(vaultPath: string) {
    const depthCounts: Record<number, number> = {};
    const directorySizes: Array<{ path: string; note_count: number }> = [];
    let maxDepth = 0;

    const analyzeDirectory = async (dirPath: string, depth: number = 0) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let noteCount = 0;
      
      maxDepth = Math.max(maxDepth, depth);
      
      for (const entry of entries) {
        if (entry.name === '.obsidian') continue;
        
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subNotes = await analyzeDirectory(fullPath, depth + 1);
          noteCount += subNotes;
        } else if (entry.name.endsWith('.md')) {
          noteCount++;
        }
      }
      
      depthCounts[depth] = (depthCounts[depth] || 0) + noteCount;
      
      if (noteCount > 0) {
        const relativePath = path.relative(vaultPath, dirPath) || '/';
        directorySizes.push({ path: relativePath, note_count: noteCount });
      }
      
      return noteCount;
    };

    await analyzeDirectory(vaultPath);

    return {
      directory_count: Object.keys(depthCounts).length,
      max_depth: maxDepth,
      notes_by_depth: depthCounts,
      largest_directories: directorySizes
        .sort((a, b) => b.note_count - a.note_count)
        .slice(0, 10)
    };
  }

  private async analyzeContent(vaultPath: string) {
    let totalWords = 0;
    let notesWithTags = 0;
    let notesWithLinks = 0;
    const orphanedNotes: string[] = [];
    let noteCount = 0;

    const analyzeNote = async (notePath: string) => {
      try {
        const content = await fs.readFile(notePath, 'utf-8');
        const wordCount = content.split(/\s+/).length;
        totalWords += wordCount;
        noteCount++;

        if (content.includes('#')) notesWithTags++;
        if (content.includes('[[')) notesWithLinks++;
        
        // Simple orphan detection - no links in or out
        if (!content.includes('[[') && !content.includes(']]')) {
          const relativePath = path.relative(vaultPath, notePath);
          orphanedNotes.push(relativePath);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const scanForNotes = async (dirPath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === '.obsidian') continue;
        
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await scanForNotes(fullPath);
        } else if (entry.name.endsWith('.md')) {
          await analyzeNote(fullPath);
        }
      }
    };

    await scanForNotes(vaultPath);

    return {
      avg_note_length: noteCount > 0 ? Math.round(totalWords / noteCount) : 0,
      total_words: totalWords,
      notes_with_tags: notesWithTags,
      notes_with_links: notesWithLinks,
      orphaned_notes: orphanedNotes.slice(0, 20) // Limit for readability
    };
  }

  private async analyzeCLMethodology(vaultPath: string) {
    const stateDistribution: Record<string, number> = {
      plasma: 0,
      fluid: 0,
      gel: 0,
      crystal: 0,
      unknown: 0
    };
    
    const nonCompliantNotes: string[] = [];
    let totalNotes = 0;
    let compliantNotes = 0;

    const analyzeNote = async (notePath: string) => {
      try {
        const content = await fs.readFile(notePath, 'utf-8');
        totalNotes++;
        
        // Check for CL frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          const stateMatch = frontmatter.match(/state:\s*(\w+)/);
          
          if (stateMatch) {
            const state = stateMatch[1];
            if (stateDistribution.hasOwnProperty(state)) {
              stateDistribution[state]++;
              compliantNotes++;
            } else {
              stateDistribution.unknown++;
              nonCompliantNotes.push(path.relative(vaultPath, notePath));
            }
          } else {
            stateDistribution.unknown++;
            nonCompliantNotes.push(path.relative(vaultPath, notePath));
          }
        } else {
          stateDistribution.unknown++;
          nonCompliantNotes.push(path.relative(vaultPath, notePath));
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const scanForNotes = async (dirPath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === '.obsidian') continue;
        
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await scanForNotes(fullPath);
        } else if (entry.name.endsWith('.md')) {
          await analyzeNote(fullPath);
        }
      }
    };

    await scanForNotes(vaultPath);

    const complianceRate = totalNotes > 0 ? (compliantNotes / totalNotes) * 100 : 0;
    const healthScore = Math.min(1.0, complianceRate / 100 + 0.1); // Baseline health

    return {
      state_distribution: stateDistribution,
      compliance_rate: Math.round(complianceRate * 100) / 100,
      non_compliant_notes: nonCompliantNotes.slice(0, 10), // Limit for readability
      methodology_health_score: Math.round(healthScore * 100) / 100
    };
  }

  private async analyzeKnowledgeGraphWithIntegrity(vaultPath: string, includeLinkIntegrity: boolean = true) {
    const noteConnections = new Map<string, number>();
    let totalConnections = 0;
    const isolatedNotes: string[] = [];

    // Traditional analysis for backward compatibility
    const analyzeNote = async (notePath: string) => {
      try {
        const content = await fs.readFile(notePath, 'utf-8');
        const links = content.match(/\[\[([^\]]+)\]\]/g) || [];
        const connectionCount = links.length;
        
        const relativePath = path.relative(vaultPath, notePath);
        noteConnections.set(relativePath, connectionCount);
        totalConnections += connectionCount;
        
        if (connectionCount === 0) {
          isolatedNotes.push(relativePath);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const scanForNotes = async (dirPath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name === '.obsidian') continue;
        
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await scanForNotes(fullPath);
        } else if (entry.name.endsWith('.md')) {
          await analyzeNote(fullPath);
        }
      }
    };

    await scanForNotes(vaultPath);

    const noteCount = noteConnections.size;
    let avgConnections = noteCount > 0 ? totalConnections / noteCount : 0;
    
    // Find hub notes (top connected)
    let hubNotes = Array.from(noteConnections.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, connections]) => ({ path, connections }));

    let linkIntegrity: LinkIntegrityAnalysis | undefined;

    // Enhanced link integrity analysis
    if (includeLinkIntegrity) {
      try {
        const linkAnalyzer = new LinkAnalyzer(vaultPath);
        const linkAnalysis = await linkAnalyzer.analyzeLinkIntegrity();
        
        // Calculate corrected connectivity metrics
        const correctedConnectivity = this.calculateCorrectedConnectivity(linkAnalysis, noteConnections);
        
        // Update metrics with corrected values
        avgConnections = correctedConnectivity.avgValidConnections;
        hubNotes = correctedConnectivity.validHubNodes;
        
        linkIntegrity = {
          total_links: linkAnalysis.total_links,
          valid_links: linkAnalysis.valid_links,
          broken_links: linkAnalysis.broken_links.length,
          link_health_score: linkAnalysis.link_health_score,
          broken_link_details: this.summarizeBrokenLinks(linkAnalysis.broken_links),
          notes_needing_repair: linkAnalysis.notes_with_broken_links,
          link_health_by_directory: this.analyzeLinkHealthByDirectory(linkAnalysis, vaultPath),
          recommended_fixes: this.generateLinkFixes(linkAnalysis.broken_links)
        };
      } catch (error) {
        console.warn('Link integrity analysis failed:', error);
        // Fall back to traditional analysis
      }
    }

    return {
      total_connections: linkIntegrity ? linkIntegrity.valid_links : totalConnections,
      avg_connections_per_note: Math.round(avgConnections * 100) / 100,
      hub_notes: hubNotes,
      isolated_notes: isolatedNotes.slice(0, 10), // Limit for readability
      link_integrity: linkIntegrity
    };
  }

  private generateQualityAssessment(summary: any, structure: any, content: any, clMethodology: any, knowledgeGraph: any) {
    const improvements: string[] = [];
    const maintenance: string[] = [];
    let healthScore = 0.5; // Base score

    // Assess CL methodology compliance
    if (clMethodology) {
      if (clMethodology.compliance_rate < 50) {
        improvements.push('Low CL methodology compliance - consider adding frontmatter to notes');
        healthScore -= 0.2;
      } else if (clMethodology.compliance_rate > 80) {
        healthScore += 0.2;
      }

      if (clMethodology.non_compliant_notes.length > 0) {
        maintenance.push(`${clMethodology.non_compliant_notes.length} notes need CL frontmatter`);
      }
    }

    // Assess knowledge graph connectivity
    if (knowledgeGraph) {
      if (knowledgeGraph.avg_connections_per_note < 2) {
        improvements.push('Low knowledge graph connectivity - consider adding more links between notes');
        healthScore -= 0.1;
      } else if (knowledgeGraph.avg_connections_per_note > 3) {
        healthScore += 0.1;
      }

      if (knowledgeGraph.isolated_notes.length > summary.total_notes * 0.2) {
        maintenance.push('Many isolated notes - consider connecting them to the knowledge graph');
      }
    }

    // Assess structure organization
    if (structure && structure.max_depth > 5) {
      improvements.push('Deep directory structure - consider flattening for better navigation');
    }

    // Assess content quality
    if (content) {
      if (content.orphaned_notes.length > summary.total_notes * 0.3) {
        improvements.push('Many orphaned notes - consider adding connections or organizing into projects');
      }
    }

    // Normalize health score
    healthScore = Math.max(0, Math.min(1, healthScore));

    return {
      overall_health_score: Math.round(healthScore * 100) / 100,
      improvement_opportunities: improvements,
      maintenance_tasks: maintenance,
      link_maintenance: knowledgeGraph?.link_integrity ? 
        this.generateLinkMaintenanceRecommendations(knowledgeGraph) : undefined,
      automation_opportunities: knowledgeGraph?.link_integrity ? 
        this.identifyAutomationOpportunities(knowledgeGraph) : undefined
    };
  }

  private calculateCorrectedConnectivity(linkAnalysis: LinkAnalysisResult, originalConnections: Map<string, number>) {
    // Calculate valid connections only
    const validConnections = new Map<string, number>();
    
    for (const validLink of linkAnalysis.most_connected_notes) {
      validConnections.set(validLink.note_path, validLink.valid_outbound);
    }

    const totalValidConnections = linkAnalysis.valid_links;
    const noteCount = originalConnections.size;
    const avgValidConnections = noteCount > 0 ? totalValidConnections / noteCount : 0;

    // Update hub nodes with only valid connections
    const validHubNodes = linkAnalysis.most_connected_notes
      .filter(note => note.valid_outbound > 0)
      .slice(0, 5)
      .map(note => ({ path: note.note_path, connections: note.valid_outbound }));

    // Find truly isolated notes (no valid connections)
    const trueIsolatedNotes = linkAnalysis.most_connected_notes
      .filter(note => note.valid_outbound === 0 && note.inbound_links === 0)
      .map(note => note.note_path);

    return {
      avgValidConnections,
      validHubNodes,
      trueIsolatedNotes
    };
  }

  private summarizeBrokenLinks(brokenLinks: any[]): BrokenLinkSummary[] {
    return brokenLinks.slice(0, 10).map(link => ({
      source_note: link.source_note,
      broken_link: link.target_link,
      suggested_fix: link.potential_matches?.[0]?.file_path,
      confidence: link.potential_matches?.[0]?.similarity_score || 0
    }));
  }

  private analyzeLinkHealthByDirectory(linkAnalysis: LinkAnalysisResult, vaultPath: string): Record<string, DirectoryLinkHealth> {
    const directoryHealth: Record<string, DirectoryLinkHealth> = {};

    // Group notes by directory
    const notesByDir = new Map<string, string[]>();
    
    for (const note of linkAnalysis.most_connected_notes) {
      const dir = path.dirname(note.note_path) || '/';
      if (!notesByDir.has(dir)) {
        notesByDir.set(dir, []);
      }
      notesByDir.get(dir)!.push(note.note_path);
    }

    // Calculate health for each directory
    for (const [dir, notes] of notesByDir) {
      let totalLinks = 0;
      let validLinks = 0;

      for (const notePath of notes) {
        const noteStats = linkAnalysis.most_connected_notes.find(n => n.note_path === notePath);
        if (noteStats) {
          totalLinks += noteStats.outbound_links;
          validLinks += noteStats.valid_outbound;
        }
      }

      const healthScore = totalLinks > 0 ? validLinks / totalLinks : 1;

      directoryHealth[dir] = {
        directory: dir,
        total_links: totalLinks,
        valid_links: validLinks,
        health_score: healthScore
      };
    }

    return directoryHealth;
  }

  private generateLinkFixes(brokenLinks: any[]): LinkFix[] {
    const fixes: LinkFix[] = [];

    for (const brokenLink of brokenLinks) {
      if (brokenLink.potential_matches && brokenLink.potential_matches.length > 0) {
        const bestMatch = brokenLink.potential_matches[0];
        
        if (bestMatch.similarity_score >= 0.8) {
          fixes.push({
            action: 'update_link',
            description: `Update '${brokenLink.target_link}' to '${bestMatch.file_path}' in ${brokenLink.source_note}`,
            affected_notes: [brokenLink.source_note],
            estimated_effort: 'low',
            automation_available: true
          });
        } else if (bestMatch.similarity_score >= 0.6) {
          fixes.push({
            action: 'update_link',
            description: `Review and potentially update '${brokenLink.target_link}' to '${bestMatch.file_path}' in ${brokenLink.source_note}`,
            affected_notes: [brokenLink.source_note],
            estimated_effort: 'medium',
            automation_available: false
          });
        }
      } else {
        fixes.push({
          action: 'remove_link',
          description: `Remove or replace broken link '${brokenLink.target_link}' in ${brokenLink.source_note}`,
          affected_notes: [brokenLink.source_note],
          estimated_effort: 'medium',
          automation_available: false
        });
      }
    }

    return fixes;
  }

  private generateLinkMaintenanceRecommendations(knowledgeGraph: any): LinkMaintenanceRecommendation[] {
    if (!knowledgeGraph?.link_integrity) return [];

    const recommendations: LinkMaintenanceRecommendation[] = [];
    const linkIntegrity = knowledgeGraph.link_integrity;

    // High-confidence automatic fixes
    const highConfidenceFixes = linkIntegrity.broken_link_details
      .filter((detail: BrokenLinkSummary) => detail.confidence > 0.8);
    
    if (highConfidenceFixes.length > 0) {
      recommendations.push({
        type: 'automatic_fix',
        priority: 'high',
        description: `${highConfidenceFixes.length} broken links have high-confidence suggested fixes`,
        action: 'Run automatic link repair tool',
        estimated_time: '5-10 minutes',
        risk_level: 'low'
      });
    }

    // Manual review needed
    const manualReviewFixes = linkIntegrity.broken_link_details
      .filter((detail: BrokenLinkSummary) => detail.confidence <= 0.8 && detail.confidence > 0.3);
    
    if (manualReviewFixes.length > 0) {
      recommendations.push({
        type: 'manual_review',
        priority: 'medium',
        description: `${manualReviewFixes.length} broken links need manual review`,
        action: 'Review suggested fixes and apply manually',
        estimated_time: '15-30 minutes',
        risk_level: 'medium'
      });
    }

    return recommendations;
  }

  private identifyAutomationOpportunities(knowledgeGraph: any): string[] {
    if (!knowledgeGraph?.link_integrity) return [];

    const opportunities: string[] = [];
    const linkIntegrity = knowledgeGraph.link_integrity;

    const autoFixable = linkIntegrity.recommended_fixes
      .filter((fix: LinkFix) => fix.automation_available).length;
    
    if (autoFixable > 0) {
      opportunities.push(`${autoFixable} broken links can be automatically repaired`);
    }

    const directoryIssues = Object.values(linkIntegrity.link_health_by_directory)
      .filter((health: any) => health.health_score < 0.7).length;
    
    if (directoryIssues > 0) {
      opportunities.push(`${directoryIssues} directories have link health issues that could benefit from bulk repair`);
    }

    return opportunities;
  }
}
