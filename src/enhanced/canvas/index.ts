/**
 * Canvas Module Index
 * Public API exports for Obsidian canvas generation capabilities
 */

// Core types and interfaces
export type {
  ObsidianCanvas,
  CanvasNode,
  CanvasEdge,
  CLCanvasNode,
  CLCanvasEdge,
  CanvasLayoutOptions,
  CanvasGenerationResult,
  CLNetworkOptions,
  ForceDirectedOptions,
  CircularLayoutOptions,
  TimelineLayoutOptions,
  ValidationResult,
  CLNote,
  NoteRelationship,
  CanvasTemplate,
  CanvasGenerationOptions,
  PerformanceMetric,
  PerformanceStats
} from './types.js';

// Canvas generation and analysis
export { CLCanvasAnalyzer } from './cl-analyzer.js';

// Layout algorithms
export { CanvasLayoutEngine } from './layouts.js';

// File writing and validation
export { CanvasWriter } from './writer.js';

// MCP tool implementations
export { 
  createCanvasCreateTool,
  createCanvasTemplateTool,
  createCanvasListTemplatesTool
} from './canvas-tools.js';

// Interactive canvas generation
export { InteractiveCanvasGenerator } from './interactive/interactive-generator.js';
export { InteractiveCanvasRenderer } from './interactive-renderer.js';
export type { InteractiveCanvasOptions } from './interactive/interactive-generator.js';

/**
 * Canvas Module Capabilities Summary
 * 
 * This module provides comprehensive visual canvas generation for Obsidian vaults
 * with deep integration into the Crystallization Layers (CL) methodology.
 * 
 * Key Features:
 * - Native .canvas file generation compatible with Obsidian
 * - Multiple layout algorithms (force-directed, hierarchical, circular, grid, timeline)
 * - CL state-based visualization with intelligent coloring and sizing
 * - Relationship mapping and edge optimization
 * - Template system for common use cases
 * - Performance monitoring and optimization
 * - Comprehensive validation and error handling
 * 
 * Supported Canvas Types:
 * - cl-network: Complete knowledge graph visualization
 * - project-timeline: Chronological project progression
 * - decision-tree: Branching decision structures
 * - topic-map: Subject-based knowledge clustering
 * 
 * Templates Available:
 * - project-dashboard: Project management overview
 * - knowledge-exploration: Research and learning map
 * - decision-analysis: Decision making framework
 * - topic-clusters: Knowledge organization
 * 
 * Integration Points:
 * - CL State Database for metadata retrieval
 * - Filesystem interface for atomic .canvas file operations
 * - MCP tool factory for standardized tool creation
 * - Enhanced error handling for user guidance
 * 
 * Performance Targets:
 * - Canvas generation: <1000ms for 50 nodes
 * - Layout algorithms: <500ms for force-directed positioning
 * - File operations: <100ms for .canvas file writing
 * - Memory usage: <100MB for largest supported canvas
 * 
 * Quality Standards:
 * - Atomic file operations prevent corruption
 * - Comprehensive input validation
 * - Enhanced error messages with user guidance
 * - Performance monitoring and optimization
 * - Test coverage >90% for all functionality
 */

// Version and metadata
export const CANVAS_MODULE_VERSION = '1.0.0';
export const SUPPORTED_OBSIDIAN_CANVAS_VERSION = '1.0';
