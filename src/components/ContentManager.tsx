import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { useLoading } from '../contexts/LoadingContext';
import { cmsService, ContentItem } from '../services/cmsService';

interface ContentManagerProps {
  onEditContent: (type: string, id: string) => void;
  onRefresh: () => void;
}

export const ContentManager: React.FC<ContentManagerProps> = ({ 
  onEditContent, 
  onRefresh 
}) => {
  const { addError } = useError();
  const { addLoading, removeLoading } = useLoading();

  const [content, setContent] = useState<ContentItem[]>([]);
  const [filteredContent, setFilteredContent] = useState<ContentItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    category: 'all',
    search: ''
  });

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [content, filters]);

  const loadContent = async () => {
    const loadingId = addLoading({ message: 'Loading content...' });
    try {
      const data = await cmsService.getAllContent();
      setContent(data);
    } catch (error) {
      addError({
        message: 'Failed to load content list',
        details: 'Content Load Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Content load error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const applyFilters = () => {
    let filtered = [...content];

    if (filters.type !== 'all') {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(item => item.category === filters.category);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        item.author.toLowerCase().includes(searchLower) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    setFilteredContent(filtered);
  };

  const handleBulkAction = async (action: 'publish' | 'unpublish' | 'delete') => {
    if (selectedItems.size === 0) {
      addError({
        message: 'Please select items to perform bulk action',
        details: 'No Selection',
        type: 'validation',
        severity: 'low'
      });
      return;
    }

    const loadingId = addLoading({ message: `Performing bulk ${action}...` });
    try {
      const contentIds = Array.from(selectedItems);
      
      switch (action) {
        case 'publish':
          await cmsService.bulkPublish(contentIds);
          break;
        case 'unpublish':
          await cmsService.bulkUnpublish(contentIds);
          break;
        case 'delete':
          // Handle bulk delete (would need to be implemented in the service)
          for (const id of contentIds) {
            const item = content.find(c => `${c.type}-${c.id}` === id);
            if (item) {
              await cmsService.deleteContent(item.type, item.id);
            }
          }
          break;
      }

      setSelectedItems(new Set());
      await loadContent();
      onRefresh();
    } catch (error) {
      addError({
        message: `Failed to ${action} selected items`,
        details: 'Bulk Action Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Bulk action error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const toggleSelection = (itemKey: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemKey)) {
      newSelection.delete(itemKey);
    } else {
      newSelection.add(itemKey);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredContent.length) {
      setSelectedItems(new Set());
    } else {
      const allKeys = filteredContent.map(item => `${item.type}-${item.id}`);
      setSelectedItems(new Set(allKeys));
    }
  };

  const getUniqueCategories = () => {
    const categories = content.map(item => item.category).filter(Boolean);
    return Array.from(new Set(categories));
  };

  return (
    <div className="content-manager">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              📄 Content Manager
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Manage all your articles, code examples, and collections
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => onEditContent('article', 'new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ➕ New Article
            </button>
            <button
              onClick={() => onEditContent('code-example', 'new')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              💻 New Code Example
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search content..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="article">Articles</option>
              <option value="code-example">Code Examples</option>
              <option value="collection">Collections</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {getUniqueCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              {selectedItems.size} item(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('publish')}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Publish
              </button>
              <button
                onClick={() => handleBulkAction('unpublish')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Unpublish
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedItems.size === filteredContent.length && filteredContent.length > 0}
              onChange={selectAll}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Select All ({filteredContent.length} items)
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredContent.map((item) => {
            const itemKey = `${item.type}-${item.id}`;
            return (
              <div key={itemKey} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(itemKey)}
                    onChange={() => toggleSelection(itemKey)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {item.type === 'article' ? '📄' : item.type === 'code-example' ? '💻' : '📁'}
                        </span>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              by {item.author}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(item.updatedAt).toLocaleDateString()}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          item.status === 'published' 
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                            : item.status === 'draft'
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                        }`}>
                          {item.status}
                        </span>
                        
                        <button
                          onClick={() => onEditContent(item.type, item.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                            +{item.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredContent.length === 0 && (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">📄</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No content found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filters.search || filters.type !== 'all' || filters.status !== 'all' || filters.category !== 'all'
                ? 'Try adjusting your filters to see more content.'
                : 'Create your first piece of content to get started.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
