import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ContentNode } from '../contentIndex';

interface SidebarProps { nodes: ContentNode[]; }

const Sidebar: React.FC<SidebarProps> = ({ nodes }) => (
  <aside className="w-64 bg-gray-100 p-4 overflow-y-auto h-full flex-shrink-0 sidebar-scrollbar">
    <ul>
      {nodes.map(node => <Node key={node.title} node={node} />)}
    </ul>
  </aside>
);

const Node: React.FC<{ node: ContentNode }> = ({ node }) => {
    const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = !!node.children;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <li className="mb-2">
      <div className="flex items-center">
        {hasChildren && (
          <button
            onClick={toggleExpand}
            className="mr-2 text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '-' : '+'}
          </button>
        )}
        {node.path ? (
          <Link to={`/${node.path}`} className="block py-1 hover:text-blue-600">
            {node.title}
          </Link>
        ) : (
          <span className="font-semibold">{node.title}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="pl-4">
          {node.children!.map(child => <Node key={child.title} node={child} />)}
        </ul>
      )}
    </li>
  );
};

export default Sidebar;