import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ContentNode } from '../contentIndex';
import { contentIndexBuilder } from '../services/ContentIndexBuilder';
import { useSidebar } from '../contexts/SidebarContext';

interface HybridSidebarProps {
  fallbackNodes: ContentNode[];
}

const HybridSidebar: React.FC<HybridSidebarProps> = ({ fallbackNodes }) => {
  const { isOpen, isMobile, isInitialized } = useSidebar();
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [contentNodes, setContentNodes] = useState<ContentNode[]>(fallbackNodes);
  const [isLoading, setIsLoading] = useState(true);
  const [contentSource, setContentSource] = useState<'static' | 'dynamic' | 'hybrid'>('static');
  const location = useLocation();

  // Load dynamic content index
  useEffect(() => {
    loadContentIndex();
  }, []);

  const loadContentIndex = async () => {
    try {
      setIsLoading(true);
      const dynamicIndex = await contentIndexBuilder.buildDynamicIndex();
      
      // Determine if we're using dynamic content
      if (dynamicIndex !== fallbackNodes) {
        setContentNodes(dynamicIndex);
        setContentSource('hybrid');
      } else {
        setContentNodes(fallbackNodes);
        setContentSource('static');
      }
    } catch (error) {
      console.warn('Failed to load dynamic content index, using fallback:', error);
      setContentNodes(fallbackNodes);
      setContentSource('static');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-expand the node that contains the current page on mount and route changes
  useEffect(() => {
    const findNodeContainingPath = (nodes: ContentNode[], targetPath: string): string | null => {
      for (const node of nodes) {
        if (node.children) {
          // Check if any child or grandchild matches the current path
          const hasMatchingChild = node.children.some(child => 
            (child.path && targetPath.startsWith(`/${child.path}`)) ||
            (child.children?.some(grandchild => 
              grandchild.path && targetPath.startsWith(`/${grandchild.path}`)
            ))
          );
          
          if (hasMatchingChild) {
            return node.title;
          }
        }
      }
      return null;
    };

    const currentPath = location.pathname;
    const nodeToExpand = findNodeContainingPath(contentNodes, currentPath);
    
    if (nodeToExpand) {
      setExpandedNode(nodeToExpand);
    }
  }, [location.pathname, contentNodes]);

  const refreshIndex = async () => {
    contentIndexBuilder.clearCache();
    await loadContentIndex();
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <>
      <aside 
        className={`
          ${isMobile 
            ? `fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `${isOpen ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden`
          }
          bg-gray-100 dark:bg-gray-800 flex-shrink-0 border-r border-gray-200 dark:border-gray-700
        `}
      >
        <div className="w-64 p-4 overflow-y-auto h-full sidebar-scrollbar">
          {/* Content Source Indicator */}
          <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Content Source
              </span>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  contentSource === 'hybrid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  contentSource === 'dynamic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {contentSource.toUpperCase()}
                </span>
                {import.meta.env.DEV && (
                  <button
                    onClick={refreshIndex}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Refresh content index"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="ml-4 mt-2 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Content Tree */
            <ul>
              {contentNodes.map(node => (
                <Node 
                  key={node.title} 
                  node={node} 
                  level={0} 
                  expandedNode={expandedNode}
                  setExpandedNode={setExpandedNode}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
};

// Node component (same as original Sidebar)
const Node: React.FC<{ 
  node: ContentNode; 
  level: number; 
  expandedNode: string | null; 
  setExpandedNode: (node: string | null) => void;
}> = ({ node, level, expandedNode, setExpandedNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasChildren = node.children && node.children.length > 0;
  
  // For top-level nodes (level 0), use accordion behavior
  // For nested nodes, use individual toggle behavior
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if this node or any of its children matches the current path
  const isCurrentPage = node.path && location.pathname === `/${node.path}`;
  const isParentOfCurrentPage = hasChildren && node.children!.some(child => 
    child.path && location.pathname.startsWith(`/${child.path}`)
  );

  // Auto-expand logic based on current page
  useEffect(() => {
    if (level === 0) {
      // Top-level: use accordion (expandedNode state)
      if (expandedNode === node.title) {
        setIsExpanded(true);
      } else {
        setIsExpanded(false);
      }
    } else {
      // Nested: expand if it contains current page
      if (isParentOfCurrentPage || isCurrentPage) {
        setIsExpanded(true);
      }
    }
  }, [expandedNode, isParentOfCurrentPage, level, node.title]);

  const toggleExpand = () => {
    // For accordion behavior: only apply to top-level nodes (level 0)
    if (level === 0) {
      // If this node is already expanded, close it
      // Otherwise, set this node as the only expanded one
      if (expandedNode === node.title) {
        setExpandedNode(null);
      } else {
        setExpandedNode(node.title);
      }
    } else {
      // For nested nodes, use normal toggle behavior
      setIsExpanded(!isExpanded);
    }
  };

  // Handle folder click: both expand and navigate to overview
  const handleFolderClick = () => {
    // Toggle expansion with accordion behavior for top-level, normal for nested
    toggleExpand();
    
    // Navigate to overview if we can determine the folder path
    if (hasChildren && node.children && node.children.length > 0) {
      // Try to find an overview.md in the children
      const overviewChild = node.children.find(child => 
        child.path && (child.path.includes('overview') || child.path.includes('index'))
      );
      
      if (overviewChild) {
        navigate(`/${overviewChild.path}`);
      } else {
        // Navigate to the first child if no overview found
        const firstChild = node.children[0];
        if (firstChild && firstChild.path) {
          navigate(`/${firstChild.path}`);
        }
      }
    }
  };

  const FolderIcon = ({ expanded }: { expanded: boolean }) => (
    <svg 
      className={`w-4 h-4 mr-2 transition-transform duration-200 ${expanded ? 'transform rotate-90' : ''}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const DocumentIcon = () => (
    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <li>
      <div className={`group ${level === 0 ? 'mb-1' : ''}`}>
        {node.path ? (
          <Link
            to={`/${node.path}`}
            className={`flex items-center w-full px-2 py-3 transition-colors duration-150 text-base leading-6 ${
              isCurrentPage 
                ? 'text-blue-700 dark:text-blue-300 font-medium' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <div className="w-5 flex-shrink-0"></div> {/* Spacer for alignment */}
            <DocumentIcon />
            <span>{node.title}</span>
          </Link>
        ) : hasChildren ? (
          <button
            onClick={handleFolderClick}
            className={`flex items-center w-full px-2 py-3 text-left transition-colors duration-150 text-base leading-6 ${
              level === 0 
                ? 'font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400' 
                : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            {level > 0 && <div className="w-5 flex-shrink-0"></div>}
            <FolderIcon expanded={isExpanded} />
            <span>{node.title}</span>
          </button>
        ) : (
          <div className="flex items-center w-full px-2 py-3 text-base leading-6">
            <div className="w-5 flex-shrink-0"></div>
            <FolderIcon expanded={false} />
            <span className="font-semibold text-gray-900 dark:text-gray-100">{node.title}</span>
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="ml-4 mt-1">
          {node.children!.map(child => (
            <Node 
              key={child.title} 
              node={child} 
              level={level + 1} 
              expandedNode={expandedNode}
              setExpandedNode={setExpandedNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default HybridSidebar;
