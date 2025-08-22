import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  title: string;
  path: string;
  context?: 'architecture' | 'getting-started' | 'modules' | 'contributing' | 'debugging' | 'introduction' | 'security';
}

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  
  // Generate breadcrumbs from current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(segment => segment);
    const breadcrumbs: BreadcrumbItem[] = [
      { title: 'Home', path: '/' }
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

      breadcrumbs.push({
        title,
        path: currentPath,
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
    <nav className="breadcrumb-container bg-gray-50 px-6 py-3 border-b border-gray-200">
      <ol className="flex items-center space-x-2 text-sm text-gray-600">
        {breadcrumbs.map((item, index) => (
          <li key={item.path} className="flex items-center">
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
              <span className="font-medium text-gray-900">{item.title}</span>
            ) : (
              <Link
                to={item.path}
                className="hover:text-blue-600 hover:underline transition-colors duration-200"
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
    </nav>
  );
};

export default Breadcrumb;
