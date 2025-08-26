import React from 'react';
import { useLoading } from '../contexts/LoadingContext';

interface LoadingDisplayProps {
  showGlobalOverlay?: boolean;
  showInlineLoaders?: boolean;
  position?: 'top-center' | 'bottom-center' | 'center';
}

const LoadingDisplay: React.FC<LoadingDisplayProps> = ({ 
  showGlobalOverlay = true,
  showInlineLoaders = true,
  position = 'center'
}) => {
  const { loadingStates, isLoading } = useLoading();

  if (!isLoading) {
    return null;
  }

  const primaryLoading = loadingStates[0];
  const hasMultipleLoading = loadingStates.length > 1;

  const getPositionClasses = () => {
    switch (position) {
      case 'top-center':
        return 'top-8 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-8 left-1/2 transform -translate-x-1/2';
      case 'center':
      default:
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
    }
  };

  return (
    <>
      {/* Global Loading Overlay */}
      {showGlobalOverlay && primaryLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className={`fixed ${getPositionClasses()}`}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-auto">
              <div className="flex items-center space-x-4">
                {/* Spinner */}
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {primaryLoading.message}
                  </p>
                  
                  {hasMultipleLoading && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {loadingStates.length - 1} more operation(s) in progress
                    </p>
                  )}
                  
                  {/* Progress Bar */}
                  {primaryLoading.progress !== undefined && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Progress</span>
                        <span>{Math.round(primaryLoading.progress)}%</span>
                      </div>
                      <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${primaryLoading.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Cancel Button */}
                  {primaryLoading.cancellable && primaryLoading.onCancel && (
                    <button
                      onClick={primaryLoading.onCancel}
                      className="mt-3 text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Loading Indicators */}
      {showInlineLoaders && !showGlobalOverlay && (
        <div className="fixed top-4 right-4 z-40 space-y-2">
          {loadingStates.slice(0, 3).map((loading) => (
            <div
              key={loading.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-xs border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {loading.message}
                  </p>
                  
                  {loading.progress !== undefined && (
                    <div className="mt-1">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                        <div 
                          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${loading.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
                
                {loading.cancellable && loading.onCancel && (
                  <button
                    onClick={loading.onCancel}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {loadingStates.length > 3 && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-center">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                +{loadingStates.length - 3} more
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default LoadingDisplay;
