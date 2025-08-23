import React from 'react';
import { ArticleComponent, CalloutContent } from '../../types/ComponentTypes';

interface CalloutRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const CalloutRenderer: React.FC<CalloutRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as CalloutContent;
  const { metadata } = component;

  const getCalloutStyles = () => {
    switch (content.type) {
      case 'info':
        return {
          containerClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          iconClass: 'text-blue-500',
          titleClass: 'text-blue-800 dark:text-blue-200',
          textClass: 'text-blue-700 dark:text-blue-300',
          icon: 'ℹ️'
        };
      case 'warning':
        return {
          containerClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          iconClass: 'text-yellow-500',
          titleClass: 'text-yellow-800 dark:text-yellow-200',
          textClass: 'text-yellow-700 dark:text-yellow-300',
          icon: '⚠️'
        };
      case 'error':
        return {
          containerClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          iconClass: 'text-red-500',
          titleClass: 'text-red-800 dark:text-red-200',
          textClass: 'text-red-700 dark:text-red-300',
          icon: '❌'
        };
      case 'success':
        return {
          containerClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          iconClass: 'text-green-500',
          titleClass: 'text-green-800 dark:text-green-200',
          textClass: 'text-green-700 dark:text-green-300',
          icon: '✅'
        };
      case 'tip':
        return {
          containerClass: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
          iconClass: 'text-purple-500',
          titleClass: 'text-purple-800 dark:text-purple-200',
          textClass: 'text-purple-700 dark:text-purple-300',
          icon: '💡'
        };
      default:
        return {
          containerClass: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
          iconClass: 'text-gray-500',
          titleClass: 'text-gray-800 dark:text-gray-200',
          textClass: 'text-gray-700 dark:text-gray-300',
          icon: '📝'
        };
    }
  };

  const styles = getCalloutStyles();

  const handleCalloutClick = () => {
    onInteraction?.('callout_click', {
      type: content.type,
      title: content.title,
      componentId: component.id
    });
  };

  return (
    <div 
      className={`callout-content border rounded-lg p-4 ${styles.containerClass} ${
        content.dismissible ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={content.dismissible ? handleCalloutClick : undefined}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={`flex-shrink-0 text-xl ${styles.iconClass}`}>
          {styles.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          {content.title && (
            <h3 className={`font-medium mb-2 ${styles.titleClass}`}>
              {content.title}
            </h3>
          )}

          {/* Message */}
          <div className={`${styles.textClass}`}>
            <p className="leading-relaxed">{content.message}</p>
          </div>

          {/* Metadata */}
          {metadata.estimatedReadTime && (
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>📖 {metadata.estimatedReadTime} min read</span>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {content.dismissible && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInteraction?.('callout_dismiss', {
                type: content.type,
                componentId: component.id
              });
            }}
            className={`flex-shrink-0 p-1 rounded hover:bg-black hover:bg-opacity-10 dark:hover:bg-white dark:hover:bg-opacity-10 transition-colors ${styles.iconClass}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default CalloutRenderer;
