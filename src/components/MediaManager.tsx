import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { useLoading } from '../contexts/LoadingContext';
import { cmsService, MediaItem, MediaStats } from '../services/cmsService';

export const MediaManager: React.FC = () => {
  const { addError } = useError();
  const { addLoading, removeLoading } = useLoading();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    type: 'all',
    search: ''
  });

  useEffect(() => {
    loadMedia();
    loadStats();
  }, []);

  const loadMedia = async () => {
    const loadingId = addLoading({ message: 'Loading media...' });
    try {
      const data = await cmsService.getMedia();
      setMedia(data);
    } catch (error) {
      addError({
        message: 'Failed to load media files',
        details: 'Media Load Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Media load error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const loadStats = async () => {
    try {
      const data = await cmsService.getMediaStats();
      setStats(data);
    } catch (error) {
      console.error('Stats load error:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const loadingId = addLoading({ message: 'Uploading files...' });
    try {
      for (const file of Array.from(files)) {
        await cmsService.uploadMedia(file, {
          description: `Uploaded ${new Date().toLocaleDateString()}`
        });
      }
      await loadMedia();
      await loadStats();
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      addError({
        message: 'Failed to upload some files',
        details: 'Upload Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Upload error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    const loadingId = addLoading({ message: 'Deleting files...' });
    try {
      for (const fileId of selectedFiles) {
        await cmsService.deleteMedia(fileId);
      }
      setSelectedFiles(new Set());
      await loadMedia();
      await loadStats();
    } catch (error) {
      addError({
        message: 'Failed to delete some files',
        details: 'Delete Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Delete error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const toggleSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const filteredMedia = media.filter(item => {
    if (filters.type !== 'all' && !item.mimeType.startsWith(filters.type)) {
      return false;
    }
    if (filters.search && !item.originalName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="media-manager">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              📁 Media Manager
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Upload and manage your media files
            </p>
          </div>
          <div className="flex space-x-3">
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              📤 Upload Files
            </label>
            {selectedFiles.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Delete Selected ({selectedFiles.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalFiles}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Files</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {cmsService.formatFileSize(stats.totalSize)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Storage Used</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.imageCount}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Images</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.recentUploads}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recent Uploads</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Files
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by filename..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="image">Images</option>
              <option value="application">Documents</option>
              <option value="text">Text Files</option>
            </select>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {filteredMedia.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
            {filteredMedia.map((item) => (
              <div
                key={item.id}
                className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                  selectedFiles.has(item.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-2xl">
                    {cmsService.getFileIcon(item.mimeType)}
                  </span>
                </div>

                {cmsService.isImageFile(item.mimeType) ? (
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.alt || item.originalName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-4xl">
                      {cmsService.getFileIcon(item.mimeType)}
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {item.originalName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {cmsService.formatFileSize(item.size)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.uploadedAt).toLocaleDateString()}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(item.url)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"
                  >
                    Copy URL
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">📁</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No media files found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Upload your first file to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
