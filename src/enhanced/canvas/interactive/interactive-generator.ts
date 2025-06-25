/**
 * Interactive Canvas Generator
 * Generates D3.js-powered interactive knowledge graph explorations
 */

import type { 
  ObsidianCanvas, 
  CanvasNode, 
  CanvasEdge,
  InteractivityConfig,
  ZoomConfig,
  PanConfig,
  DragConfig,
  PhysicsConfig
} from '../types.js';

export interface InteractiveCanvasOptions {
  title?: string;
  width?: number;
  height?: number;
  background?: string;
  interactivity?: InteractivityConfig;
  physics?: PhysicsConfig;
  theme?: 'light' | 'dark' | 'auto';
  exportFormat?: 'html' | 'svg' | 'png';
}

export class InteractiveCanvasGenerator {
  /**
   * Generate interactive HTML canvas with D3.js implementation
   */
  static generateInteractiveHTML(
    canvas: ObsidianCanvas,
    options: InteractiveCanvasOptions = {}
  ): string {
    const {
      title = 'Interactive Knowledge Graph',
      width = 1200,
      height = 800,
      background = '#fafafa',
      theme = 'light',
      interactivity = this.getDefaultInteractivity(),
      physics = this.getDefaultPhysics()
    } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
    <style>
        ${this.generateCSS(theme, width, height, background)}
    </style>
</head>
<body>
    <div id="controls">
        ${this.generateControls(interactivity, physics)}
    </div>
    <div id="canvas-container">
        <svg id="knowledge-graph" width="${width}" height="${height}"></svg>
    </div>
    <div id="info-panel">
        <div id="node-info"></div>
        <div id="stats">
            <span>Nodes: ${canvas.nodes.length}</span>
            <span>Edges: ${canvas.edges.length}</span>
            <span id="zoom-level">Zoom: 100%</span>
        </div>
    </div>

    <script>
        ${this.generateJavaScript(canvas, interactivity, physics, width, height)}
    </script>
</body>
</html>`;
  }

  /**
   * Generate CSS styles for interactive canvas
   */
  private static generateCSS(
    theme: string, 
    width: number, 
    height: number, 
    background: string
  ): string {
    const isDark = theme === 'dark';
    
    return `
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${isDark ? '#1a1a1a' : '#f5f5f5'};
            color: ${isDark ? '#e0e0e0' : '#333'};
            overflow: hidden;
        }

        #controls {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            align-items: center;
            background: ${isDark ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
            padding: 10px;
            border-radius: 8px;
            border: 1px solid ${isDark ? '#444' : '#ddd'};
            backdrop-filter: blur(10px);
        }

