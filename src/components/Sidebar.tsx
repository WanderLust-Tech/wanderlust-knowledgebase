import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ContentNode } from '../contentIndex';

interface SidebarProps { nodes: ContentNode[]; }

const Sidebar: React.FC<SidebarProps> = ({ nodes }) => (
  <aside className="w-64 bg-gray-100 dark:bg-gray-800 p-4 overflow-y-auto h-full flex-shrink-0 sidebar-scrollbar border-r border-gray-200 dark:border-gray-700">
    <ul>
      {nodes.map(node => <Node key={node.title} node={node} level={0} />)}
    </ul>
  </aside>
);

const Node: React.FC<{ node: ContentNode; level: number }> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const hasChildren = !!node.children;
  
  // Check if current path matches this node or any of its children
  const isCurrentPage = node.path && location.pathname === `/${node.path}`;
  const isParentOfCurrentPage = node.children?.some(child => 
    location.pathname.startsWith(`/${child.path}`) || 
    child.children?.some(grandchild => location.pathname.startsWith(`/${grandchild.path}`))
  );

  // Auto-expand if this node contains the current page
  useEffect(() => {
    if (isParentOfCurrentPage) {
      setIsExpanded(true);
    }
  }, [isParentOfCurrentPage]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Chevron right/down icon component
  const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg 
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  // Folder icon for parent nodes
  const FolderIcon = ({ expanded }: { expanded: boolean }) => (
    <svg 
      className="w-4 h-4 mr-2 flex-shrink-0" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      {expanded ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      )}
    </svg>
  );

  // Document icon for leaf nodes
  const DocumentIcon = () => (
    <svg 
      className="w-4 h-4 mr-2 flex-shrink-0" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <li className="mb-1">
      <div 
        className={`flex items-center rounded-md transition-colors duration-150 ${
          isCurrentPage 
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {hasChildren ? (
          <>
            <button
              onClick={toggleExpand}
              className={`flex items-center w-full px-2 py-2 text-left transition-colors duration-150 ${
                isCurrentPage ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <div className="mr-1 flex-shrink-0">
                <ChevronIcon expanded={isExpanded} />
              </div>
              <FolderIcon expanded={isExpanded} />
              <span className="font-medium">{node.title}</span>
            </button>
          </>
        ) : node.path ? (
          <Link 
            to={`/${node.path}`} 
            className={`flex items-center w-full px-2 py-2 transition-colors duration-150 ${
              isCurrentPage 
                ? 'text-blue-700 dark:text-blue-300 font-medium' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <div className="w-5 flex-shrink-0"></div> {/* Spacer for alignment */}
            <DocumentIcon />
            <span>{node.title}</span>
          </Link>
        ) : (
          <div className="flex items-center w-full px-2 py-2">
            <div className="w-5 flex-shrink-0"></div>
            <FolderIcon expanded={false} />
            <span className="font-semibold text-gray-900 dark:text-gray-100">{node.title}</span>
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="ml-4 mt-1">
          {node.children!.map(child => <Node key={child.title} node={child} level={level + 1} />)}
        </ul>
      )}
    </li>
  );
};

export default Sidebar;
