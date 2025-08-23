import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProgress } from '../contexts/ProgressContext';

interface BreadcrumbItem {
  title: string;
  path: string;
  context?: 'architecture' | 'getting-started' | 'modules' | 'contributing' | 'debugging' | 'introduction' | 'security';
}

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const { getArticleProgress, updateReadingProgress, markArticleCompleted } = useProgress();
  const [showProgress, setShowProgress] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Get current article path (remove leading slash)
  const currentPath = location.pathname.substring(1);
  const articleProgress = getArticleProgress(currentPath);
  
  // Check if we're viewing an article (not search or progress pages)
  const isArticlePage = !location.pathname.startsWith('/search') && 
                       !location.pathname.startsWith('/progress') &&
                       location.pathname !== '/';

  // Calculate scroll progress for article pages
  useEffect(() => {
    if (!isArticlePage) return;

    const handleScroll = () => {
      // Find the scrollable container (main content area)
      const scrollContainer = document.querySelector('main > div:last-child');
      
      if (!scrollContainer) {
        return;
      }
      
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const scrollableHeight = scrollHeight - clientHeight;
      
      // Prevent division by zero and ensure valid calculation
      let scrollPercent = 0;
      if (scrollableHeight > 0) {
        scrollPercent = (scrollTop / scrollableHeight) * 100;
      }
      
      // Ensure the result is a valid number
      scrollPercent = isNaN(scrollPercent) ? 0 : Math.min(100, Math.max(0, scrollPercent));
      setScrollProgress(scrollPercent);
      
      // Update reading progress based on scroll
      if (scrollPercent > 5) { // Only start tracking after 5% scroll
        updateReadingProgress(currentPath, scrollPercent, scrollTop);
      }
      
      // Mark as completed if user scrolled to the bottom
      if (scrollPercent >= 95 && !articleProgress?.completed) {
        markArticleCompleted(currentPath);
      }
    };

    // Find the scrollable container and add event listener
    const scrollContainer = document.querySelector('main > div:last-child');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll(); // Initial calculation
      
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [currentPath, isArticlePage, articleProgress?.completed, updateReadingProgress, markArticleCompleted]);
  
  // Get the current progress (either from scroll or saved progress)
  const displayProgress = Math.max(
    scrollProgress,
    articleProgress?.progress || 0
  );
  
  // Generate breadcrumbs from current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(segment => segment);
    
    const breadcrumbs: BreadcrumbItem[] = [
      { title: 'Home', path: '/' }
    ];

    // Known section folders that should link to their overview
    const sectionFolders = [
      'architecture', 'getting-started', 'modules', 'contributing', 
      'debugging', 'introduction', 'security'
    ];

    // Build breadcrumbs from path segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Convert segment to readable title
      const title = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Determine context based on first segment
      const context = index === 0 ? segment as BreadcrumbItem['context'] : undefined;

      // For section folders (first level), append /overview to the path for navigation
      // For deeper paths, use the current path as-is
      let navigationPath = currentPath;
      if (index === 0 && sectionFolders.includes(segment)) {
        navigationPath = `${currentPath}/overview`;
      }

      breadcrumbs.push({
        title,
        path: navigationPath,
        context
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs on home page or if only one item
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div key={location.pathname}>
      {/* Progress Bar - only show on article pages when progress exists */}
      {isArticlePage && showProgress && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-1 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
          />
        </div>
      )}
      
      <nav className="breadcrumb-container bg-gray-50 dark:bg-gray-800 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <ol className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            {breadcrumbs.map((item, index) => (
              <li key={`${location.pathname}-${item.path}-${index}`} className="flex items-center">
                {index > 0 && (
                  <svg
                    className="w-4 h-4 mx-2 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                ) : (
                  <Link
                    to={item.path}
                    className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors duration-200"
                  >
                    {item.title}
                  </Link>
                )}
                {item.context && index === 1 && (
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    {item.context}
                  </span>
                )}
              </li>
            ))}
          </ol>
          
          {/* Progress Information - only show on article pages */}
          {isArticlePage && showProgress && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <span className={`text-sm ${
                    articleProgress?.completed ? '✅' : displayProgress > 50 ? '📖' : '📄'
                  }`}>
                    {articleProgress?.completed ? '✅' : displayProgress > 50 ? '📖' : '📄'}
                  </span>
                  <span className="font-medium">
                    {Math.round(displayProgress)}% complete
                  </span>
                </div>
                
                {articleProgress?.timeSpent && articleProgress.timeSpent > 0 && (
                  <div>{Math.floor(articleProgress.timeSpent)}m spent</div>
                )}
              </div>
              
              <button
                onClick={() => setShowProgress(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                aria-label="Hide progress information"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Breadcrumb;
