/**
 * Canvas MCP Tools
 * MCP tool implementations for canvas creation and management
 */

import { z } from "zod";
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { CanvasGenerationResult, ObsidianCanvas } from './types.js';
import { CLCanvasAnalyzer } from './cl-analyzer.js';
import { CanvasWriter } from './writer.js';
import { InteractiveCanvasGenerator, type InteractiveCanvasOptions } from './interactive/interactive-generator.js';
import { createTool } from '../../utils/tool-factory.js';
import { createToolResponse } from '../../utils/responses.js';

// Canvas creation schema
const canvasCreateSchema = z.object({
  vault: z.string().min(1, "Vault name cannot be empty"),
  name: z.string().min(1, "Canvas name cannot be empty"),
  type: z.enum(['cl-network', 'project-timeline', 'decision-tree', 'topic-map', 'custom']),
  options: z.object({
    layoutAlgorithm: z.enum(['force-directed', 'hierarchical', 'circular', 'grid', 'timeline']).optional(),
    includeStates: z.array(z.enum(['plasma', 'fluid', 'gel', 'crystal'])).optional(),
    maxNodes: z.number().min(1).max(200).optional(),
    projectPath: z.string().optional(),
    rootNotePath: z.string().optional(),
    colorScheme: z.enum(['cl-states', 'topics', 'confidence']).optional(),
    spacing: z.number().optional(),
    canvasWidth: z.number().optional(),
    canvasHeight: z.number().optional()
  }).optional()
}).strict();

// Template canvas schema
const canvasTemplateSchema = z.object({
  vault: z.string().min(1, "Vault name cannot be empty"),
  name: z.string().min(1, "Canvas name cannot be empty"),
  template: z.enum(['project-dashboard', 'knowledge-exploration', 'decision-analysis', 'topic-clusters']),
  customOptions: z.object({
    maxNodes: z.number().min(1).max(200).optional(),
    projectPath: z.string().optional(),
    rootNotePath: z.string().optional()
  }).optional()
}).strict();

// Type aliases for inferred types
type CanvasCreateArgs = z.infer<typeof canvasCreateSchema>;
type CanvasTemplateArgs = z.infer<typeof canvasTemplateSchema>;

/**
 * Create canvas with specified type and options
 */
