/**
 * CL Canvas Analyzer
 * Integration with Crystallization Layers methodology for intelligent canvas generation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { 
  ObsidianCanvas,
  CLCanvasNode,
  CLCanvasEdge,
  CLNetworkOptions,
  CLNote,
  NoteRelationship,
  CanvasNode,
  CanvasEdge
} from './types.js';
import { CanvasLayoutEngine } from './layouts.js';
import { CanvasWriter } from './writer.js';

export class CLCanvasAnalyzer {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * Generate canvas from CL note relationships
   */
  async generateCLNetworkCanvas(options: CLNetworkOptions = {}): Promise<ObsidianCanvas> {
    const {
      includeStates = ['fluid', 'gel', 'crystal', 'plasma'],
      maxNodes = 50,
      layoutAlgorithm = 'force-directed',
      groupByTopic = true
    } = options;

    // Get all CL notes matching criteria
    const notes = await this.getCLNotes(includeStates, maxNodes);
    const relationships = await this.extractRelationships(notes);

    // Create nodes with CL-specific styling
    const nodes: CLCanvasNode[] = notes.map(note => ({
      id: this.sanitizeNodeId(note.path),
      type: 'file' as const,
      file: note.path,
      x: 0, y: 0,  // Will be positioned by layout algorithm
      width: this.calculateNodeWidth(note),
      height: this.calculateNodeHeight(note),
      color: CanvasWriter.getStateColor(note.state),
      clState: note.state,
      confidence: note.confidence,
      topicKey: this.extractTopicKey(note.path)
    }));

    // Create edges from relationships
    const edges: CLCanvasEdge[] = relationships.map((rel, index) => ({
      id: `edge_${index}_${this.sanitizeNodeId(rel.source)}_to_${this.sanitizeNodeId(rel.target)}`,
      fromNode: this.sanitizeNodeId(rel.source),
      toNode: this.sanitizeNodeId(rel.target),
      fromSide: 'right' as const,
      toSide: 'left' as const,
      color: CanvasWriter.getRelationColor(rel.type),
      relationType: rel.type,
      label: rel.type.replace('_', ' ')
    }));

    // Apply layout algorithm
    const positionedNodes = this.applyLayout(nodes, edges, layoutAlgorithm);

    // Optimize edge connections
    const optimizedEdges = CanvasLayoutEngine.optimizeEdgeConnections(positionedNodes, edges);

    return {
      nodes: positionedNodes,
      edges: optimizedEdges
    };
  }

  /**
   * Generate project timeline canvas
   */
  async generateProjectTimeline(projectPath: string): Promise<ObsidianCanvas> {
    const projectNotes = await this.getProjectNotes(projectPath);
    
    // Sort by creation date
    const sortedNotes = projectNotes.sort((a, b) => 
      new Date(a.created).getTime() - new Date(b.created).getTime()
    );

    const nodes: CanvasNode[] = sortedNotes.map((note, index) => ({
      id: this.sanitizeNodeId(note.path),
      type: 'file' as const,
      file: note.path,
      x: 100 + index * 300,  // Timeline horizontal layout
      y: 200 + this.getStateVerticalOffset(note.state),
      width: 200,
      height: 100,
      color: CanvasWriter.getStateColor(note.state)
    }));

    // Connect sequential notes
    const edges: CanvasEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `timeline-${i}`,
        fromNode: nodes[i].id,
        toNode: nodes[i + 1].id,
        fromSide: 'right' as const,
        toSide: 'left' as const,
        color: '4'  // Timeline color
      });
    }

    return { nodes, edges };
  }

  /**
   * Generate decision tree canvas
   */
  async generateDecisionTree(rootNotePath: string): Promise<ObsidianCanvas> {
    const decisionStructure = await this.analyzeDecisionStructure(rootNotePath);
    
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];
    
    // Build tree structure
    await this.buildDecisionNodes(decisionStructure, nodes, edges);

    // Apply hierarchical layout
    const positionedNodes = CanvasLayoutEngine.hierarchicalLayout(nodes, edges, decisionStructure.rootId);

    return { 
      nodes: positionedNodes, 
      edges: CanvasLayoutEngine.optimizeEdgeConnections(positionedNodes, edges)
    };
  }

  /**
   * Extract CL notes from vault
   */
  private async getCLNotes(includeStates: string[], maxNodes: number): Promise<CLNote[]> {
    const notes: CLNote[] = [];
    await this.scanDirectoryForNotes(this.vaultPath, notes, includeStates);
    
    // Sort by state priority (crystal > gel > fluid > plasma) and limit
    const statePriority = { crystal: 4, gel: 3, fluid: 2, plasma: 1 };
    const sortedNotes = notes.sort((a, b) => 
      (statePriority[b.state] || 0) - (statePriority[a.state] || 0)
    );
    
    return sortedNotes.slice(0, maxNodes);
  }

  /**
   * Recursively scan directory for CL notes
   */
  private async scanDirectoryForNotes(
    dirPath: string, 
    notes: CLNote[], 
    includeStates: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and .git
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.scanDirectoryForNotes(fullPath, notes, includeStates);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const note = await this.parseNote(fullPath);
          if (note && includeStates.includes(note.state)) {
            notes.push(note);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Could not read directory ${dirPath}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Parse individual note for CL metadata
   */
  private async parseNote(filePath: string): Promise<CLNote | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      
      if (!frontmatterMatch) return null;
      
      const frontmatter = frontmatterMatch[1];
      const titleMatch = frontmatter.match(/title:\s*(.+)/);
      const stateMatch = frontmatter.match(/state:\s*(\w+)/);
      const confidenceMatch = frontmatter.match(/confidence:\s*(\w+)/);
      const createdMatch = frontmatter.match(/created:\s*(.+)/);
      const modifiedMatch = frontmatter.match(/modified:\s*(.+)/);
      
      if (!stateMatch || !['plasma', 'fluid', 'gel', 'crystal'].includes(stateMatch[1])) {
        return null;
      }
      
      const relativePath = path.relative(this.vaultPath, filePath).replace(/\\/g, '/');
      
      return {
        path: relativePath,
        title: titleMatch?.[1]?.trim() || path.basename(filePath, '.md'),
        state: stateMatch[1] as 'plasma' | 'fluid' | 'gel' | 'crystal',
        confidence: (confidenceMatch?.[1] as 'low' | 'medium' | 'high') || 'medium',
        created: createdMatch?.[1]?.trim() || new Date().toISOString(),
        modified: modifiedMatch?.[1]?.trim() || new Date().toISOString(),
        tags: this.extractTags(frontmatter),
        dependencies: this.extractDependencies(content)
      };
    } catch (error) {
      console.warn(`Error parsing note ${filePath}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Extract relationships between notes
   */
  private async extractRelationships(notes: CLNote[]): Promise<NoteRelationship[]> {
    const relationships: NoteRelationship[] = [];
    const notePathMap = new Map(notes.map(note => [note.path, note]));
    
    for (const note of notes) {
      // Extract wikilinks and explicit relations
      const noteContent = await this.readNoteContent(note.path);
      const wikilinks = this.extractWikilinks(noteContent);
      const explicitRelations = this.extractExplicitRelations(noteContent);
      
      // Process wikilinks as generic connections
      for (const link of wikilinks) {
        const targetPath = this.resolveWikilink(link, notes);
        if (targetPath && notePathMap.has(targetPath)) {
          relationships.push({
            source: note.path,
            target: targetPath,
            type: 'depends_on'  // Default relation type
          });
        }
      }
      
      // Process explicit relations
      for (const relation of explicitRelations) {
        const targetPath = this.resolveWikilink(relation.target, notes);
        if (targetPath && notePathMap.has(targetPath)) {
          relationships.push({
            source: note.path,
            target: targetPath,
            type: relation.type
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Apply layout algorithm to nodes
   */
  private applyLayout(
    nodes: CanvasNode[], 
    edges: CanvasEdge[], 
    algorithm: string
  ): CanvasNode[] {
    switch (algorithm) {
      case 'force-directed':
        return CanvasLayoutEngine.forceDirectedLayout(nodes, edges);
      case 'hierarchical':
        return CanvasLayoutEngine.hierarchicalLayout(nodes, edges);
      case 'circular':
        return CanvasLayoutEngine.circularLayout(nodes, edges);
      case 'grid':
        return CanvasLayoutEngine.gridLayout(nodes);
      default:
        return nodes;
    }
  }

  /**
   * Calculate node width based on content
   */
  private calculateNodeWidth(note: CLNote): number {
    return Math.max(180, Math.min(300, 180 + note.title.length * 2));
  }

  /**
   * Calculate node height based on state and content
   */
  private calculateNodeHeight(note: CLNote): number {
    const baseHeight = note.state === 'crystal' ? 120 : 100;
    return baseHeight;
  }

  /**
   * Extract topic key from path
   */
  private extractTopicKey(notePath: string): string {
    const pathParts = notePath.split('/');
    return pathParts[0] || 'general';
  }

  /**
   * Get vertical offset for state in timeline
   */
  private getStateVerticalOffset(state: string): number {
    const offsets: Record<string, number> = { crystal: -50, gel: 0, fluid: 50, plasma: 100 };
    return offsets[state] || 0;
  }

  /**
   * Sanitize node ID for canvas compatibility
   */
  private sanitizeNodeId(path: string): string {
    // Use a simpler approach - just replace problematic characters with underscores
    // and ensure it starts with a letter
    const sanitized = path.replace(/[^a-zA-Z0-9\/\-_.]/g, '_');
    // Ensure it starts with a letter or underscore
    return sanitized.match(/^[a-zA-Z_]/) ? sanitized : `node_${sanitized}`;
  }

  // Additional helper methods would be implemented here
  private async getProjectNotes(projectPath: string): Promise<CLNote[]> { 
    // Implementation for getting project-specific notes
    return [];
  }

  private async analyzeDecisionStructure(rootPath: string): Promise<any> {
    // Implementation for decision tree analysis
    return { rootId: this.sanitizeNodeId(rootPath) };
  }

  private async buildDecisionNodes(structure: any, nodes: CanvasNode[], edges: CanvasEdge[]): Promise<void> {
    // Implementation for building decision tree nodes
  }

  private extractTags(frontmatter: string): string[] {
    const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/s);
    if (tagsMatch) {
      return tagsMatch[1].split(',').map(tag => tag.trim().replace(/['"]/g, ''));
    }
    return [];
  }

  private extractDependencies(content: string): string[] {
    const depMatch = content.match(/dependencies:\s*\[(.*?)\]/s);
    if (depMatch) {
      return depMatch[1].split(',').map(dep => dep.trim().replace(/['"]/g, ''));
    }
    return [];
  }

  private async readNoteContent(notePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.vaultPath, notePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return '';
    }
  }

  private extractWikilinks(content: string): string[] {
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    
    while ((match = wikilinkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    return links;
  }

  private extractExplicitRelations(content: string): Array<{target: string, type: any}> {
    const relationRegex = /- (\w+) \[\[([^\]]+)\]\]/g;
    const relations: Array<{target: string, type: any}> = [];
    let match;
    
    while ((match = relationRegex.exec(content)) !== null) {
      const relationType = match[1];
      const target = match[2];
      
      // Map relation types
      const typeMapping: Record<string, string> = {
        'implements': 'implements',
        'depends_on': 'depends_on',
        'extends': 'extends',
        'part_of': 'part_of',
        'conflicts_with': 'conflicts_with'
      };
      
      if (typeMapping[relationType]) {
        relations.push({
          target,
          type: typeMapping[relationType] as any
        });
      }
    }
    
    return relations;
  }

  private resolveWikilink(link: string, notes: CLNote[]): string | null {
    // Simple resolution - find note with matching title or filename
    for (const note of notes) {
      if (note.title === link || path.basename(note.path, '.md') === link) {
        return note.path;
      }
    }
    return null;
  }
}
