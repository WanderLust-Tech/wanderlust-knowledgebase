import React, { useState, useEffect } from 'react';
import { ArticleComponent, DiagramContent } from '../../types/ComponentTypes';

interface DiagramRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const DiagramRenderer: React.FC<DiagramRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as DiagramContent;
  const { metadata } = component;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    // Simulate loading for diagram rendering
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleNodeClick = (nodeId: string) => {
    const clickableNode = content.clickableNodes?.find(node => node.id === nodeId);
    if (clickableNode) {
      onInteraction?.('diagram_node_click', {
        nodeId,
        action: clickableNode.action,
        target: clickableNode.target
      });
    }
  };

  const handleFullscreenToggle = () => {
    setFullscreen(!fullscreen);
    onInteraction?.('diagram_fullscreen', { fullscreen: !fullscreen, diagramType: content.type });
  };

  const renderDiagramPlaceholder = () => {
    const getDiagramIcon = () => {
      switch (content.type) {
        case 'mermaid':
          return '🌊';
        case 'plantuml':
          return '🏗️';
        case 'flowchart':
          return '📊';
        case 'architecture':
          return '🏛️';
        default:
          return '📈';
      }
    };

    const getSampleContent = () => {
      switch (content.type) {
        case 'mermaid':
          return `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;
        case 'plantuml':
          return `@startuml
actor User
participant "Web App" as WA
participant "API Server" as API
database "Database" as DB

User -> WA: Request
WA -> API: API Call
API -> DB: Query
DB -> API: Data
API -> WA: Response
WA -> User: Result
@enduml`;
        case 'flowchart':
          return 'Flowchart representation showing process flow and decision points';
        case 'architecture':
          return 'System architecture diagram showing components and their relationships';
        default:
          return content.source;
      }
    };

    return (
      <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">{getDiagramIcon()}</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {content.type.charAt(0).toUpperCase() + content.type.slice(1)} Diagram
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {content.title || `Interactive ${content.type} diagram`}
          </p>
          
          {/* Sample diagram content */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mt-4">
            <pre className="text-left text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
              {getSampleContent()}
            </pre>
          </div>

          {/* Interactive nodes simulation */}
          {content.clickableNodes && content.clickableNodes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Interactive elements:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {content.clickableNodes.map((node, index) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-xs transition-colors"
                  >
                    {node.id} ({node.action})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="diagram-content">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4 w-3/4"></div>
            <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diagram-content">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <div>
              <h3 className="text-red-800 dark:text-red-200 font-medium">
                Failed to render diagram
              </h3>
              <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`diagram-content ${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4' : ''}`}>
      {/* Header */}
      {(metadata.title || content.title) && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {metadata.title || content.title}
              </h2>
              {metadata.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {metadata.description}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-700 dark:text-gray-300">
                {content.type}
              </span>
              <button
                onClick={handleFullscreenToggle}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title={fullscreen ? 'Exit fullscreen' : 'View fullscreen'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {fullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagram container */}
      <div className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden ${
        fullscreen ? 'h-full' : 'border border-gray-200 dark:border-gray-700'
      }`}>
        {renderDiagramPlaceholder()}
      </div>

      {/* Diagram controls */}
      {!fullscreen && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onInteraction?.('diagram_zoom_in', { diagramType: content.type })}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Zoom In
            </button>
            <button
              onClick={() => onInteraction?.('diagram_zoom_out', { diagramType: content.type })}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Zoom Out
            </button>
            <button
              onClick={() => onInteraction?.('diagram_reset_view', { diagramType: content.type })}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Reset View
            </button>
          </div>

          {/* Metadata */}
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            {content.interactive && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium">
                Interactive
              </span>
            )}
            {metadata.difficulty && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                metadata.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                metadata.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {metadata.difficulty}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen close button */}
      {fullscreen && (
        <button
          onClick={handleFullscreenToggle}
          className="absolute top-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default DiagramRenderer;
