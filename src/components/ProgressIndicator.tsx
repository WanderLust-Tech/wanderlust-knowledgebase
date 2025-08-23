import React, { useEffect, useState } from 'react';
import { useProgress } from '../contexts/ProgressContext';

interface ProgressIndicatorProps {
  path: string;
  title: string;
  estimatedReadTime?: number;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  path,
  title,
  estimatedReadTime,
  className = '',
}) => {
  const { getArticleProgress, updateReadingProgress, markArticleCompleted } = useProgress();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const articleProgress = getArticleProgress(path);

  // Calculate scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      // Prevent division by zero and ensure valid calculation
      let scrollPercent = 0;
      if (docHeight > 0) {
        scrollPercent = (scrollTop / docHeight) * 100;
      }
      
      // Ensure the result is a valid number
      scrollPercent = isNaN(scrollPercent) ? 0 : Math.min(100, Math.max(0, scrollPercent));
      setScrollProgress(scrollPercent);
      
      // Update reading progress based on scroll
      if (scrollPercent > 5) { // Only start tracking after 5% scroll
        updateReadingProgress(path, scrollPercent, scrollTop);
      }
      
      // Mark as completed if user scrolled to the bottom
      if (scrollPercent >= 95 && !articleProgress?.completed) {
        markArticleCompleted(path);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [path, articleProgress?.completed, updateReadingProgress, markArticleCompleted]);

  // Track time spent on page
  useEffect(() => {
    const startTime = Date.now();
    
    return () => {
      const timeSpent = Math.floor((Date.now() - startTime) / (1000 * 60));
      if (timeSpent > 0) {
        updateReadingProgress(path, -1, -1); // Update with current time only
      }
    };
  }, [path, updateReadingProgress]);

  const displayProgress = Math.max(
    isNaN(scrollProgress) ? 0 : scrollProgress, 
    articleProgress?.progress && !isNaN(articleProgress.progress) ? articleProgress.progress : 0
  );

  if (!isVisible) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-600 h-1 transition-all duration-300 ease-out"
          style={{ width: `${isNaN(displayProgress) ? 0 : displayProgress}%` }}
        />
      </div>
      
      {/* Progress Info */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className={`text-lg ${
                articleProgress?.completed ? '✅' : displayProgress > 50 ? '📖' : '📄'
              }`}>
                {articleProgress?.completed ? '✅' : displayProgress > 50 ? '📖' : '📄'}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {isNaN(displayProgress) ? 0 : Math.round(displayProgress)}% complete
              </span>
            </div>
            
            {estimatedReadTime && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                ~{estimatedReadTime} min read
              </div>
            )}
            
            {articleProgress?.timeSpent && articleProgress.timeSpent > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {Math.floor(articleProgress.timeSpent)}m spent
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Hide progress indicator"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
