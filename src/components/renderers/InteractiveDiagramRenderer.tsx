import React, { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  BackgroundVariant,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { InteractiveDiagramContent, DiagramNode, DiagramEdge } from '../../types/ComponentTypes';

interface InteractiveDiagramRendererProps {
  content: InteractiveDiagramContent;
}

// Custom node types for Chromium-specific diagrams
const ChromiumProcessNode: React.FC<{ data: DiagramNode['data'] }> = ({ data }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getProcessColor = (processType?: string) => {
    switch (processType) {
      case 'browser': return '#2563eb'; // blue
      case 'renderer': return '#dc2626'; // red
      case 'gpu': return '#16a34a'; // green
      case 'network': return '#ea580c'; // orange
      case 'utility': return '#7c3aed'; // purple
      default: return '#6b7280'; // gray
    }
  };

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md border-2 cursor-pointer transition-all duration-200 hover:shadow-lg"
      style={{ 
        backgroundColor: 'white',
        borderColor: getProcessColor(data.processType),
        minWidth: '120px'
      }}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-center space-x-2">
        {data.icon && <span className="text-lg">{data.icon}</span>}
        <div>
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
          <div className="text-xs text-gray-600">{data.processType}</div>
        </div>
      </div>
      
      {showDetails && data.description && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 border-t">
          {data.description}
          {data.links && data.links.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  className="block text-blue-600 hover:text-blue-800 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ChromiumComponentNode: React.FC<{ data: DiagramNode['data'] }> = ({ data }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getComponentColor = (componentType?: string) => {
    switch (componentType) {
      case 'ui': return '#8b5cf6'; // violet
      case 'content': return '#059669'; // emerald
      case 'blink': return '#dc2626'; // red
      case 'v8': return '#f59e0b'; // amber
      case 'network': return '#0ea5e9'; // sky
      case 'storage': return '#84cc16'; // lime
      default: return '#6b7280'; // gray
    }
  };

  return (
    <div 
      className="px-3 py-2 shadow-md rounded border cursor-pointer transition-all duration-200 hover:shadow-lg"
      style={{ 
        backgroundColor: getComponentColor(data.componentType),
        color: 'white',
        minWidth: '100px'
      }}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-center space-x-2">
        {data.icon && <span className="text-sm">{data.icon}</span>}
        <div>
          <div className="text-sm font-medium">{data.label}</div>
          {data.componentType && (
            <div className="text-xs opacity-90">{data.componentType}</div>
          )}
        </div>
      </div>
      
      {showDetails && data.description && (
        <div className="mt-2 p-2 bg-black bg-opacity-20 rounded text-xs border-t border-white border-opacity-30">
          {data.description}
          {data.links && data.links.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  className="block text-white underline hover:text-gray-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DefaultDiagramNode: React.FC<{ data: DiagramNode['data'] }> = ({ data }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-gray-300 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-blue-400"
      style={{ minWidth: '100px' }}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-center space-x-2">
        {data.icon && <span className="text-lg">{data.icon}</span>}
        <div>
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
        </div>
      </div>
      
      {showDetails && data.description && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 border-t">
          {data.description}
          {data.links && data.links.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  className="block text-blue-600 hover:text-blue-800 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  'chromium-process': ChromiumProcessNode,
  'chromium-component': ChromiumComponentNode,
  default: DefaultDiagramNode,
};

export const InteractiveDiagramRenderer: React.FC<InteractiveDiagramRendererProps> = ({ content }) => {
  // Convert our diagram format to ReactFlow format
  const initialNodes: Node[] = useMemo(() => 
    content.nodes.map(node => ({
      id: node.id,
      type: node.type || 'default',
      position: node.position,
      data: node.data,
      style: node.style,
      draggable: node.draggable !== false,
      selectable: node.selectable !== false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })), [content.nodes]
  );

  const initialEdges: Edge[] = useMemo(() => 
    content.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: edge.type || 'default',
      animated: edge.animated || false,
      style: edge.style,
      data: {
        description: edge.description,
        links: edge.links,
        clickable: edge.clickable
      },
      markerEnd: edge.markerEnd ? {
        type: edge.markerEnd.type === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed,
        color: edge.markerEnd.color || '#6b7280',
      } : {
        type: MarkerType.ArrowClosed,
        color: '#6b7280',
      },
    })), [content.edges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    console.log('Edge clicked:', edge);
    
    // Handle edge navigation if links are available
    const edgeData = edge.data as { links?: { title: string; url: string }[]; clickable?: boolean; description?: string };
    if (edgeData?.links && Array.isArray(edgeData.links) && edgeData.links.length > 0) {
      // If only one link, navigate directly
      if (edgeData.links.length === 1) {
        const link = edgeData.links[0];
        if (link.url.startsWith('#')) {
          // Internal navigation
          window.location.hash = link.url.substring(1);
        } else {
          // External navigation
          window.open(link.url, '_blank');
        }
      } else {
        // Multiple links - show a tooltip or modal (for now, just navigate to first)
        const link = edgeData.links[0];
        if (link.url.startsWith('#')) {
          window.location.hash = link.url.substring(1);
        } else {
          window.open(link.url, '_blank');
        }
      }
    }
  }, []);

  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {content.title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {content.title}
          </h3>
          {content.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {content.description}
            </p>
          )}
        </div>
      )}
      
      <div className="relative" style={{ height: content.height || 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
        >
          {content.controls !== false && <Controls />}
          {content.miniMap && (
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'chromium-process') {
                  const processType = (node.data as DiagramNode['data']).processType;
                  switch (processType) {
                    case 'browser': return '#2563eb';
                    case 'renderer': return '#dc2626';
                    case 'gpu': return '#16a34a';
                    case 'network': return '#ea580c';
                    case 'utility': return '#7c3aed';
                    default: return '#6b7280';
                  }
                }
                return '#6b7280';
              }}
              maskColor="rgb(240, 240, 240, 0.6)"
            />
          )}
          {content.background !== false && (
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1}
              color="#e5e7eb"
            />
          )}
        </ReactFlow>
      </div>
      
      {/* Enhanced footer with navigation hints and related diagrams */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          💡 Click on nodes to see details, drag to rearrange, and use mouse wheel to zoom
          {content.relatedDiagrams && content.relatedDiagrams.length > 0 && " • Click edges to navigate to related content"}
        </div>
        
        {/* Navigation hints */}
        {content.navigationHints && content.navigationHints.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Navigation Tips:</div>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              {content.navigationHints.map((hint, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-1 h-1 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                  {hint}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Related diagrams */}
        {content.relatedDiagrams && content.relatedDiagrams.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Related Diagrams:</div>
            <div className="flex flex-wrap gap-2">
              {content.relatedDiagrams.map((diagram, index) => (
                <a
                  key={index}
                  href={diagram.url.startsWith('#') ? diagram.url : `#${diagram.url}`}
                  className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  title={diagram.description}
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {diagram.title}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveDiagramRenderer;
