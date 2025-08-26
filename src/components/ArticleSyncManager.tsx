import React, { useState, useEffect } from 'react';
import { articleSyncService, SyncResult, SyncStatus, ValidationResult } from '../services/ArticleSyncService';

interface ArticleSyncManagerProps {
  onSyncComplete?: (result: SyncResult) => void;
  showAdvancedOptions?: boolean;
}

const ArticleSyncManager: React.FC<ArticleSyncManagerProps> = ({ 
  onSyncComplete, 
  showAdvancedOptions = true 
}) => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'sync' | 'validation'>('status');

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      setError(null);
      const statusData = await articleSyncService.getSyncStatus();
      setStatus(statusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync status');
    }
  };

  const performValidation = async () => {
    try {
      setLoading(true);
      setError(null);
      const validationData = await articleSyncService.validateContent();
      setValidation(validationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const performSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncProgress([]);
      setSyncResult(null);

      const result = await articleSyncService.performFullSync((message) => {
        setSyncProgress(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
      });

      setSyncResult(result);
      onSyncComplete?.(result);
      
      // Refresh status after sync
      await loadSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const performQuickSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setSyncResult(null);

      const result = await articleSyncService.syncFromMarkdown();
      setSyncResult(result);
      onSyncComplete?.(result);
      
      // Refresh status after sync
      await loadSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick sync failed');
    } finally {
      setLoading(false);
    }
  };

  const syncToMarkdown = async () => {
    try {
      setLoading(true);
      setError(null);

      await articleSyncService.syncToMarkdown();
      setSyncProgress(prev => [...prev, `${new Date().toLocaleTimeString()}: Database synced to markdown files`]);
      
      // Refresh status after sync
      await loadSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync to markdown failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (isGood: boolean) => {
    return isGood ? (
      <span className="text-green-500">✅</span>
    ) : (
      <span className="text-red-500">❌</span>
    );
  };

  const tabClasses = (isActive: boolean) => 
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive 
        ? 'bg-blue-500 text-white' 
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Article Content Sync Manager
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Synchronize content between markdown files and the database
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setActiveTab('status')}
          className={tabClasses(activeTab === 'status')}
        >
          Status
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={tabClasses(activeTab === 'sync')}
        >
          Sync Operations
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={tabClasses(activeTab === 'validation')}
        >
          Validation
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">⚠️</span>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Status</h3>
            {status ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Content Path Configured:</span>
                    {getStatusIcon(status.isContentPathConfigured)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Content Path Exists:</span>
                    {getStatusIcon(status.contentPathExists)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Markdown Files:</span>
                    <span className="font-mono text-gray-900 dark:text-white">{status.markdownFileCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Database Articles:</span>
                    <span className="font-mono text-gray-900 dark:text-white">{status.databaseArticleCount}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 block">Content Path:</span>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {status.contentPath || 'Not configured'}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 block">Last Sync:</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
            <div className="mt-4">
              <button
                onClick={loadSyncStatus}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Tab */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Quick Sync</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sync markdown files to database (fast operation)
              </p>
              <button
                onClick={performQuickSync}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Syncing...' : 'Quick Sync'}
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Full Sync</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Complete sync with validation and progress tracking
              </p>
              <button
                onClick={performSync}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Syncing...' : 'Full Sync'}
              </button>
            </div>
          </div>

          {showAdvancedOptions && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Advanced Options</h3>
              <div className="space-y-2">
                <button
                  onClick={syncToMarkdown}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                >
                  Sync Database to Markdown
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  ⚠️ This will overwrite markdown files with database content
                </p>
              </div>
            </div>
          )}

          {/* Progress Display */}
          {syncProgress.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Sync Progress</h3>
              <div className="max-h-40 overflow-y-auto">
                {syncProgress.map((message, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync Results */}
          {syncResult && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-2">Sync Complete</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-green-700 dark:text-green-400 block">Files Processed</span>
                  <span className="font-mono text-green-900 dark:text-green-300">{syncResult.filesProcessed}</span>
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 block">Created</span>
                  <span className="font-mono text-green-900 dark:text-green-300">{syncResult.articlesCreated}</span>
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 block">Updated</span>
                  <span className="font-mono text-green-900 dark:text-green-300">{syncResult.articlesUpdated}</span>
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 block">Skipped</span>
                  <span className="font-mono text-green-900 dark:text-green-300">{syncResult.articlesSkipped}</span>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <div className="mt-4">
                  <span className="text-red-700 dark:text-red-400 block mb-2">Errors ({syncResult.errors.length}):</span>
                  <div className="max-h-32 overflow-y-auto">
                    {syncResult.errors.map((error, index) => (
                      <div key={index} className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Validation Tab */}
      {activeTab === 'validation' && (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content Validation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Check for issues in markdown files before syncing
            </p>
            <button
              onClick={performValidation}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Validating...' : 'Run Validation'}
            </button>
          </div>

          {validation && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Validation Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block">Total Files</span>
                  <span className="font-mono text-gray-900 dark:text-white">{validation.totalMarkdownFiles}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block">Files with Issues</span>
                  <span className="font-mono text-gray-900 dark:text-white">{validation.filesWithIssues}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block">Validated At</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {new Date(validation.validationTime).toLocaleString()}
                  </span>
                </div>
              </div>

              {validation.issues.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Issues Found:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {validation.issues.map((issue, index) => (
                      <div key={index} className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.issues.length === 0 && (
                <div className="text-green-600 dark:text-green-400 text-center py-4">
                  ✅ No issues found! Content is ready for sync.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArticleSyncManager;
