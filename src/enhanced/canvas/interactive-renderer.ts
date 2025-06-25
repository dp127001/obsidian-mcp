/**
 * Interactive Canvas Renderer
 * D3.js-style interactive features for enhanced force-directed layouts
 */

import type { 
  ObsidianCanvas, 
  CanvasNode, 
  CanvasEdge, 
  CanvasLayoutOptions,
  CLCanvasNode 
} from './types.js';

export interface InteractiveCanvasOptions {
  enableZoom?: boolean;          // Enable zoom functionality
  enablePan?: boolean;           // Enable pan functionality  
  enableDrag?: boolean;          // Enable node dragging
  zoomExtent?: [number, number]; // [min, max] zoom levels
  initialZoom?: number;          // Initial zoom level
  width?: number;                // Canvas width
  height?: number;               // Canvas height
  onNodeClick?: (node: CanvasNode) => void;     // Node click handler
  onNodeDrag?: (node: CanvasNode) => void;      // Node drag handler
  onZoomChange?: (zoomLevel: number) => void;   // Zoom change handler
}

export class InteractiveCanvasRenderer {
  private canvas: ObsidianCanvas;
  private options: InteractiveCanvasOptions;
  private currentZoom: number = 1.0;
  private currentPan: { x: number; y: number } = { x: 0, y: 0 };
  private isDragging: boolean = false;
  private draggedNode: CanvasNode | null = null;

  constructor(canvas: ObsidianCanvas, options: InteractiveCanvasOptions = {}) {
    this.canvas = canvas;
    this.options = {
      enableZoom: true,
      enablePan: true,
      enableDrag: true,
      zoomExtent: [0.1, 3.0],
      initialZoom: 1.0,
      width: 2000,
      height: 1500,
      ...options
    };
    this.currentZoom = this.options.initialZoom || 1.0;
  }

  /**
   * Generate interactive HTML canvas with D3.js-style controls
   */
  generateInteractiveHTML(): string {
    const { width, height } = this.options;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Knowledge Graph</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1a1a1a;
            color: #e0e0e0;
            overflow: hidden;
        }
        
