/**
 * Canvas Writer and Utilities
 * Canvas file generation, validation, and atomic filesystem operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import type { 
  ObsidianCanvas, 
  CanvasGenerationResult, 
  ValidationResult,
  CanvasNode,
  CanvasEdge
} from './types.js';

export class CanvasWriter {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * Write canvas to filesystem with atomic operations
   */
  async writeCanvas(
    canvas: ObsidianCanvas, 
    filename: string
  ): Promise<CanvasGenerationResult> {
    const startTime = performance.now();
    
    // Ensure .canvas extension
    const canvasFilename = filename.endsWith('.canvas') ? filename : `${filename}.canvas`;
    const filePath = path.join(this.vaultPath, canvasFilename);
    
    // Generate JSON with proper formatting
    const canvasJson = JSON.stringify(canvas, null, 2);
    
    // Atomic write operation
    await this.atomicWrite(filePath, canvasJson);
    
    const processingTime = performance.now() - startTime;
    
    return {
      canvas,
      filePath,
      nodeCount: canvas.nodes.length,
      edgeCount: canvas.edges.length,
      layoutUsed: 'manual',
      processingTimeMs: processingTime
    };
  }

  /**
   * Validate canvas structure and integrity
   */
  validateCanvas(canvas: ObsidianCanvas): ValidationResult {
    const errors: string[] = [];
    
    // Validate node IDs are unique
    const nodeIds = new Set(canvas.nodes.map(n => n.id));
    if (nodeIds.size !== canvas.nodes.length) {
      errors.push('Duplicate node IDs found');
    }
    
    // Validate node structure
    for (const node of canvas.nodes) {
      if (!this.isValidNodeId(node.id)) {
        errors.push(`Invalid node ID format: ${node.id}`);
      }
      
      if (!['file', 'text', 'group'].includes(node.type)) {
        errors.push(`Invalid node type: ${node.type}`);
      }
      
      if (typeof node.x !== 'number' || typeof node.y !== 'number') {
        errors.push(`Invalid node position for node ${node.id}`);
      }
      
      if (typeof node.width !== 'number' || typeof node.height !== 'number') {
        errors.push(`Invalid node dimensions for node ${node.id}`);
      }
      
      // Validate file nodes have file property
      if (node.type === 'file' && !node.file) {
        errors.push(`File node ${node.id} missing file property`);
      }
      
      // Validate text nodes have text property
      if (node.type === 'text' && !node.text) {
        errors.push(`Text node ${node.id} missing text property`);
      }
    }
    
    // Validate edge references
    for (const edge of canvas.edges) {
      if (!nodeIds.has(edge.fromNode)) {
        errors.push(`Edge ${edge.id} references invalid fromNode: ${edge.fromNode}`);
      }
      if (!nodeIds.has(edge.toNode)) {
        errors.push(`Edge ${edge.id} references invalid toNode: ${edge.toNode}`);
      }
      
      // Validate edge sides
      const validSides = ['top', 'right', 'bottom', 'left'];
      if (!validSides.includes(edge.fromSide)) {
        errors.push(`Invalid fromSide for edge ${edge.id}: ${edge.fromSide}`);
      }
      if (!validSides.includes(edge.toSide)) {
        errors.push(`Invalid toSide for edge ${edge.id}: ${edge.toSide}`);
      }
    }
    
    // Validate edge IDs are unique
    const edgeIds = new Set(canvas.edges.map(e => e.id));
    if (edgeIds.size !== canvas.edges.length) {
      errors.push('Duplicate edge IDs found');
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate unique node ID
   */
  generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate edge ID from node IDs
   */
  generateEdgeId(fromNode: string, toNode: string): string {
    return `edge-${fromNode}-${toNode}`;
  }

  /**
   * Atomic file write operation to prevent corruption
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      // Write to temporary file
      await fs.writeFile(tempPath, content, 'utf8');
      
      // Atomic rename to final location
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Validate node ID format
   */
  private isValidNodeId(id: string): boolean {
    // Node IDs should be non-empty strings without characters that could break JSON or canvas format
    // Allow letters, numbers, forward slashes, hyphens, underscores, dots
    return typeof id === 'string' && id.length > 0 && !/[<>:"|?*\x00-\x1f]/.test(id);
  }

  /**
   * Calculate optimal node dimensions based on content
   */
  calculateNodeDimensions(content: string, nodeType: 'file' | 'text'): { width: number; height: number } {
    if (nodeType === 'file') {
      // File nodes: base size + title length factor
      const baseWidth = 180;
      const baseHeight = 100;
      const titleLength = content.length;
      
      return {
        width: Math.max(baseWidth, Math.min(300, baseWidth + titleLength * 2)),
        height: baseHeight
      };
    } else {
      // Text nodes: size based on content length
      const baseWidth = 200;
      const baseHeight = 80;
      const lines = content.split('\n').length;
      const maxLineLength = Math.max(...content.split('\n').map(line => line.length));
      
      return {
        width: Math.max(baseWidth, Math.min(400, baseWidth + maxLineLength * 6)),
        height: Math.max(baseHeight, baseHeight + lines * 20)
      };
    }
  }

  /**
   * Get state-based color mapping
   */
  static getStateColor(state: string): string {
    const stateColors: Record<string, string> = {
      plasma: '1',    // Red
      fluid: '2',     // Blue  
      gel: '3',       // Yellow
      crystal: '4'    // Green
    };
    return stateColors[state] || '0';
  }

  /**
   * Get relation-based color mapping
   */
  static getRelationColor(relationType: string): string {
    const relationColors: Record<string, string> = {
      depends_on: '1',
      implements: '2', 
      extends: '3',
      part_of: '4',
      conflicts_with: '5'
    };
    return relationColors[relationType] || '0';
  }

  /**
   * Check if canvas file already exists
   */
  async canvasExists(filename: string): Promise<boolean> {
    const canvasFilename = filename.endsWith('.canvas') ? filename : `${filename}.canvas`;
    const filePath = path.join(this.vaultPath, canvasFilename);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
