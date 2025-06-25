/**
 * Canvas Types and Interfaces
 * Core data models for Obsidian canvas generation with CL methodology integration
 */

// Core Obsidian canvas format interfaces
export interface ObsidianCanvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  // Enhanced canvas metadata for interactive features
  metadata?: CanvasMetadata;
}

export interface CanvasMetadata {
  version: string;                     // Canvas format version
  generatedBy: string;                 // Tool that generated the canvas
  generatedAt: string;                 // Generation timestamp
  interactive?: InteractivityConfig;   // Interactive feature configuration
  physics?: PhysicsConfig;             // Physics simulation parameters
  layout?: LayoutConfig;               // Layout algorithm configuration
}

export interface InteractivityConfig {
  enabled: boolean;                    // Enable interactive features
  zoom?: ZoomConfig;                   // Zoom configuration
  pan?: PanConfig;                     // Pan configuration
  drag?: DragConfig;                   // Drag configuration
  selection?: SelectionConfig;         // Node selection configuration
}

export interface ZoomConfig {
  enabled: boolean;
  minScale: number;                    // Minimum zoom level (e.g., 0.1)
  maxScale: number;                    // Maximum zoom level (e.g., 3.0)
  wheelSensitivity: number;            // Mouse wheel sensitivity
  touchSensitivity: number;            // Touch zoom sensitivity
}

export interface PanConfig {
  enabled: boolean;
  constrainToBounds: boolean;          // Keep view within canvas bounds
  momentum: boolean;                   // Enable momentum scrolling
  mousePan: boolean;                   // Enable mouse drag panning
  touchPan: boolean;                   // Enable touch panning
}

export interface DragConfig {
  enabled: boolean;
  nodes: boolean;                      // Enable node dragging
  constrainToCanvas: boolean;          // Keep dragged nodes within canvas
  snapToGrid: boolean;                 // Snap to grid during drag
  gridSize: number;                    // Grid size for snapping
  physics: boolean;                    // Enable physics during drag
}

export interface SelectionConfig {
  enabled: boolean;
  multiSelect: boolean;                // Enable multiple node selection
  rubberBand: boolean;                 // Enable rubber band selection
  keyboardShortcuts: boolean;          // Enable keyboard shortcuts
}

export interface PhysicsConfig {
  enabled: boolean;                    // Enable physics simulation
  algorithm: 'force-directed' | 'none'; // Physics algorithm
  parameters: ForceDirectedOptions;   // Algorithm-specific parameters
  realTime: boolean;                   // Enable real-time physics updates
  convergenceCallback?: string;        // JavaScript callback when converged
}

export interface LayoutConfig {
  algorithm: string;                   // Layout algorithm used
  parameters: Record<string, any>;     // Algorithm parameters
  timestamp: string;                   // When layout was applied
  performance: PerformanceMetrics;     // Generation performance metrics
}

export interface PerformanceMetrics {
  generationTimeMs: number;
  nodeCount: number;
  edgeCount: number;
  iterations?: number;                 // For physics-based layouts
  convergenceTime?: number;            // Time to convergence
}

export interface CanvasNode {
  id: string;                    // Unique identifier
  type: 'file' | 'text' | 'group';
  x: number; y: number;          // Position coordinates
  width: number; height: number; // Dimensions
  color?: string;                // Node color (0-6 for Obsidian colors)
  file?: string;                 // Path to linked note (for file nodes)
  text?: string;                 // Embedded text content (for text nodes)
}

export interface CanvasEdge {
  id: string;                    // Unique identifier
  fromNode: string;              // Source node ID
  toNode: string;                // Target node ID
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toSide: 'top' | 'right' | 'bottom' | 'left';
  color?: string;                // Edge color
  label?: string;                // Edge label
}

// CL-specific canvas types
export interface CLCanvasNode extends CanvasNode {
  clState?: 'plasma' | 'fluid' | 'gel' | 'crystal';
  confidence?: 'low' | 'medium' | 'high';
  topicKey?: string;
}

export interface CLCanvasEdge extends CanvasEdge {
  relationType?: 'depends_on' | 'implements' | 'extends' | 'part_of' | 'conflicts_with';
}