        .canvas-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            cursor: grab;
        }
        
        .canvas-container.panning {
            cursor: grabbing;
        }
        
        .canvas-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        
        .node {
            cursor: pointer;
            transition: all 0.2s ease;
            filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));
        }
        
        .node:hover {
            filter: drop-shadow(4px 4px 8px rgba(0,0,0,0.5));
            transform: scale(1.05);
        }
        
        .node.dragging {
            cursor: grabbing;
            filter: drop-shadow(6px 6px 12px rgba(0,0,0,0.7));
        }
        
        .edge {
            stroke-opacity: 0.6;
            stroke-width: 2;
            transition: stroke-opacity 0.2s ease;
        }
        
        .edge.highlighted {
            stroke-opacity: 1.0;
            stroke-width: 3;
        }
        
        .node-label {
            font-size: 12px;
            font-weight: 600;
            text-anchor: middle;
            pointer-events: none;
            fill: #ffffff;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        }
        
        .controls {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
        }
        
        .control-button {
            background: rgba(45, 45, 45, 0.9);
            border: 1px solid #555;
            color: #e0e0e0;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
        }
        
        .control-button:hover {
            background: rgba(60, 60, 60, 0.9);
            border-color: #777;
        }
        
        .zoom-info {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(45, 45, 45, 0.9);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid #555;
        }
        
        .legend {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(45, 45, 45, 0.9);
            padding: 15px;
            border-radius: 8px;
            font-size: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid #555;
            max-width: 200px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            margin-right: 10px;
            border: 1px solid #666;
        }
    </style>
</head>
<body>
    <div class="canvas-container" id="canvasContainer">
        <svg class="canvas-svg" id="canvasSvg" width="${width}" height="${height}">
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge> 
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                
                <linearGradient id="crystalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#4ade80"/>
                    <stop offset="100%" style="stop-color:#22c55e"/>
                </linearGradient>
                
                <linearGradient id="gelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#fbbf24"/>
                    <stop offset="100%" style="stop-color:#f59e0b"/>
                </linearGradient>
                
                <linearGradient id="fluidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#60a5fa"/>
                    <stop offset="100%" style="stop-color:#3b82f6"/>
                </linearGradient>
                
                <linearGradient id="plasmaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#f87171"/>
                    <stop offset="100%" style="stop-color:#ef4444"/>
                </linearGradient>
            </defs>
            
            <g id="viewport">
                <g id="edges"></g>
                <g id="nodes"></g>
            </g>
        </svg>
        
        <div class="controls">
            <button class="control-button" onclick="zoomIn()">Zoom In (+)</button>
            <button class="control-button" onclick="zoomOut()">Zoom Out (-)</button>
            <button class="control-button" onclick="resetView()">Reset View</button>
            <button class="control-button" onclick="fitToNodes()">Fit All</button>
        </div>
        
        <div class="zoom-info" id="zoomInfo">
            Zoom: <span id="zoomLevel">100%</span> | 
            Nodes: <span id="nodeCount">${this.canvas.nodes.length}</span>
        </div>
        
        <div class="legend">
            <div style="font-weight: bold; margin-bottom: 12px;">CL Knowledge States</div>
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #4ade80, #22c55e);"></div>
                <span>Crystal - Authoritative</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);"></div>
                <span>Gel - Working Conclusions</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #60a5fa, #3b82f6);"></div>
                <span>Fluid - Active Exploration</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #f87171, #ef4444);"></div>
                <span>Plasma - Rejected/Lessons</span>
            </div>
        </div>
    </div>

    <script>
        // Interactive canvas implementation
        ${this.generateInteractiveScript()}
    </script>