async function createCanvas(
  args: CanvasCreateArgs,
  vaultPath: string,
  vaultName: string
): Promise<CanvasGenerationResult> {
  const startTime = performance.now();
  
  try {
    const analyzer = new CLCanvasAnalyzer(vaultPath);
    const writer = new CanvasWriter(vaultPath);
    
    // Check if canvas already exists
    if (await writer.canvasExists(args.name)) {
      throw new Error(`Canvas "${args.name}" already exists. Choose a different name or delete the existing canvas.`);
    }
    
    let canvas: ObsidianCanvas;
    
    // Generate canvas based on type
    switch (args.type) {
      case 'cl-network':
        canvas = await analyzer.generateCLNetworkCanvas({
          includeStates: args.options?.includeStates || ['fluid', 'gel', 'crystal'],
          maxNodes: args.options?.maxNodes || 50,
          layoutAlgorithm: args.options?.layoutAlgorithm || 'force-directed',
          groupByTopic: true
        });
        break;
        
      case 'project-timeline':
        if (!args.options?.projectPath) {
          throw new Error('Project path required for timeline canvas. Specify options.projectPath');
        }
        canvas = await analyzer.generateProjectTimeline(args.options.projectPath);
        break;
        
      case 'decision-tree':
        if (!args.options?.rootNotePath) {
          throw new Error('Root note path required for decision tree canvas. Specify options.rootNotePath');
        }
        canvas = await analyzer.generateDecisionTree(args.options.rootNotePath);
        break;
        
      case 'topic-map':
        canvas = await analyzer.generateCLNetworkCanvas({
          includeStates: args.options?.includeStates || ['gel', 'crystal'],
          maxNodes: args.options?.maxNodes || 40,
          layoutAlgorithm: 'circular',
          groupByTopic: true
        });
        break;
        
      default:
        throw new Error(`Canvas type "${args.type}" not yet implemented`);
    }
    
    // Validate canvas structure
    const validation = writer.validateCanvas(canvas);
    if (!validation.valid) {
      throw new Error(`Canvas validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Write canvas to file
    const result = await writer.writeCanvas(canvas, args.name);
    result.processingTimeMs = performance.now() - startTime;
    result.layoutUsed = args.options?.layoutAlgorithm || 'force-directed';
    
    return result;
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    throw new Error(`Canvas creation failed after ${processingTime.toFixed(1)}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create canvas from predefined template
 */
async function createCanvasFromTemplate(
  args: CanvasTemplateArgs,
  vaultPath: string,
  vaultName: string
): Promise<CanvasGenerationResult> {
  const startTime = performance.now();
  
  try {
    const analyzer = new CLCanvasAnalyzer(vaultPath);
    const writer = new CanvasWriter(vaultPath);
    
    // Check if canvas already exists
    if (await writer.canvasExists(args.name)) {
      throw new Error(`Canvas "${args.name}" already exists. Choose a different name or delete the existing canvas.`);
    }
    
    let canvas: ObsidianCanvas;
    
    // Generate canvas based on template
    switch (args.template) {
      case 'project-dashboard':
        // Comprehensive project overview
        canvas = await analyzer.generateCLNetworkCanvas({
          includeStates: ['gel', 'crystal'],
          maxNodes: args.customOptions?.maxNodes || 30,
          layoutAlgorithm: 'hierarchical',
          groupByTopic: true
        });
        break;
        
      case 'knowledge-exploration':
        // Active research and learning
        canvas = await analyzer.generateCLNetworkCanvas({
          includeStates: ['fluid', 'gel'],
          maxNodes: args.customOptions?.maxNodes || 50,
          layoutAlgorithm: 'force-directed',
          groupByTopic: false
        });
        break;
        
      case 'decision-analysis':
        // Decision trees and outcomes
        if (!args.customOptions?.rootNotePath) {
          throw new Error('Root note path required for decision analysis template. Specify customOptions.rootNotePath');
        }
        canvas = await analyzer.generateDecisionTree(args.customOptions.rootNotePath);
        break;
        
      case 'topic-clusters':
        // Subject-based knowledge groupings
        canvas = await analyzer.generateCLNetworkCanvas({
          includeStates: ['fluid', 'gel', 'crystal'],
          maxNodes: args.customOptions?.maxNodes || 40,
          layoutAlgorithm: 'circular',
          groupByTopic: true
        });
        break;
        
      default:
        throw new Error(`Template "${args.template}" not found`);
    }
    
    // Validate and write canvas
    const validation = writer.validateCanvas(canvas);
    if (!validation.valid) {
      throw new Error(`Canvas validation failed: ${validation.errors.join(', ')}`);
    }
    
    const result = await writer.writeCanvas(canvas, args.name);
    result.processingTimeMs = performance.now() - startTime;
    result.layoutUsed = args.template;
    
    return result;
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    throw new Error(`Template canvas creation failed after ${processingTime.toFixed(1)}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create canvas creation MCP tool
 */
export function createCanvasCreateTool(vaults: Map<string, string>) {
  return createTool<CanvasCreateArgs>({
    name: "canvas_create",
    description: `Create visual Obsidian canvas diagrams with intelligent layouts and CL methodology integration.

Canvas Types:
- cl-network: Complete knowledge graph with state-based coloring and relationship mapping
- project-timeline: Chronological project progression with state evolution visualization  
- decision-tree: Branching decision structures with outcome mapping
- topic-map: Subject-based knowledge clustering with relationship visualization

Layout Algorithms:
- force-directed: Physics-based automatic positioning for natural clustering
- hierarchical: Tree structures showing clear progression and dependencies
- circular: Radial layout emphasizing central topics with connected knowledge
- grid: Organized matrix positioning for systematic knowledge review
- timeline: Chronological horizontal layout for project and decision progression

Features:
- Automatic CL state coloring (plasma=red, fluid=blue, gel=yellow, crystal=green)
- Intelligent node sizing based on content and connections
- Relationship-based edge styling and labeling
- Performance optimized for large knowledge bases (up to 200 nodes)
- Native Obsidian .canvas format for full compatibility

Examples:
- Knowledge graph: { "vault": "personal", "name": "knowledge-map", "type": "cl-network", "options": { "layoutAlgorithm": "force-directed", "maxNodes": 50, "includeStates": ["gel", "crystal"] } }
- Project timeline: { "vault": "work", "name": "project-progress", "type": "project-timeline", "options": { "projectPath": "projects/ai-integration" } }
- Decision analysis: { "vault": "personal", "name": "home-automation-decisions", "type": "decision-tree", "options": { "rootNotePath": "decisions/home-automation.md" } }
- Topic clusters: { "vault": "research", "name": "topic-overview", "type": "topic-map", "options": { "layoutAlgorithm": "circular", "maxNodes": 40 } }`,
    schema: canvasCreateSchema,
    handler: async (args, vaultPath, vaultName) => {
      const result = await createCanvas(args, vaultPath, vaultName);
      
      const response = {
        success: true,
        canvas: {
          name: args.name,
          type: args.type,
          path: result.filePath,
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          layoutUsed: result.layoutUsed,
          processingTimeMs: result.processingTimeMs
        },
        message: `Canvas "${args.name}" created successfully with ${result.nodeCount} nodes and ${result.edgeCount} edges using ${result.layoutUsed} layout. Processing time: ${result.processingTimeMs.toFixed(1)}ms`
      };
      
      return createToolResponse(JSON.stringify(response, null, 2));
    }
  }, vaults);
}

/**
 * Create canvas template MCP tool
 */
export function createCanvasTemplateTool(vaults: Map<string, string>) {
  return createTool<CanvasTemplateArgs>({
    name: "canvas_from_template",
    description: `Create canvas from predefined templates optimized for common CL methodology use cases.

Available Templates:
- project-dashboard: Comprehensive project overview with timeline, dependencies, and status (gel+crystal states, hierarchical layout)
- knowledge-exploration: Fluid and gel state notes for active research and learning (force-directed layout for discovery)
- decision-analysis: Decision trees with outcomes and alternative paths (requires rootNotePath, hierarchical structure)
- topic-clusters: Subject-based knowledge groupings with relationship mapping (circular layout, topic-grouped)

Template Benefits:
- Pre-configured layouts optimized for specific use cases
- Intelligent state filtering for template purpose
- Reduced complexity with sensible defaults
- Educational examples of effective knowledge visualization

Examples:
- Project overview: { "vault": "work", "name": "current-projects", "template": "project-dashboard", "customOptions": { "maxNodes": 25 } }
- Research exploration: { "vault": "research", "name": "active-learning", "template": "knowledge-exploration", "customOptions": { "maxNodes": 60 } }
- Decision mapping: { "vault": "personal", "name": "home-decisions", "template": "decision-analysis", "customOptions": { "rootNotePath": "decisions/main-decisions.md" } }
- Topic overview: { "vault": "knowledge", "name": "subject-map", "template": "topic-clusters", "customOptions": { "maxNodes": 35 } }`,
    schema: canvasTemplateSchema,
    handler: async (args, vaultPath, vaultName) => {
      const result = await createCanvasFromTemplate(args, vaultPath, vaultName);
      
      const response = {
        success: true,
        canvas: {
          name: args.name,
          template: args.template,
          path: result.filePath,
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          layoutUsed: result.layoutUsed,
          processingTimeMs: result.processingTimeMs
        },
        message: `Canvas "${args.name}" created from "${args.template}" template with ${result.nodeCount} nodes and ${result.edgeCount} edges. Processing time: ${result.processingTimeMs.toFixed(1)}ms`
      };
      
      return createToolResponse(JSON.stringify(response, null, 2));
    }
  }, vaults);
}

/**
 * List available canvas templates
 */
export function createCanvasListTemplatesTool() {
  return {
    name: "canvas_list_templates",
    description: "List all available canvas templates with descriptions and use cases",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      parse: () => ({}),
      jsonSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    handler: async () => {
      const templates = {
        "project-dashboard": {
          name: "Project Dashboard",
          description: "Comprehensive project overview with timeline, dependencies, and status",
          includes: "gel and crystal state notes",
          layout: "hierarchical",
          maxNodes: 30,
          useCase: "Project management and status tracking"
        },
        "knowledge-exploration": {
          name: "Knowledge Exploration Map", 
          description: "Fluid and gel state notes for active research and learning",
          includes: "fluid and gel state notes",
          layout: "force-directed",
          maxNodes: 50,
          useCase: "Research, learning, and knowledge discovery"
        },
        "decision-analysis": {
          name: "Decision Analysis Framework",
          description: "Decision trees with outcomes and alternative paths",
          includes: "all states with decision focus",
          layout: "hierarchical tree",
          requirements: "rootNotePath required",
          useCase: "Decision making and outcome analysis"
        },
        "topic-clusters": {
          name: "Topic Knowledge Clusters",
          description: "Subject-based knowledge groupings with relationship mapping",
          includes: "fluid, gel, and crystal states",
          layout: "circular with topic grouping",
          maxNodes: 40,
          useCase: "Subject overview and knowledge organization"
        }
      };
      
      const response = {
        templates,
        totalTemplates: Object.keys(templates).length,
        usage: "Use canvas_from_template with template name and customOptions to create canvas from template"
      };
      
      return createToolResponse(JSON.stringify(response, null, 2));
    }
  };
}
