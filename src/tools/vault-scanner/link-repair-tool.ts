import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from "../../utils/response-helpers.js";
import { ValidationService } from "../../enhanced/validation-service.js";
import { LinkAnalyzer, BrokenLink } from "./link-analyzer.js";
import { LinkUpdater, LinkFix, BulkFixResult } from "./link-updater.js";

export interface LinkRepairToolConfig {
  mode: 'scan' | 'fix_automatic' | 'fix_manual';
  confidence_threshold?: number;
  dry_run?: boolean;
  target_notes?: string[];
  create_backup?: boolean;
}

export class LinkRepairTool {
  private validationService: ValidationService;
  private vaultsMap: Map<string, string>;

  constructor(vaults?: Map<string, string>) {
    this.validationService = new ValidationService();
    this.vaultsMap = vaults || new Map();
  }

  static getDefinition(): Tool {
    return {
      name: "link_repair",
      description: `Scan for and repair broken WikiLinks in vault.
      
Modes:
- scan: Identify broken links and suggest fixes
- fix_automatic: Apply high-confidence fixes automatically  
- fix_manual: Apply specific fixes with user confirmation

Safety features:
- Dry run mode for preview
- Automatic backup creation
- Confidence thresholds for automatic fixes
- Validation before applying changes`,
      inputSchema: {
        type: "object",
        properties: {
          vault: {
            type: "string",
            description: "Name of the vault to repair links in"
          },
          mode: {
            type: "string",
            enum: ['scan', 'fix_automatic', 'fix_manual'],
            default: 'scan',
            description: "Repair mode: scan only, automatic fixes, or manual fixes"
          },
          confidence_threshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.8,
            description: "Minimum confidence for automatic fixes (0-1)"
          },
          dry_run: {
            type: "boolean",
            default: true,
            description: "Preview changes without applying them"
          },
          target_notes: {
            type: "array",
            items: { type: "string" },
            description: "Specific notes to repair (optional, defaults to all notes)"
          },
          create_backup: {
            type: "boolean",
            default: true,
            description: "Create backup before applying fixes"
          }
        },
        required: ["vault"]
      }
    };
  }

  async execute(
    vault: string, 
    config: LinkRepairToolConfig = { mode: 'scan' }
  ): Promise<any> {
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

    try {
      const linkAnalyzer = new LinkAnalyzer(vaultPath);
      const linkUpdater = new LinkUpdater(vaultPath);
      
      switch (config.mode) {
        case 'scan':
          return await this.scanBrokenLinks(linkAnalyzer);
        case 'fix_automatic':
          return await this.fixAutomaticLinks(linkAnalyzer, linkUpdater, config);
        case 'fix_manual':
          return await this.fixManualLinks(linkAnalyzer, linkUpdater, config);
        default:
          throw createErrorResponse(
            'INVALID_MODE',
            `Unknown repair mode: ${config.mode}`,
            { supported_modes: ['scan', 'fix_automatic', 'fix_manual'] }
          );
      }
    } catch (error) {
      throw createErrorResponse(
        'LINK_REPAIR_FAILED',
        `Link repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { vault, mode: config.mode }
      );
    }
  }

  private async scanBrokenLinks(analyzer: LinkAnalyzer) {
    const analysis = await analyzer.analyzeLinkIntegrity();
    
    const summary = {
      total_links: analysis.total_links,
      valid_links: analysis.valid_links,
      broken_links: analysis.broken_links.length,
      link_health_score: analysis.link_health_score,
      repair_suggestions: analysis.broken_links.length
    };

    const brokenLinksDetails = analysis.broken_links.map(link => ({
      source: link.source_note,
      broken_link: link.target_link,
      suggestions: link.potential_matches?.slice(0, 3).map(match => ({
        target: match.file_path,
        confidence: Math.round(match.similarity_score * 100) / 100,
        match_type: match.match_type
      }))
    }));

    const recommendations = this.generateRepairRecommendations(analysis);

    return createSuccessResponse({
      mode: 'scan',
      summary,
      broken_links: brokenLinksDetails,
      recommendations,
      vault_health: {
        overall_score: analysis.link_health_score,
        notes_needing_repair: analysis.notes_with_broken_links.length,
        automatic_fixes_available: this.countAutomaticFixes(analysis.broken_links, 0.8)
      }
    });
  }

  private async fixAutomaticLinks(
    analyzer: LinkAnalyzer, 
    updater: LinkUpdater, 
    config: LinkRepairToolConfig
  ) {
    const analysis = await analyzer.analyzeLinkIntegrity();
    const threshold = config.confidence_threshold || 0.8;
    
    const automaticFixes = LinkUpdater.generateAutomaticFixes(
      analysis.broken_links, 
      threshold
    ).filter(fix => fix.fix_type === 'exact_match' || fix.fix_type === 'fuzzy_match');

    if (config.dry_run) {
      return createSuccessResponse({
        mode: 'dry_run',
        fixes_available: automaticFixes.length,
        confidence_threshold: threshold,
        fixes: automaticFixes.map(fix => ({
          source: fix.source_note,
          broken_link: fix.broken_link,
          suggested_fix: fix.suggested_target,
          confidence: Math.round(fix.confidence * 100) / 100,
          fix_type: fix.fix_type,
          automated: true
        })),
        next_steps: automaticFixes.length > 0 ? 
          'Set dry_run: false to apply these fixes' : 
          'No high-confidence automatic fixes available'
      });
    }

    // Apply fixes
    const bulkResult: BulkFixResult = await updater.applyBulkFixes(
      automaticFixes, 
      config.create_backup !== false
    );

    return createSuccessResponse({
      mode: 'automatic_fix',
      fixes_applied: bulkResult.successful_fixes,
      fixes_failed: bulkResult.failed_fixes,
      backup_created: bulkResult.backup_created,
      confidence_threshold: threshold,
      details: bulkResult.fixes_applied.map(fix => ({
        source: fix.source_note,
        original_link: fix.original_link,
        new_link: fix.new_link,
        success: fix.success,
        error: fix.error
      })),
      summary: {
        total_attempted: bulkResult.total_fixes_attempted,
        success_rate: bulkResult.total_fixes_attempted > 0 ? 
          Math.round((bulkResult.successful_fixes / bulkResult.total_fixes_attempted) * 100) : 0
      }
    });
  }

  private async fixManualLinks(
    analyzer: LinkAnalyzer, 
    updater: LinkUpdater, 
    config: LinkRepairToolConfig
  ) {
    const analysis = await analyzer.analyzeLinkIntegrity();
    
    // Filter to target notes if specified
    let filteredBrokenLinks = analysis.broken_links;
    if (config.target_notes && config.target_notes.length > 0) {
      filteredBrokenLinks = analysis.broken_links.filter(link => 
        config.target_notes!.includes(link.source_note)
      );
    }

    const manualFixes = LinkUpdater.generateAutomaticFixes(
      filteredBrokenLinks,
      0.3 // Lower threshold for manual review
    );

    if (config.dry_run) {
      return createSuccessResponse({
        mode: 'manual_review',
        notes_to_review: filteredBrokenLinks.length,
        fixes_available: manualFixes.length,
        fixes: manualFixes.map(fix => ({
          source: fix.source_note,
          broken_link: fix.broken_link,
          suggested_fix: fix.suggested_target,
          confidence: Math.round(fix.confidence * 100) / 100,
          requires_review: fix.confidence < 0.8,
          fix_type: fix.fix_type
        })),
        instructions: 'Review suggested fixes and apply selectively with dry_run: false'
      });
    }

    // For manual mode without dry_run, apply all fixes (user has reviewed them)
    const bulkResult: BulkFixResult = await updater.applyBulkFixes(
      manualFixes,
      config.create_backup !== false
    );

    return createSuccessResponse({
      mode: 'manual_fix',
      fixes_applied: bulkResult.successful_fixes,
      fixes_failed: bulkResult.failed_fixes,
      backup_created: bulkResult.backup_created,
      target_notes: config.target_notes || ['all'],
      details: bulkResult.fixes_applied
    });
  }

  private generateRepairRecommendations(analysis: any): any {
    const recommendations = [];
    
    const highConfidenceFixes = this.countAutomaticFixes(analysis.broken_links, 0.8);
    const mediumConfidenceFixes = this.countAutomaticFixes(analysis.broken_links, 0.6) - highConfidenceFixes;
    const lowConfidenceFixes = analysis.broken_links.length - highConfidenceFixes - mediumConfidenceFixes;

    if (highConfidenceFixes > 0) {
      recommendations.push({
        priority: 'high',
        action: 'automatic_repair',
        description: `${highConfidenceFixes} broken links can be automatically fixed with high confidence`,
        command: { mode: 'fix_automatic', dry_run: false, confidence_threshold: 0.8 },
        estimated_time: '1-2 minutes',
        risk: 'low'
      });
    }

    if (mediumConfidenceFixes > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'manual_review',
        description: `${mediumConfidenceFixes} broken links need manual review before fixing`,
        command: { mode: 'fix_manual', dry_run: true },
        estimated_time: '5-10 minutes',
        risk: 'medium'
      });
    }

    if (lowConfidenceFixes > 0) {
      recommendations.push({
        priority: 'low',
        action: 'investigate',
        description: `${lowConfidenceFixes} broken links require investigation - no clear fixes available`,
        estimated_time: '10-20 minutes',
        risk: 'high'
      });
    }

    return recommendations;
  }

  private countAutomaticFixes(brokenLinks: BrokenLink[], threshold: number): number {
    return brokenLinks.filter(link => 
      link.potential_matches && 
      link.potential_matches.length > 0 && 
      link.potential_matches[0].similarity_score >= threshold
    ).length;
  }
}

// Export factory function for MCP server integration
export function createLinkRepairTool(vaults: Map<string, string>) {
  const schema = z.object({
    vault: z.string().min(1, "Vault name required"),
    mode: z.enum(['scan', 'fix_automatic', 'fix_manual']).default('scan'),
    confidence_threshold: z.number().min(0).max(1).default(0.8),
    dry_run: z.boolean().default(true),
    target_notes: z.array(z.string()).optional(),
    create_backup: z.boolean().default(true)
  });

  return {
    name: "link_repair",
    description: `Scan for and repair broken WikiLinks in vault.
      
Modes:
- scan: Identify broken links and suggest fixes
- fix_automatic: Apply high-confidence fixes automatically  
- fix_manual: Apply specific fixes with user confirmation

Safety features:
- Dry run mode for preview
- Automatic backup creation
- Confidence thresholds for automatic fixes
- Validation before applying changes`,
    inputSchema: {
      jsonSchema: {
        type: "object",
        properties: {
          vault: {
            type: "string",
            description: "Name of the vault to repair links in"
          },
          mode: {
            type: "string",
            enum: ['scan', 'fix_automatic', 'fix_manual'],
            default: 'scan',
            description: "Repair mode: scan only, automatic fixes, or manual fixes"
          },
          confidence_threshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.8,
            description: "Minimum confidence for automatic fixes (0-1)"
          },
          dry_run: {
            type: "boolean",
            default: true,
            description: "Preview changes without applying them"
          },
          target_notes: {
            type: "array",
            items: { type: "string" },
            description: "Specific notes to repair (optional, defaults to all notes)"
          },
          create_backup: {
            type: "boolean",
            default: true,
            description: "Create backup before applying fixes"
          }
        },
        required: ["vault"]
      },
      parse: (args: any) => schema.parse(args)
    },
    handler: async (args: z.infer<typeof schema>) => {
      const vaultPath = vaults.get(args.vault);
      if (!vaultPath) {
        throw createErrorResponse(
          'VAULT_NOT_FOUND',
          `Vault '${args.vault}' not found`,
          { available_vaults: Array.from(vaults.keys()) }
        );
      }

      const tool = new LinkRepairTool(vaults);
      const result = await tool.execute(args.vault, {
        mode: args.mode,
        confidence_threshold: args.confidence_threshold,
        dry_run: args.dry_run,
        target_notes: args.target_notes,
        create_backup: args.create_backup
      });

      return result;
    }
  };
}