</body>
</html>`;
  }

  /**
   * Generate JavaScript for interactive functionality
   */
  private generateInteractiveScript(): string {
    return `
        // Canvas data
        const nodes = ${JSON.stringify(this.canvas.nodes)};
        const edges = ${JSON.stringify(this.canvas.edges)};
        
        // Interactive state
        let currentZoom = ${this.currentZoom};
        let currentPan = { x: ${this.currentPan.x}, y: ${this.currentPan.y} };
        let isDragging = false;
        let isPanning = false;
        let draggedNode = null;
        let lastMousePos = { x: 0, y: 0 };
        
        // DOM elements
        const svg = document.getElementById('canvasSvg');
        const viewport = document.getElementById('viewport');
        const container = document.getElementById('canvasContainer');
        const zoomLevelDisplay = document.getElementById('zoomLevel');
        const nodeCountDisplay = document.getElementById('nodeCount');
        
        // Zoom constraints
        const zoomExtent = [${this.options.zoomExtent![0]}, ${this.options.zoomExtent![1]}];
        
        // Initialize canvas
        function initializeCanvas() {
            renderNodes();
            renderEdges();
            updateTransform();
            updateZoomDisplay();
            
            // Add event listeners
            setupEventListeners();
        }
        
        // Render nodes with CL state styling
        function renderNodes() {
            const nodesGroup = document.getElementById('nodes');
            nodesGroup.innerHTML = '';
            
            nodes.forEach(node => {
                const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeGroup.classList.add('node');
                nodeGroup.setAttribute('data-node-id', node.id);
                
                // Get CL state styling
                const style = getCLStateStyle(node);
                
                // Create node rectangle
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', node.x - node.width/2);
                rect.setAttribute('y', node.y - node.height/2);
                rect.setAttribute('width', node.width);
                rect.setAttribute('height', node.height);
                rect.setAttribute('fill', style.fill);
                rect.setAttribute('stroke', style.stroke);
                rect.setAttribute('stroke-width', style.strokeWidth);
                rect.setAttribute('rx', '8');
                rect.setAttribute('ry', '8');
                rect.setAttribute('opacity', style.opacity);
                
                // Create node label
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.classList.add('node-label');
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + 5);
                text.textContent = node.file ? 
                    node.file.split('/').pop().replace('.md', '') : 
                    'Text Node';
                
                nodeGroup.appendChild(rect);
                nodeGroup.appendChild(text);
                nodesGroup.appendChild(nodeGroup);
                
                // Add interactivity
                setupNodeInteractivity(nodeGroup, node);
            });
        }
        
        // Render edges with relationship styling
        function renderEdges() {
            const edgesGroup = document.getElementById('edges');
            edgesGroup.innerHTML = '';
            
            edges.forEach(edge => {
                const fromNode = nodes.find(n => n.id === edge.fromNode);
                const toNode = nodes.find(n => n.id === edge.toNode);
                
                if (fromNode && toNode) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.classList.add('edge');
                    line.setAttribute('x1', fromNode.x);
                    line.setAttribute('y1', fromNode.y);
                    line.setAttribute('x2', toNode.x);
                    line.setAttribute('y2', toNode.y);
                    line.setAttribute('stroke', getEdgeColor(edge));
                    line.setAttribute('data-edge-id', edge.id);
                    
                    edgesGroup.appendChild(line);
                }
            });
        }
        
        // Get CL state visual styling
        function getCLStateStyle(node) {
            const clState = node.clState || 'fluid';
            const confidence = node.confidence || 'medium';
            
            const styles = {
                crystal: {
                    fill: 'url(#crystalGradient)',
                    stroke: '#166534',
                    strokeWidth: '3',
                    opacity: '0.95'
                },
                gel: {
                    fill: 'url(#gelGradient)',
                    stroke: '#92400e',
                    strokeWidth: '2',
                    opacity: '0.90'
                },
                fluid: {
                    fill: 'url(#fluidGradient)',
                    stroke: '#1e40af',
                    strokeWidth: '2',
                    opacity: '0.85'
                },
                plasma: {
                    fill: 'url(#plasmaGradient)',
                    stroke: '#991b1b',
                    strokeWidth: '1',
                    opacity: '0.75'
                }
            };
            
            return styles[clState] || styles.fluid;
        }
        
        // Get edge color based on relationship type
        function getEdgeColor(edge) {
            const relationColors = {
                'implements': '#22c55e',
                'depends_on': '#3b82f6',
                'extends': '#8b5cf6',
                'part_of': '#f59e0b',
                'conflicts_with': '#ef4444',
                'relates_to': '#6b7280'
            };
            
            return relationColors[edge.relationType] || '#6b7280';
        }
        
        // Setup node interactivity
        function setupNodeInteractivity(nodeElement, node) {
            nodeElement.addEventListener('mousedown', (e) => {
                if (${this.options.enableDrag}) {
                    e.stopPropagation();
                    isDragging = true;
                    draggedNode = node;
                    nodeElement.classList.add('dragging');
                    lastMousePos = { x: e.clientX, y: e.clientY };
                }
            });
            
            nodeElement.addEventListener('click', (e) => {
                e.stopPropagation();
                highlightConnectedNodes(node);
                ${this.options.onNodeClick ? 'onNodeClick(node);' : ''}
            });
            
            nodeElement.addEventListener('mouseenter', () => {
                highlightConnectedEdges(node);
            });
            
            nodeElement.addEventListener('mouseleave', () => {
                clearHighlights();
            });
        }
        
        // Setup global event listeners
        function setupEventListeners() {
            // Mouse events for pan and drag
            svg.addEventListener('mousedown', (e) => {
                if (!isDragging && ${this.options.enablePan}) {
                    isPanning = true;
                    container.classList.add('panning');
                    lastMousePos = { x: e.clientX, y: e.clientY };
                }
            });
            
            svg.addEventListener('mousemove', (e) => {
                if (isDragging && draggedNode) {
                    // Node dragging
                    const deltaX = (e.clientX - lastMousePos.x) / currentZoom;
                    const deltaY = (e.clientY - lastMousePos.y) / currentZoom;
                    
                    draggedNode.x += deltaX;
                    draggedNode.y += deltaY;
                    
                    updateNodePosition(draggedNode);
                    updateConnectedEdges(draggedNode);
                    
                    lastMousePos = { x: e.clientX, y: e.clientY };
                    
                } else if (isPanning) {
                    // Canvas panning
                    const deltaX = e.clientX - lastMousePos.x;
                    const deltaY = e.clientY - lastMousePos.y;
                    
                    currentPan.x += deltaX;
                    currentPan.y += deltaY;
                    
                    updateTransform();
                    lastMousePos = { x: e.clientX, y: e.clientY };
                }
            });
            
            svg.addEventListener('mouseup', () => {
                if (isDragging && draggedNode) {
                    const nodeElement = document.querySelector('[data-node-id="' + draggedNode.id + '"]');
                    nodeElement.classList.remove('dragging');
                    ${this.options.onNodeDrag ? 'onNodeDrag(draggedNode);' : ''}
                }
                
                isDragging = false;
                isPanning = false;
                draggedNode = null;
                container.classList.remove('panning');
            });
            
            // Wheel event for zooming
            svg.addEventListener('wheel', (e) => {
                if (${this.options.enableZoom}) {
                    e.preventDefault();
                    
                    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                    const newZoom = Math.max(zoomExtent[0], Math.min(zoomExtent[1], currentZoom * zoomFactor));
                    
                    if (newZoom !== currentZoom) {
                        // Zoom toward mouse position
                        const rect = svg.getBoundingClientRect();
                        const mouseX = e.clientX - rect.left;
                        const mouseY = e.clientY - rect.top;
                        
                        const zoomRatio = newZoom / currentZoom;
                        currentPan.x = mouseX - (mouseX - currentPan.x) * zoomRatio;
                        currentPan.y = mouseY - (mouseY - currentPan.y) * zoomRatio;
                        
                        currentZoom = newZoom;
                        updateTransform();
                        updateZoomDisplay();
                        
                        ${this.options.onZoomChange ? 'onZoomChange(currentZoom);' : ''}
                    }
                }
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.key === '+' || e.key === '=') {
                    zoomIn();
                } else if (e.key === '-') {
                    zoomOut();
                } else if (e.key === '0') {
                    resetView();
                } else if (e.key === 'f') {
                    fitToNodes();
                }
            });
        }
        
        // Update node position
        function updateNodePosition(node) {
            const nodeElement = document.querySelector('[data-node-id="' + node.id + '"]');
            const rect = nodeElement.querySelector('rect');
            const text = nodeElement.querySelector('text');
            
            rect.setAttribute('x', node.x - node.width/2);
            rect.setAttribute('y', node.y - node.height/2);
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y + 5);
        }
        
        // Update edges connected to a node
        function updateConnectedEdges(node) {
            edges.forEach(edge => {
                if (edge.fromNode === node.id || edge.toNode === node.id) {
                    const fromNode = nodes.find(n => n.id === edge.fromNode);
                    const toNode = nodes.find(n => n.id === edge.toNode);
                    
                    if (fromNode && toNode) {
                        const edgeElement = document.querySelector('[data-edge-id="' + edge.id + '"]');
                        if (edgeElement) {
                            edgeElement.setAttribute('x1', fromNode.x);
                            edgeElement.setAttribute('y1', fromNode.y);
                            edgeElement.setAttribute('x2', toNode.x);
                            edgeElement.setAttribute('y2', toNode.y);
                        }
                    }
                }
            });
        }
        
        // Highlight connected nodes and edges
        function highlightConnectedNodes(node) {
            // Reset all highlights
            clearHighlights();
            
            // Highlight connected edges
            edges.forEach(edge => {
                if (edge.fromNode === node.id || edge.toNode === node.id) {
                    const edgeElement = document.querySelector('[data-edge-id="' + edge.id + '"]');
                    if (edgeElement) {
                        edgeElement.classList.add('highlighted');
                    }
                }
            });
        }
        
        // Highlight connected edges
        function highlightConnectedEdges(node) {
            edges.forEach(edge => {
                if (edge.fromNode === node.id || edge.toNode === node.id) {
                    const edgeElement = document.querySelector('[data-edge-id="' + edge.id + '"]');
                    if (edgeElement) {
                        edgeElement.style.strokeOpacity = '1.0';
                        edgeElement.style.strokeWidth = '3';
                    }
                }
            });
        }
        
        // Clear all highlights
        function clearHighlights() {
            document.querySelectorAll('.edge.highlighted').forEach(edge => {
                edge.classList.remove('highlighted');
            });
            
            document.querySelectorAll('.edge').forEach(edge => {
                edge.style.strokeOpacity = '';
                edge.style.strokeWidth = '';
            });
        }
        
        // Update viewport transform
        function updateTransform() {
            viewport.setAttribute('transform', 
                'translate(' + currentPan.x + ',' + currentPan.y + ') scale(' + currentZoom + ')');
        }
        
        // Update zoom display
        function updateZoomDisplay() {
            zoomLevelDisplay.textContent = Math.round(currentZoom * 100) + '%';
        }
        
        // Control functions
        function zoomIn() {
            const newZoom = Math.min(zoomExtent[1], currentZoom * 1.2);
            if (newZoom !== currentZoom) {
                currentZoom = newZoom;
                updateTransform();
                updateZoomDisplay();
            }
        }
        
        function zoomOut() {
            const newZoom = Math.max(zoomExtent[0], currentZoom * 0.8);
            if (newZoom !== currentZoom) {
                currentZoom = newZoom;
                updateTransform();
                updateZoomDisplay();
            }
        }
        
        function resetView() {
            currentZoom = 1.0;
            currentPan = { x: 0, y: 0 };
            updateTransform();
            updateZoomDisplay();
        }
        
        function fitToNodes() {
            if (nodes.length === 0) return;
            
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            
            nodes.forEach(node => {
                minX = Math.min(minX, node.x - node.width/2);
                maxX = Math.max(maxX, node.x + node.width/2);
                minY = Math.min(minY, node.y - node.height/2);
                maxY = Math.max(maxY, node.y + node.height/2);
            });
            
            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;
            const contentCenterX = (minX + maxX) / 2;
            const contentCenterY = (minY + maxY) / 2;
            
            const svgRect = svg.getBoundingClientRect();
            const scaleX = (svgRect.width * 0.8) / contentWidth;
            const scaleY = (svgRect.height * 0.8) / contentHeight;
            const scale = Math.min(scaleX, scaleY);
            
            currentZoom = Math.max(zoomExtent[0], Math.min(zoomExtent[1], scale));
            currentPan.x = svgRect.width / 2 - contentCenterX * currentZoom;
            currentPan.y = svgRect.height / 2 - contentCenterY * currentZoom;
            
            updateTransform();
            updateZoomDisplay();
        }
        
        // Initialize on load
        window.addEventListener('load', initializeCanvas);
    `;
  }

  /**
   * Export canvas with interactive features
   */
  exportInteractiveCanvas(outputPath: string): Promise<void> {
    const html = this.generateInteractiveHTML();
    return require('fs/promises').writeFile(outputPath, html, 'utf8');
  }

  /**
   * Get current interactive state
   */
  getInteractiveState() {
    return {
      zoom: this.currentZoom,
      pan: this.currentPan,
      isDragging: this.isDragging,
      draggedNode: this.draggedNode?.id || null
    };
  }

  /**
   * Update canvas data (for real-time updates)
   */
  updateCanvas(newCanvas: ObsidianCanvas) {
    this.canvas = newCanvas;
  }
}