import React, { Suspense, lazy } from 'react';
import { ArticleComponent } from '../types/ComponentTypes';

// Lazy load renderers for better performance
const MarkdownRenderer = lazy(() => import('./renderers/MarkdownRenderer'));
const InteractiveRenderer = lazy(() => import('./renderers/InteractiveRenderer'));
const VideoRenderer = lazy(() => import('./renderers/VideoRenderer'));
const DiagramRenderer = lazy(() => import('./renderers/DiagramRenderer'));
const CalloutRenderer = lazy(() => import('./renderers/CalloutRenderer'));
const QuizRenderer = lazy(() => import('./renderers/QuizRenderer'));
const CodePlaygroundRenderer = lazy(() => import('./renderers/CodePlaygroundRenderer'));
const InteractiveDiagramRenderer = lazy(() => import('./renderers/InteractiveDiagramRenderer'));

interface ComponentRendererProps {
  component: ArticleComponent;
  onInteraction?: (componentId: string, interaction: string, data?: any) => void;
}

const ComponentRenderer: React.FC<ComponentRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  // Handle interaction wrapper to include component ID
  const handleInteraction = (interaction: string, data?: any) => {
    onInteraction?.(component.id, interaction, data);
  };

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2 w-3/4"></div>
      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2 w-1/2"></div>
      <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
    </div>
  );

  // Error fallback component
  const ErrorFallback = ({ type }: { type: string }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div className="flex items-center">
        <div className="text-red-500 mr-2">⚠️</div>
        <div>
          <h3 className="text-red-800 dark:text-red-200 font-medium">
            Component Error
          </h3>
          <p className="text-red-600 dark:text-red-300 text-sm">
            Failed to render {type} component. Please check the component configuration.
          </p>
        </div>
      </div>
    </div>
  );

  // Render component based on type
  const renderComponent = () => {
    try {
      switch (component.type) {
        case 'markdown':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <MarkdownRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'interactive':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <InteractiveRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'video':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <VideoRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'diagram':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <DiagramRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'callout':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <CalloutRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'quiz':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <QuizRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'code-playground':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <CodePlaygroundRenderer component={component} onInteraction={handleInteraction} />
            </Suspense>
          );

        case 'interactive-diagram':
          return (
            <Suspense fallback={<LoadingFallback />}>
              <InteractiveDiagramRenderer content={component.content} />
            </Suspense>
          );

        default:
          return <ErrorFallback type={component.type} />;
      }
    } catch (error) {
      console.error('ComponentRenderer error:', error);
      return <ErrorFallback type={component.type} />;
    }
  };

  return (
    <div 
      className="component-renderer mb-6"
      data-component-id={component.id}
      data-component-type={component.type}
    >
      {renderComponent()}
    </div>
  );
};

export default ComponentRenderer;
