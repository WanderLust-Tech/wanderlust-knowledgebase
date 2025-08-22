import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookmarks, Bookmark } from '../contexts/BookmarkContext';

interface BookmarksPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ isOpen, onClose }) => {
  const { bookmarks, removeBookmark, clearAllBookmarks, exportBookmarks, importBookmarks } = useBookmarks();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'title' | 'category'>('timestamp');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(bookmarks.map(b => b.category).filter(Boolean)));
    return cats.sort();
  }, [bookmarks]);

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let filtered = bookmarks.filter(bookmark => {
      const matchesSearch = bookmark.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (bookmark.description && bookmark.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (bookmark.section && bookmark.section.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = filterCategory === 'all' || bookmark.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });

    // Sort bookmarks
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'timestamp':
        default:
          return b.timestamp - a.timestamp; // Newest first
      }
    });

    return filtered;
  }, [bookmarks, searchTerm, sortBy, filterCategory]);

  const handleBookmarkClick = (bookmark: Bookmark) => {
    let url = bookmark.url;
    if (bookmark.anchor) {
      url += `#${bookmark.anchor}`;
    }
    navigate(url);
    onClose();
  };

  const handleExport = () => {
    const data = JSON.stringify(exportBookmarks(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wanderlust-bookmarks.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          importBookmarks(imported);
        }
      } catch (error) {
        console.error('Failed to import bookmarks:', error);
        alert('Failed to import bookmarks. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bookmarks
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'timestamp' | 'title' | 'category')}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="timestamp">Recent</option>
                <option value="title">Title</option>
                <option value="category">Category</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Export
              </button>
              <label className="flex-1 cursor-pointer rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-center">
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              {bookmarks.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all bookmarks?')) {
                      clearAllBookmarks();
                    }
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Bookmarks List */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredBookmarks.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                {bookmarks.length === 0 ? (
                  <>
                    <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <p className="mt-2">No bookmarks yet</p>
                    <p className="text-sm">Click the bookmark icon on any page to save it here</p>
                  </>
                ) : (
                  <p>No bookmarks match your search</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="group rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                    onClick={() => handleBookmarkClick(bookmark)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {bookmark.title}
                        </h3>
                        {bookmark.section && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            Section: {bookmark.section}
                          </p>
                        )}
                        {bookmark.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {bookmark.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatDate(bookmark.timestamp)}</span>
                          {bookmark.category && (
                            <>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                {bookmark.category}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(bookmark.id);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove bookmark"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