// Layout and generation options
export interface CanvasLayoutOptions {
  algorithm: 'force-directed' | 'hierarchical' | 'circular' | 'grid' | 'timeline';
  spacing: number;               // Node spacing multiplier
  colorScheme: 'cl-states' | 'topics' | 'confidence' | 'custom';
  includeOrphans: boolean;       // Include notes without connections
  maxNodes: number;              // Limit for performance
  // Enhanced interactive options
  enableInteractivity?: boolean; // Enable zoom, pan, drag features
  initialZoom?: number;          // Initial zoom level (0.1-3.0)
  zoomExtent?: [number, number]; // Min/max zoom levels
  panEnabled?: boolean;          // Enable pan navigation
  dragEnabled?: boolean;         // Enable node dragging
  dragConstraints?: {            // Drag behavior constraints
    lockX?: boolean;             // Lock horizontal dragging
    lockY?: boolean;             // Lock vertical dragging
    boundToCanvas?: boolean;     // Keep nodes within canvas bounds
  };
}

export interface CanvasGenerationResult {
  canvas: ObsidianCanvas;
  filePath: string;
  nodeCount: number;
  edgeCount: number;
  layoutUsed: string;
  processingTimeMs: number;
}

// Layout-specific options
export interface ForceDirectedOptions {
  iterations?: number;
  repulsionStrength?: number;
  attractionStrength?: number;
  damping?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  // Enhanced CL-aware physics options
  enableCLPhysics?: boolean;          // Enable CL state-based physics calculations
  stateRadialForce?: number;          // Strength of radial positioning by state (0-1)
  relationshipForceScale?: number;    // Scale factor for relationship-based forces
  collisionDetection?: boolean;       // Enable collision detection between nodes
  convergenceThreshold?: number;      // Kinetic energy threshold for early convergence
  coolingRate?: number;               // Alpha cooling rate (0-1, higher = faster cooling)
}

export interface CircularLayoutOptions {
  centerX?: number;
  centerY?: number;
  radius?: number;
  groupByTopic?: boolean;
}

export interface TimelineLayoutOptions {
  direction?: 'horizontal' | 'vertical';
  spacing?: number;
  stateVerticalOffset?: boolean;
  startX?: number;
  startY?: number;
}

// CL-specific network options
export interface CLNetworkOptions {
  includeStates?: ('plasma' | 'fluid' | 'gel' | 'crystal')[];
  maxNodes?: number;
  layoutAlgorithm?: 'force-directed' | 'hierarchical' | 'circular' | 'grid' | 'timeline';
  groupByTopic?: boolean;
}

// Canvas templates
export interface CanvasTemplate {
  name: string;
  description: string;
  defaultOptions: Partial<CanvasGenerationOptions>;
}

export interface CanvasGenerationOptions {
  layoutAlgorithm: string;
  includeStates: string[];
  colorScheme: string;
  maxNodes: number;
  projectPath?: string;
  rootNotePath?: string;
  groupByTopic?: boolean;
  showAlternatives?: boolean;
}

// Validation results
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Performance monitoring
export interface PerformanceMetric {
  timestamp: number;
  type: string;
  nodeCount: number;
  edgeCount: number;
  processingTime: number;
  memoryUsage: number;
}

export interface PerformanceStats {
  count: number;
  avgProcessingTime: number;
  avgNodeCount: number;
  avgEdgeCount: number;
  maxProcessingTime?: number;
  minProcessingTime?: number;
}

// CL note representation for canvas analysis
export interface CLNote {
  path: string;
  title: string;
  state: 'plasma' | 'fluid' | 'gel' | 'crystal';
  confidence: 'low' | 'medium' | 'high';
  created: string;
  modified: string;
  tags?: string[];
  dependencies?: string[];
}

// Relationship extraction
export interface NoteRelationship {
  source: string;
  target: string;
  type: 'depends_on' | 'implements' | 'extends' | 'part_of' | 'conflicts_with';
}

// Node physics for force-directed layout
export interface PhysicsNode extends CanvasNode {
  vx: number;  // X velocity
  vy: number;  // Y velocity
}
