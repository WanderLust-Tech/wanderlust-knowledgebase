import { useState, useEffect } from 'react';

const STORAGE_KEY = 'sidebar-expanded-nodes';

/**
 * Custom hook for managing sidebar expanded nodes state with localStorage persistence
 */
export const useSidebarExpandedState = () => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Load persisted expanded state from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist expanded nodes to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedNodes]));
    } catch {
      // Ignore localStorage errors (e.g., in private browsing mode)
    }
  }, [expandedNodes]);

  const toggleNode = (nodeTitle: string) => {
    const newExpanded = new Set(expandedNodes);
    if (expandedNodes.has(nodeTitle)) {
      newExpanded.delete(nodeTitle);
    } else {
      newExpanded.add(nodeTitle);
    }
    setExpandedNodes(newExpanded);
  };

  const expandNode = (nodeTitle: string) => {
    if (!expandedNodes.has(nodeTitle)) {
      const newExpanded = new Set(expandedNodes);
      newExpanded.add(nodeTitle);
      setExpandedNodes(newExpanded);
    }
  };

  const collapseNode = (nodeTitle: string) => {
    if (expandedNodes.has(nodeTitle)) {
      const newExpanded = new Set(expandedNodes);
      newExpanded.delete(nodeTitle);
      setExpandedNodes(newExpanded);
    }
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const expandAll = (nodesList: string[]) => {
    setExpandedNodes(new Set(nodesList));
  };

  const isExpanded = (nodeTitle: string) => expandedNodes.has(nodeTitle);

  return {
    expandedNodes,
    setExpandedNodes,
    toggleNode,
    expandNode,
    collapseNode,
    collapseAll,
    expandAll,
    isExpanded
  };
};