        #canvas-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
        }

        #knowledge-graph {
            background: ${background};
            border: 1px solid ${isDark ? '#444' : '#ddd'};
            border-radius: 8px;
            cursor: grab;
        }

        #knowledge-graph:active {
            cursor: grabbing;
        }

        .node {
            cursor: pointer;
            stroke-width: 2px;
            transition: all 0.2s ease;
        }

        .node:hover {
            stroke-width: 3px;
            filter: brightness(1.1);
        }

        .node.selected {
            stroke-width: 4px;
            stroke: #ff6b35;
        }

        .node.crystal {
            fill: #4ade80;
            stroke: #166534;
        }

        .node.gel {
            fill: #fbbf24;
            stroke: #92400e;
        }

        .node.fluid {
            fill: #60a5fa;
            stroke: #1e40af;
        }

        .node.plasma {
            fill: #f87171;
            stroke: #991b1b;
        }

        .edge {
            stroke: #999;
            stroke-width: 1.5px;
            stroke-opacity: 0.6;
            fill: none;
            pointer-events: none;
        }

        .edge.highlighted {
            stroke: #ff6b35;
            stroke-width: 3px;
            stroke-opacity: 0.8;
        }

        .node-label {
            font-size: 12px;
            font-weight: 500;
            text-anchor: middle;
            pointer-events: none;
            fill: ${isDark ? '#e0e0e0' : '#333'};
        }

        #info-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background: ${isDark ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
            padding: 15px;
            border-radius: 8px;
            border: 1px solid ${isDark ? '#444' : '#ddd'};
            backdrop-filter: blur(10px);
            max-width: 300px;
        }

        #node-info {
            margin-bottom: 10px;
            font-size: 14px;
        }

        #stats {
            display: flex;
            gap: 15px;
            font-size: 12px;
            color: ${isDark ? '#999' : '#666'};
        }

        .control-button {
            background: ${isDark ? '#333' : '#fff'};
            border: 1px solid ${isDark ? '#555' : '#ddd'};
            color: ${isDark ? '#e0e0e0' : '#333'};
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }

        .control-button:hover {
            background: ${isDark ? '#444' : '#f0f0f0'};
        }

        .control-button.active {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }

        .zoom-controls {
            display: flex;
            gap: 5px;
        }

        .legend {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: ${isDark ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
            padding: 10px;
            border-radius: 8px;
            border: 1px solid ${isDark ? '#444' : '#ddd'};
            backdrop-filter: blur(10px);
            font-size: 12px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 5px 0;
        }

        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid;
        }
    `;
  }

  /**
   * Generate control panel HTML
   */
  private static generateControls(
    interactivity: InteractivityConfig,
    physics: PhysicsConfig
  ): string {
    const controls = [];

    if (interactivity.zoom?.enabled) {
      controls.push(`
        <div class="zoom-controls">
            <button class="control-button" onclick="zoomIn()">+</button>
            <button class="control-button" onclick="zoomOut()">-</button>
            <button class="control-button" onclick="resetZoom()">Reset</button>
        </div>
      `);
    }

    if (physics.enabled) {
      controls.push(`
        <button class="control-button" id="physics-toggle" onclick="togglePhysics()">
            Physics: ON
        </button>
        <button class="control-button" onclick="restartSimulation()">
            Restart
        </button>
      `);
    }

    if (interactivity.selection?.enabled) {
      controls.push(`
        <button class="control-button" onclick="clearSelection()">
            Clear Selection
        </button>
      `);
    }

    controls.push(`
      <button class="control-button" onclick="exportSVG()">
          Export SVG
      </button>
      <button class="control-button" onclick="toggleLegend()">
          Legend
      </button>
    `);

    return controls.join('\n');
  }  /**
   * Generate D3.js JavaScript for interactive canvas
   */
  private static generateJavaScript(
    canvas: ObsidianCanvas,
    interactivity: InteractivityConfig,
    physics: PhysicsConfig,
    width: number,
    height: number
  ): string {
    return `
        // Canvas data
        const nodes = ${JSON.stringify(canvas.nodes, null, 8)};
        const edges = ${JSON.stringify(canvas.edges, null, 8)};

        // Configuration
        const config = {
            width: ${width},
            height: ${height},
            interactivity: ${JSON.stringify(interactivity, null, 8)},
            physics: ${JSON.stringify(physics, null, 8)}
        };

        // D3.js setup
        const svg = d3.select("#knowledge-graph");
        const container = svg.append("g");
        
        let currentTransform = d3.zoomIdentity;
        let simulation = null;
        let selectedNodes = new Set();
        let isDragging = false;
        let showLegend = true;

        // Initialize interactive canvas
        function initializeCanvas() {
            // Set up zoom and pan
            ${this.generateZoomPanBehavior(interactivity)}

            // Create edges
            const edgeElements = container.selectAll(".edge")
                .data(edges)
                .enter()
                .append("line")
                .attr("class", "edge")
                .attr("id", d => \`edge-\${d.id}\`);

            // Create nodes
            const nodeElements = container.selectAll(".node")
                .data(nodes)
                .enter()
                .append("circle")
                .attr("class", d => \`node \${d.clState || 'fluid'}\`)
                .attr("id", d => \`node-\${d.id}\`)
                .attr("r", d => Math.max(d.width, d.height) / 4)
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            // Create node labels
            const labelElements = container.selectAll(".node-label")
                .data(nodes)
                .enter()
                .append("text")
                .attr("class", "node-label")
                .attr("x", d => d.x)
                .attr("y", d => d.y + 5)
                .text(d => this.truncateLabel(d.file || d.text || d.id, 20));

            // Set up node interactions
            ${this.generateNodeInteractions(interactivity)}

            // Initialize physics simulation if enabled
            if (config.physics.enabled) {
                initializePhysics();
            }

            // Create legend
            createLegend();

            // Update positions
            updatePositions();
        }

        function initializePhysics() {
            simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(edges)
                    .id(d => d.id)
                    .distance(d => calculateLinkDistance(d))
                    .strength(d => calculateLinkStrength(d))
                )
                .force("charge", d3.forceManyBody()
                    .strength(d => calculateNodeCharge(d))
                )
                .force("center", d3.forceCenter(config.width / 2, config.height / 2))
                .force("collision", d3.forceCollide()
                    .radius(d => calculateCollisionRadius(d))
                )
                .on("tick", updatePositions)
                .on("end", onSimulationEnd);
        }

        ${this.generateCLPhysicsCalculations()}

        function updatePositions() {
            // Update edge positions
            container.selectAll(".edge")
                .attr("x1", d => d.source.x || nodes.find(n => n.id === d.fromNode)?.x)
                .attr("y1", d => d.source.y || nodes.find(n => n.id === d.fromNode)?.y)
                .attr("x2", d => d.target.x || nodes.find(n => n.id === d.toNode)?.x)
                .attr("y2", d => d.target.y || nodes.find(n => n.id === d.toNode)?.y);

            // Update node positions
            container.selectAll(".node")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            // Update label positions
            container.selectAll(".node-label")
                .attr("x", d => d.x)
                .attr("y", d => d.y + 5);
        }

        ${this.generateInteractionFunctions(interactivity)}

        // Utility functions
        function truncateLabel(text, maxLength) {
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength - 3) + "...";
        }

        function onSimulationEnd() {
            console.log("Physics simulation converged");
            updateStats();
        }

        function updateStats() {
            const zoomLevel = Math.round(currentTransform.k * 100);
            document.getElementById("zoom-level").textContent = \`Zoom: \${zoomLevel}%\`;
        }

        function createLegend() {
            const legendData = [
                { state: 'crystal', color: '#4ade80', label: 'Crystal - Authoritative' },
                { state: 'gel', color: '#fbbf24', label: 'Gel - Working Conclusions' },
                { state: 'fluid', color: '#60a5fa', label: 'Fluid - Active Exploration' },
                { state: 'plasma', color: '#f87171', label: 'Plasma - Rejected/Lessons' }
            ];

            const legend = d3.select("body")
                .append("div")
                .attr("class", "legend")
                .attr("id", "legend")
                .style("display", showLegend ? "block" : "none");

            legend.selectAll(".legend-item")
                .data(legendData)
                .enter()
                .append("div")
                .attr("class", "legend-item")
                .html(d => \`
                    <div class="legend-color" style="background: \${d.color}; border-color: \${d.color};"></div>
                    <span>\${d.label}</span>
                \`);
        }

        // Global functions for controls
        window.zoomIn = () => {
            svg.transition().duration(300).call(
                zoom.scaleBy, 1.5
            );
        };

        window.zoomOut = () => {
            svg.transition().duration(300).call(
                zoom.scaleBy, 1 / 1.5
            );
        };

        window.resetZoom = () => {
            svg.transition().duration(500).call(
                zoom.transform,
                d3.zoomIdentity
            );
        };

        window.togglePhysics = () => {
            if (simulation) {
                if (simulation.alpha() > 0) {
                    simulation.stop();
                    document.getElementById("physics-toggle").textContent = "Physics: OFF";
                    document.getElementById("physics-toggle").classList.remove("active");
                } else {
                    simulation.restart();
                    document.getElementById("physics-toggle").textContent = "Physics: ON";
                    document.getElementById("physics-toggle").classList.add("active");
                }
            }
        };

        window.restartSimulation = () => {
            if (simulation) {
                simulation.alpha(1).restart();
                document.getElementById("physics-toggle").textContent = "Physics: ON";
                document.getElementById("physics-toggle").classList.add("active");
            }
        };

        window.clearSelection = () => {
            selectedNodes.clear();
            container.selectAll(".node").classed("selected", false);
            container.selectAll(".edge").classed("highlighted", false);
            document.getElementById("node-info").innerHTML = "";
        };

        window.exportSVG = () => {
            const svgData = new XMLSerializer().serializeToString(svg.node());
            const blob = new Blob([svgData], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "knowledge-graph.svg";
            link.click();
            URL.revokeObjectURL(url);
        };

        window.toggleLegend = () => {
            showLegend = !showLegend;
            document.getElementById("legend").style.display = showLegend ? "block" : "none";
        };

        // Initialize the canvas
        initializeCanvas();
    `;
  }

  /**
   * Generate zoom and pan behavior
   */
  private static generateZoomPanBehavior(interactivity: InteractivityConfig): string {
    if (!interactivity.zoom?.enabled && !interactivity.pan?.enabled) {
      return '// Zoom and pan disabled';
    }

    const zoomConfig = interactivity.zoom;
    const panConfig = interactivity.pan;

    return `
        const zoom = d3.zoom()
            ${zoomConfig?.enabled ? `.scaleExtent([${zoomConfig.minScale || 0.1}, ${zoomConfig.maxScale || 3}])` : ''}
            .on("zoom", (event) => {
                currentTransform = event.transform;
                container.attr("transform", event.transform);
                updateStats();
            });

        svg.call(zoom);

        ${panConfig?.constrainToBounds ? `
        // Constrain pan to canvas bounds
        zoom.translateExtent([[0, 0], [config.width, config.height]]);
        ` : ''}
    `;
  }

  /**
   * Generate node interaction behaviors
   */
  private static generateNodeInteractions(interactivity: InteractivityConfig): string {
    const interactions = [];

    if (interactivity.drag?.enabled) {
      interactions.push(`
        // Node dragging
        const drag = d3.drag()
            .on("start", (event, d) => {
                isDragging = true;
                if (simulation && !event.active) {
                    simulation.alphaTarget(0.3).restart();
                }
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
                d.x = event.x;
                d.y = event.y;
                updatePositions();
            })
            .on("end", (event, d) => {
                isDragging = false;
                if (simulation && !event.active) {
                    simulation.alphaTarget(0);
                }
                if (!event.active) {
                    d.fx = null;
                    d.fy = null;
                }
            });

        nodeElements.call(drag);
      `);
    }

    if (interactivity.selection?.enabled) {
      interactions.push(`
        // Node selection and highlighting
        nodeElements
            .on("click", (event, d) => {
                event.stopPropagation();
                if (!isDragging) {
                    selectNode(d, event.ctrlKey || event.metaKey);
                }
            })
            .on("mouseover", (event, d) => {
                if (!isDragging) {
                    highlightConnections(d);
                    showNodeInfo(d);
                }
            })
            .on("mouseout", (event, d) => {
                if (!isDragging) {
                    clearHighlight();
                }
            });

        // Clear selection on canvas click
        svg.on("click", () => {
            if (!isDragging) {
                clearSelection();
            }
        });
      `);
    }

    return interactions.join('\n');
  }

  /**
   * Generate interaction functions
   */
  private static generateInteractionFunctions(interactivity: InteractivityConfig): string {
    if (!interactivity.selection?.enabled) {
      return '// Selection disabled';
    }

    return `
        function selectNode(node, multiSelect = false) {
            if (!multiSelect) {
                selectedNodes.clear();
                container.selectAll(".node").classed("selected", false);
            }

            if (selectedNodes.has(node.id)) {
                selectedNodes.delete(node.id);
                d3.select(\`#node-\${node.id}\`).classed("selected", false);
            } else {
                selectedNodes.add(node.id);
                d3.select(\`#node-\${node.id}\`).classed("selected", true);
            }

            showNodeInfo(node);
            highlightConnections(node);
        }

        function highlightConnections(node) {
            // Highlight connected edges
            container.selectAll(".edge")
                .classed("highlighted", d => 
                    d.fromNode === node.id || d.toNode === node.id
                );

            // Highlight connected nodes
            const connectedNodeIds = new Set();
            edges.forEach(edge => {
                if (edge.fromNode === node.id) connectedNodeIds.add(edge.toNode);
                if (edge.toNode === node.id) connectedNodeIds.add(edge.fromNode);
            });

            container.selectAll(".node")
                .style("opacity", d => 
                    d.id === node.id || connectedNodeIds.has(d.id) ? 1.0 : 0.3
                );
        }

        function clearHighlight() {
            container.selectAll(".edge").classed("highlighted", false);
            container.selectAll(".node").style("opacity", 1.0);
        }

        function showNodeInfo(node) {
            const infoPanel = document.getElementById("node-info");
            const title = node.file ? node.file.split('/').pop().replace('.md', '') : 
                         node.text ? node.text.substring(0, 50) : node.id;
            
            const connectionCount = edges.filter(e => 
                e.fromNode === node.id || e.toNode === node.id
            ).length;

            infoPanel.innerHTML = \`
                <strong>\${title}</strong><br>
                <span>State: \${node.clState || 'unknown'}</span><br>
                <span>Confidence: \${node.confidence || 'unknown'}</span><br>
                <span>Connections: \${connectionCount}</span><br>
                <span>Size: \${node.width}x\${node.height}</span>
            \`;
        }
    `;
  }

  /**
   * Generate CL physics calculations
   */
  private static generateCLPhysicsCalculations(): string {
    return `
        function calculateNodeCharge(node) {
            const stateCharges = {
                'crystal': -1200,
                'gel': -800,
                'fluid': -400,
                'plasma': -200
            };
            
            const confidenceMultipliers = {
                'high': 1.3,
                'medium': 1.0,
                'low': 0.7
            };
            
            const baseCharge = stateCharges[node.clState || 'fluid'] || -600;
            const confidenceMultiplier = confidenceMultipliers[node.confidence || 'medium'] || 1.0;
            
            return baseCharge * confidenceMultiplier;
        }

        function calculateLinkDistance(edge) {
            const relationshipDistances = {
                'implements': 60,
                'depends_on': 80,
                'extends': 100,
                'part_of': 70,
                'conflicts_with': 200,
                'relates_to': 120
            };
            
            const sourceNode = nodes.find(n => n.id === edge.fromNode);
            const targetNode = nodes.find(n => n.id === edge.toNode);
            const stateCompatibility = calculateStateCompatibility(
                sourceNode?.clState || 'fluid', 
                targetNode?.clState || 'fluid'
            );
            
            const baseDistance = relationshipDistances[edge.relationType || 'relates_to'] || 120;
            return baseDistance * stateCompatibility;
        }

        function calculateLinkStrength(edge) {
            const relationshipStrengths = {
                'implements': 1.5,
                'depends_on': 1.3,
                'extends': 1.1,
                'part_of': 1.4,
                'conflicts_with': 0.3,
                'relates_to': 0.8
            };
            
            const sourceNode = nodes.find(n => n.id === edge.fromNode);
            const targetNode = nodes.find(n => n.id === edge.toNode);
            const stateCompatibility = calculateStateCompatibility(
                sourceNode?.clState || 'fluid', 
                targetNode?.clState || 'fluid'
            );
            
            const baseStrength = relationshipStrengths[edge.relationType || 'relates_to'] || 1.0;
            return baseStrength / stateCompatibility;
        }

        function calculateStateCompatibility(sourceState, targetState) {
            const compatibility = {
                'crystal-crystal': 1.2,
                'crystal-gel': 0.9,
                'crystal-fluid': 1.1,
                'crystal-plasma': 1.8,
                'gel-gel': 0.8,
                'gel-fluid': 0.9,
                'gel-plasma': 1.4,
                'fluid-fluid': 0.7,
                'fluid-plasma': 1.0,
                'plasma-plasma': 0.9
            };
            
            const key = \`\${sourceState}-\${targetState}\`;
            const reverseKey = \`\${targetState}-\${sourceState}\`;
            return compatibility[key] || compatibility[reverseKey] || 1.0;
        }

        function calculateCollisionRadius(node) {
            const baseRadius = Math.max(node.width, node.height) / 4;
            const stateMultipliers = {
                'crystal': 1.4,
                'gel': 1.2,
                'fluid': 1.0,
                'plasma': 0.8
            };
            
            const stateMultiplier = stateMultipliers[node.clState || 'fluid'] || 1.0;
            return Math.min(baseRadius * stateMultiplier, 50);
        }
    `;
  }

  /**
   * Get default interactivity configuration
   */
  private static getDefaultInteractivity(): InteractivityConfig {
    return {
      enabled: true,
      zoom: {
        enabled: true,
        minScale: 0.1,
        maxScale: 3.0,
        wheelSensitivity: 1.0,
        touchSensitivity: 1.0
      },
      pan: {
        enabled: true,
        constrainToBounds: false,
        momentum: true,
        mousePan: true,
        touchPan: true
      },
      drag: {
        enabled: true,
        nodes: true,
        constrainToCanvas: false,
        snapToGrid: false,
        gridSize: 20,
        physics: true
      },
      selection: {
        enabled: true,
        multiSelect: true,
        rubberBand: false,
        keyboardShortcuts: true
      }
    };
  }

  /**
   * Get default physics configuration
   */
  private static getDefaultPhysics(): PhysicsConfig {
    return {
      enabled: true,
      algorithm: 'force-directed',
      parameters: {
        iterations: 300,
        repulsionStrength: 1000,
        attractionStrength: 0.1,
        damping: 0.85
      },
      realTime: true
    };
  }
}
