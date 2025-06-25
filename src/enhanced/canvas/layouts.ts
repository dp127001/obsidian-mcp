/**
 * Layout Algorithms
 * Core layout algorithms for canvas node positioning
 */

import type { 
  CanvasNode, 
  CanvasEdge, 
  ForceDirectedOptions,
  PhysicsNode 
} from './types.js';

export class CanvasLayoutEngine {
  /**
   * Enhanced Force-directed layout with CL state-based physics
   * Creates intelligent clustering based on CL methodology using D3.js-style physics
   */
  static forceDirectedLayout(
    nodes: CanvasNode[], 
    edges: CanvasEdge[], 
    options: ForceDirectedOptions = {}
  ): CanvasNode[] {
    const {
      iterations = 300,
      repulsionStrength = 1000,
      attractionStrength = 0.1,
      damping = 0.85,
      canvasWidth = 2000,
      canvasHeight = 1500
    } = options;

    // Initialize positions with CL state-based radial positioning
    const physicsNodes: PhysicsNode[] = nodes.map(node => {
      const clNode = node as any; // Type assertion for CL properties
      const initialPosition = this.calculateCLInitialPosition(clNode, canvasWidth, canvasHeight);
      
      return {
        ...node,
        x: node.x || initialPosition.x,
        y: node.y || initialPosition.y,
        vx: 0, 
        vy: 0
      };
    });

    // Enhanced physics simulation with CL state awareness
    for (let iter = 0; iter < iterations; iter++) {
      const alpha = Math.max(0.01, 1 - (iter / iterations)); // Cooling factor
      
      // Calculate CL state-based repulsion forces
      for (let i = 0; i < physicsNodes.length; i++) {
        for (let j = i + 1; j < physicsNodes.length; j++) {
          const nodeA = physicsNodes[i];
          const nodeB = physicsNodes[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // CL state-based charge calculation
          const chargeA = this.calculateCLNodeCharge(nodeA as any);
          const chargeB = this.calculateCLNodeCharge(nodeB as any);
          const combinedCharge = Math.sqrt(Math.abs(chargeA * chargeB));
          
          const force = (combinedCharge * repulsionStrength) / (distance * distance);
          const fx = (dx / distance) * force * alpha;
          const fy = (dy / distance) * force * alpha;
          
          nodeA.vx -= fx;
          nodeA.vy -= fy;
          nodeB.vx += fx;
          nodeB.vy += fy;
        }
      }

      // Calculate CL relationship-based attraction forces
      for (const edge of edges) {
        const nodeA = physicsNodes.find(n => n.id === edge.fromNode);
        const nodeB = physicsNodes.find(n => n.id === edge.toNode);
        
        if (nodeA && nodeB) {
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // CL relationship-based link distance and strength
          const linkDistance = this.calculateCLLinkDistance(edge as any, nodeA as any, nodeB as any);
          const linkStrength = this.calculateCLLinkStrength(edge as any, nodeA as any, nodeB as any);
          
          const force = linkStrength * attractionStrength * (distance - linkDistance) * alpha;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          nodeA.vx += fx;
          nodeA.vy += fy;
          nodeB.vx -= fx;
          nodeB.vy -= fy;
        }
      }

      // Apply CL state-based radial positioning force (weak centering)
      for (const node of physicsNodes) {
        const radialForce = this.calculateCLRadialForce(node as any, canvasWidth, canvasHeight);
        node.vx += radialForce.fx * alpha * 0.1;
        node.vy += radialForce.fy * alpha * 0.1;
      }

      // Apply collision detection based on node size
      for (let i = 0; i < physicsNodes.length; i++) {
        for (let j = i + 1; j < physicsNodes.length; j++) {
          const nodeA = physicsNodes[i];
          const nodeB = physicsNodes[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const minDistance = this.calculateCLCollisionRadius(nodeA as any) + 
                             this.calculateCLCollisionRadius(nodeB as any) + 20;
          
          if (distance < minDistance && distance > 0) {
            const overlap = minDistance - distance;
            const fx = (dx / distance) * overlap * 0.5;
            const fy = (dy / distance) * overlap * 0.5;
            
            nodeA.vx -= fx;
            nodeA.vy -= fy;
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }

      // Update positions and apply damping
      for (const node of physicsNodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= damping;
        node.vy *= damping;
        
        // Keep nodes within canvas bounds with margin
        const margin = this.calculateCLCollisionRadius(node as any) + 50;
        node.x = Math.max(margin, Math.min(canvasWidth - margin, node.x));
        node.y = Math.max(margin, Math.min(canvasHeight - margin, node.y));
      }

      // Early convergence check
      const totalKineticEnergy = physicsNodes.reduce((energy, node) => 
        energy + (node.vx * node.vx + node.vy * node.vy), 0);
      
      if (totalKineticEnergy < 0.01) {
        console.log(`Force simulation converged early at iteration ${iter}`);
        break;
      }
    }

    // Remove velocity properties and return clean nodes
    return physicsNodes.map(({ vx, vy, ...node }) => node);
  }

  /**
   * Calculate CL state-based initial positioning (radial by state)
   */
  private static calculateCLInitialPosition(node: any, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // State-based radial positioning
    const stateRadii: Record<string, number> = {
      'crystal': 80,   // Center - authoritative knowledge
      'gel': 200,      // Inner ring - working conclusions  
      'fluid': 350,    // Outer ring - active exploration
      'plasma': 450    // Periphery - rejected approaches
    };
    
    const radius = stateRadii[node.clState || 'fluid'] || 250;
    
    // Add randomness to prevent perfect circles
    const angle = Math.random() * 2 * Math.PI;
    const variance = (Math.random() - 0.5) * 100;
    
    return {
      x: centerX + (radius + variance) * Math.cos(angle),
      y: centerY + (radius + variance) * Math.sin(angle)
    };
  }

  /**
   * Calculate CL state-based node charge (repulsion strength)
   */
  private static calculateCLNodeCharge(node: any): number {
    const stateCharges: Record<string, number> = {
      'crystal': -1200,  // Strong repulsion - authoritative nodes need space
      'gel': -800,       // Medium repulsion - working conclusions
      'fluid': -400,     // Weak repulsion - allow close clustering
      'plasma': -200     // Minimal repulsion - lessons learned can cluster
    };
    
    // Confidence-based multipliers
    const confidenceMultipliers: Record<string, number> = {
      'high': 1.3,
      'medium': 1.0,
      'low': 0.7
    };
    
    const baseCharge = stateCharges[node.clState || 'fluid'] || -600;
    const confidenceMultiplier = confidenceMultipliers[node.confidence || 'medium'] || 1.0;
    
    return baseCharge * confidenceMultiplier;
  }

  /**
   * Calculate CL relationship-based link distance
   */
  private static calculateCLLinkDistance(edge: any, sourceNode: any, targetNode: any): number {
    // Base distances for different relationship types
    const relationshipDistances: Record<string, number> = {
      'implements': 60,      // Strong technical relationship
      'depends_on': 80,      // Dependency relationship
      'extends': 100,        // Evolutionary relationship
      'part_of': 70,         // Hierarchical relationship
      'conflicts_with': 200,  // Keep conflicting ideas separated
      'relates_to': 120      // General relationship
    };
    
    // CL state compatibility factor
    const stateCompatibility = this.calculateCLStateCompatibility(
      sourceNode.clState || 'fluid', 
      targetNode.clState || 'fluid'
    );
    
    const baseDistance = relationshipDistances[edge.relationType || 'relates_to'] || 120;
    return baseDistance * stateCompatibility;
  }

  /**
   * Calculate CL relationship-based link strength
   */
  private static calculateCLLinkStrength(edge: any, sourceNode: any, targetNode: any): number {
    // Base strengths for different relationship types
    const relationshipStrengths: Record<string, number> = {
      'implements': 1.5,     // Strong attraction
      'depends_on': 1.3,     // Strong dependency attraction
      'extends': 1.1,        // Medium attraction
      'part_of': 1.4,        // Strong hierarchical attraction
      'conflicts_with': 0.3, // Weak attraction (mainly for visibility)
      'relates_to': 0.8      // Medium attraction
    };
    
    const baseStrength = relationshipStrengths[edge.relationType || 'relates_to'] || 1.0;
    const stateCompatibility = this.calculateCLStateCompatibility(
      sourceNode.clState || 'fluid', 
      targetNode.clState || 'fluid'
    );
    
    return baseStrength / stateCompatibility; // Inverse relationship with compatibility
  }

  /**
   * Calculate CL state compatibility matrix
   */
  private static calculateCLStateCompatibility(sourceState: string, targetState: string): number {
    const compatibility: Record<string, number> = {
      'crystal-crystal': 1.2,  // Crystal notes should maintain some distance
      'crystal-gel': 0.9,      // High compatibility - gel supports crystal
      'crystal-fluid': 1.1,    // Medium compatibility - exploration informs decisions
      'crystal-plasma': 1.8,   // Low compatibility - keep failures away from authority
      'gel-gel': 0.8,          // Gel notes can cluster closely
      'gel-fluid': 0.9,        // Good compatibility - working conclusions with exploration
      'gel-plasma': 1.4,       // Medium compatibility - learn from failures
      'fluid-fluid': 0.7,      // Fluid notes cluster very closely - brainstorming space
      'fluid-plasma': 1.0,     // Normal compatibility - exploration includes failures
      'plasma-plasma': 0.9     // Plasma notes can cluster - lessons learned together
    };
    
    const key = `${sourceState}-${targetState}`;
    const reverseKey = `${targetState}-${sourceState}`;
    return compatibility[key] || compatibility[reverseKey] || 1.0;
  }

  /**
   * Calculate CL state-based radial force (weak centering by state)
   */
  private static calculateCLRadialForce(node: any, canvasWidth: number, canvasHeight: number): { fx: number; fy: number } {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Target radius for each state
    const targetRadii: Record<string, number> = {
      'crystal': 100,
      'gel': 220,
      'fluid': 380,
      'plasma': 500
    };
    
    const targetRadius = targetRadii[node.clState || 'fluid'] || 300;
    
    const dx = centerX - node.x;
    const dy = centerY - node.y;
    const currentDistance = Math.sqrt(dx * dx + dy * dy) || 1;
    
    // Force toward target radius
    const radiusError = currentDistance - targetRadius;
    const force = radiusError * 0.001; // Weak force
    
    return {
      fx: (dx / currentDistance) * force,
      fy: (dy / currentDistance) * force
    };
  }

  /**
   * Calculate CL-aware collision radius
   */
  private static calculateCLCollisionRadius(node: any): number {
    // Base size on node dimensions
    const baseRadius = Math.max(node.width, node.height) / 2;
    
    // State-based size multipliers
    const stateMultipliers: Record<string, number> = {
      'crystal': 1.4,  // Crystal nodes larger - more important
      'gel': 1.2,      // Gel nodes slightly larger
      'fluid': 1.0,    // Normal size
      'plasma': 0.8    // Smaller - less prominent
    };
    
    const stateMultiplier = stateMultipliers[node.clState || 'fluid'] || 1.0;
    return Math.min(baseRadius * stateMultiplier, 100); // Max collision radius
  }

  /**
   * Hierarchical layout for tree-like structures
   * Shows clear progression and dependencies
   */
  static hierarchicalLayout(
    nodes: CanvasNode[], 
    edges: CanvasEdge[],
    rootNodeId?: string
  ): CanvasNode[] {
    // Build adjacency list and calculate in-degrees
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }
    
    for (const edge of edges) {
      adjacency.get(edge.fromNode)?.push(edge.toNode);
      inDegree.set(edge.toNode, (inDegree.get(edge.toNode) || 0) + 1);
    }

    // Find root nodes or use specified root
    const roots = rootNodeId 
      ? [rootNodeId]
      : nodes.filter(node => inDegree.get(node.id) === 0).map(n => n.id);

    // If no natural roots, pick nodes with highest out-degree
    if (roots.length === 0) {
      const outDegrees = new Map<string, number>();
      for (const [nodeId, children] of adjacency) {
        outDegrees.set(nodeId, children.length);
      }
      
      const maxOutDegree = Math.max(...Array.from(outDegrees.values()));
      roots.push(...Array.from(outDegrees.entries())
        .filter(([_, degree]) => degree === maxOutDegree)
        .map(([nodeId, _]) => nodeId));
    }

    // Assign levels using BFS
    const levels = new Map<string, number>();
    const positioned = new Set<string>();
    
    function assignLevels(nodeId: string, level: number) {
      if (positioned.has(nodeId)) return;
      
      levels.set(nodeId, level);
      positioned.add(nodeId);
      
      const children = adjacency.get(nodeId) || [];
      for (const child of children) {
        assignLevels(child, level + 1);
      }
    }

    // Assign levels starting from roots
    for (const root of roots) {
      assignLevels(root, 0);
    }

    // Handle orphaned nodes
    for (const node of nodes) {
      if (!positioned.has(node.id)) {
        levels.set(node.id, 0);
      }
    }

    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    for (const [nodeId, level] of levels) {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    }

    // Position nodes based on levels
    const levelSpacing = 300;
    const nodeSpacing = 200;
    
    return nodes.map(node => {
      const level = levels.get(node.id) || 0;
      const levelNodes = levelGroups.get(level) || [];
      const indexInLevel = levelNodes.indexOf(node.id);
      
      // Center the level horizontally
      const levelWidth = (levelNodes.length - 1) * nodeSpacing;
      const startX = Math.max(100, (2000 - levelWidth) / 2);
      
      return {
        ...node,
        x: startX + indexInLevel * nodeSpacing,
        y: 100 + level * levelSpacing
      };
    });
  }

  /**
   * Grid layout for organized display
   * Systematic arrangement for overview purposes
   */
  static gridLayout(
    nodes: CanvasNode[], 
    options: { columns?: number; spacing?: number } = {}
  ): CanvasNode[] {
    const { columns = 5, spacing = 250 } = options;
    
    return nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      
      return {
        ...node,
        x: 100 + col * spacing,
        y: 100 + row * spacing
      };
    });
  }

  /**
   * Circular layout for topic-centered visualization
   * Good for showing relationships around central concepts
   */
  static circularLayout(
    nodes: CanvasNode[], 
    edges: CanvasEdge[],
    options: { centerX?: number; centerY?: number; radius?: number } = {}
  ): CanvasNode[] {
    const { 
      centerX = 600, 
      centerY = 400, 
      radius = 300
    } = options;

    if (nodes.length === 0) return nodes;

    // Simple circular arrangement
    const angleStep = (2 * Math.PI) / nodes.length;
    
    return nodes.map((node, index) => ({
      ...node,
      x: centerX + radius * Math.cos(index * angleStep),
      y: centerY + radius * Math.sin(index * angleStep)
    }));
  }

  /**
   * Calculate optimal canvas bounds for given nodes
   */
  static calculateCanvasBounds(nodes: CanvasNode[]): { width: number; height: number } {
    if (nodes.length === 0) {
      return { width: 1000, height: 800 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of nodes) {
      const nodeLeft = node.x - node.width / 2;
      const nodeRight = node.x + node.width / 2;
      const nodeTop = node.y - node.height / 2;
      const nodeBottom = node.y + node.height / 2;

      minX = Math.min(minX, nodeLeft);
      maxX = Math.max(maxX, nodeRight);
      minY = Math.min(minY, nodeTop);
      maxY = Math.max(maxY, nodeBottom);
    }

    const padding = 100;
    return {
      width: Math.max(1000, maxX - minX + padding * 2),
      height: Math.max(800, maxY - minY + padding * 2)
    };
  }

  /**
   * Optimize edge connection points to minimize overlaps
   */
  static optimizeEdgeConnections(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasEdge[] {
    return edges.map(edge => {
      const fromNode = nodes.find(n => n.id === edge.fromNode);
      const toNode = nodes.find(n => n.id === edge.toNode);
      
      if (!fromNode || !toNode) return edge;

      // Calculate optimal connection sides based on relative positions
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      
      let fromSide: 'top' | 'right' | 'bottom' | 'left';
      let toSide: 'top' | 'right' | 'bottom' | 'left';
      
      // Determine connection sides based on direction
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal connection
        fromSide = dx > 0 ? 'right' : 'left';
        toSide = dx > 0 ? 'left' : 'right';
      } else {
        // Vertical connection
        fromSide = dy > 0 ? 'bottom' : 'top';
        toSide = dy > 0 ? 'top' : 'bottom';
      }
      
      return {
        ...edge,
        fromSide,
        toSide
      };
    });
  }
}
