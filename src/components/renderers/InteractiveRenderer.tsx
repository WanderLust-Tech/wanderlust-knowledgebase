import React, { useState, useEffect } from 'react';
import { ArticleComponent, InteractiveContent } from '../../types/ComponentTypes';

interface InteractiveRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const InteractiveRenderer: React.FC<InteractiveRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as InteractiveContent;
  const { metadata } = component;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading for demo purposes
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleInteraction = (type: string, data?: any) => {
    onInteraction?.(type, { componentId: component.id, ...data });
  };

  if (isLoading) {
    return (
      <div className="interactive-content">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4 w-3/4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2 w-5/6"></div>
            <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="interactive-content">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <div>
              <h3 className="text-red-800 dark:text-red-200 font-medium">
                Failed to load interactive content
              </h3>
              <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="interactive-content">
      {/* Header */}
      {metadata.title && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {metadata.title}
          </h2>
          {metadata.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {metadata.description}
            </p>
          )}
        </div>
      )}

      {/* Interactive content container */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Content based on interactive type */}
        {content.type === 'code-editor' && (
          <div className="p-6">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Code Editor
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Interactive code editor for {content.language || 'code'} programming.
              </p>
            </div>

            {/* Code editor placeholder */}
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
              <div className="mb-2 text-gray-500">// {content.language || 'Code'} Editor</div>
              <pre className="whitespace-pre-wrap">
                {content.initialCode || '// Start coding here...\nconsole.log("Hello, World!");'}
              </pre>
            </div>

            <div className="mt-4 space-x-2">
              <button
                onClick={() => handleInteraction('code_run', { language: content.language })}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
              >
                Run Code
              </button>
              <button
                onClick={() => handleInteraction('code_reset', { language: content.language })}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {content.type === 'demo' && (
          <div className="p-6">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Interactive Demo
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This is a placeholder for an interactive demo. Configuration: {JSON.stringify(content.config, null, 2)}
              </p>
              
              {/* Demo buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => handleInteraction('demo_action', { action: 'start', config: content.config })}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2 transition-colors"
                >
                  Start Demo
                </button>
                <button
                  onClick={() => handleInteraction('demo_action', { action: 'reset', config: content.config })}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Demo content area */}
            <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg h-32 flex items-center justify-center">
              <span className="text-gray-500 dark:text-gray-400">Demo Content Area</span>
            </div>
          </div>
        )}

        {content.type === 'simulation' && (
          <div className="p-6">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Interactive Simulation
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Interactive simulation environment with configuration settings.
              </p>
            </div>

            {/* Simulation controls */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => handleInteraction('simulation_start', { config: content.config })}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Start
              </button>
              <button
                onClick={() => handleInteraction('simulation_pause', { config: content.config })}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Pause
              </button>
              <button
                onClick={() => handleInteraction('simulation_stop', { config: content.config })}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Stop
              </button>
            </div>

            {/* Simulation canvas */}
            <div className="bg-black rounded-lg h-64 flex items-center justify-center">
              <span className="text-white">Simulation Canvas</span>
            </div>
          </div>
        )}

        {/* Fallback for unknown types */}
        {!['code-editor', 'demo', 'simulation'].includes(content.type) && (
          <div className="p-6 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-2">
              ⚠️ Unsupported interactive type: {content.type}
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              This interactive content type is not yet implemented.
            </p>
          </div>
        )}
      </div>

      {/* Footer with metadata */}
      {(metadata.estimatedReadTime || metadata.difficulty) && (
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {metadata.estimatedReadTime && (
            <span>⏱️ {metadata.estimatedReadTime} min</span>
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
      )}
    </div>
  );
};

export default InteractiveRenderer;
