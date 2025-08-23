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
      
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        💡 Click on nodes to see details, drag to rearrange, and use mouse wheel to zoom
      </div>
    </div>
  );
};

export default InteractiveDiagramRenderer;
