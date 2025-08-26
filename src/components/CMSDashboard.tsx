import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';
import { useLoading } from '../contexts/LoadingContext';
import { cmsService, ContentItem, ContentAnalytics, MediaStats } from '../services/cmsService';
import { ContentManager } from './ContentManager';
import { MediaManager } from './MediaManager';
import { ContentEditor } from './ContentEditor';

interface CMSDashboardProps {
  className?: string;
}

type ActiveView = 'overview' | 'content' | 'media' | 'analytics' | 'editor';

export const CMSDashboard: React.FC<CMSDashboardProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const { addError } = useError();
  const { addLoading, removeLoading } = useLoading();

  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [contentAnalytics, setContentAnalytics] = useState<ContentAnalytics | null>(null);
  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<{ type: string; id: string } | null>(null);

  // Check if user has CMS access
  const hasCMSAccess = user?.role === 'Admin' || user?.role === 'Moderator';

  useEffect(() => {
    if (hasCMSAccess) {
      loadDashboardData();
    }
  }, [hasCMSAccess]);

  const loadDashboardData = async () => {
    const loadingId = addLoading({ message: 'Loading CMS dashboard...' });
    try {
      const [analytics, media, content] = await Promise.all([
        cmsService.getContentAnalytics(),
        cmsService.getMediaStats(),
        cmsService.getAllContent()
      ]);

      setContentAnalytics(analytics);
      setMediaStats(media);
      setRecentContent(content.slice(0, 10)); // Show recent 10 items
    } catch (error) {
      addError({
        message: 'Failed to load CMS dashboard data',
        details: 'Dashboard Load Failed',
        type: 'api',
        severity: 'medium'
      });
      console.error('Dashboard load error:', error);
    } finally {
      removeLoading(loadingId);
    }
  };

  const handleEditContent = (type: string, id: string) => {
    setSelectedContent({ type, id });
    setActiveView('editor');
  };

  const handleCloseEditor = () => {
    setSelectedContent(null);
    setActiveView('content');
    loadDashboardData(); // Refresh data after editing
  };

  if (!hasCMSAccess) {
    return (
      <div className={`cms-dashboard-unauthorized ${className}`}>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">🔒</span>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">
                Access Restricted
              </h3>
              <p className="text-yellow-600 dark:text-yellow-300 mt-1">
                You need Admin or Moderator privileges to access the Content Management System.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="cms-overview space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📊 CMS Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your content, media, and platform analytics
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {contentAnalytics && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📄</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Articles
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {contentAnalytics.totalArticles}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Published
                  </p>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {contentAnalytics.publishedArticles}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📝</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Drafts
                  </p>
                  <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
                    {contentAnalytics.draftArticles}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">💻</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Code Examples
                  </p>
                  <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                    {contentAnalytics.totalCodeExamples}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Media Stats */}
      {mediaStats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📁 Media Library
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {mediaStats.totalFiles}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Files</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {cmsService.formatFileSize(mediaStats.totalSize)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Storage Used</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {mediaStats.recentUploads}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recent Uploads</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            📄 Recent Content
          </h2>
          <button
            onClick={() => setActiveView('content')}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            View All
          </button>
        </div>
        
        <div className="space-y-3">
          {recentContent.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">
                  {item.type === 'article' ? '📄' : '💻'}
                </span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.author} • {new Date(item.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  item.status === 'published' 
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                    : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                }`}>
                  {item.status}
                </span>
                <button
                  onClick={() => handleEditContent(item.type, item.id)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`cms-dashboard ${className}`}>
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm mb-6">
        <div className="px-6 py-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveView('overview')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveView('content')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'content'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📄 Content
            </button>
            <button
              onClick={() => setActiveView('media')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'media'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📁 Media
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'analytics'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📊 Analytics
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="px-6">
        {activeView === 'overview' && renderOverview()}
        {activeView === 'content' && (
          <ContentManager 
            onEditContent={handleEditContent}
            onRefresh={loadDashboardData}
          />
        )}
        {activeView === 'media' && (
          <MediaManager />
        )}
        {activeView === 'analytics' && contentAnalytics && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📊 Detailed Analytics
            </h2>
            {/* Add detailed analytics components here */}
            <p className="text-gray-600 dark:text-gray-300">
              Advanced analytics coming soon...
            </p>
          </div>
        )}
        {activeView === 'editor' && selectedContent && (
          <ContentEditor
            contentType={selectedContent.type}
            contentId={selectedContent.id}
            onClose={handleCloseEditor}
          />
        )}
      </div>
    </div>
  );
};
