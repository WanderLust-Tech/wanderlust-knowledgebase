import React from 'react';
import ArticleSyncManager from './ArticleSyncManager';
import { SyncResult } from '../services/ArticleSyncService';

const ArticleSyncPage: React.FC = () => {
  const handleSyncComplete = (result: SyncResult) => {
    console.log('Sync completed:', result);
    // Could show a toast notification or update global state
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Content Management
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Synchronize and manage article content between markdown files and the database
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                About Content Synchronization
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                <p>
                  This tool synchronizes content between the markdown files in your repository 
                  and the database. Use it to:
                </p>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Import markdown files into the database for API access</li>
                  <li>Keep content consistent between file system and database</li>
                  <li>Validate content integrity and detect issues</li>
                  <li>Export database articles back to markdown files</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <ArticleSyncManager 
          onSyncComplete={handleSyncComplete}
          showAdvancedOptions={true}
        />

        <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Markdown to Database</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Scans all .md files in the content directory</li>
                <li>Parses frontmatter metadata (title, tags, etc.)</li>
                <li>Extracts content and calculates reading time</li>
                <li>Creates or updates articles in the database</li>
                <li>Preserves file modification timestamps</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Database to Markdown</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Exports published articles from database</li>
                <li>Generates frontmatter with metadata</li>
                <li>Creates directory structure as needed</li>
                <li>Preserves article content and formatting</li>
                <li>Updates existing files or creates new ones</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Important Notes
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                <ul className="list-disc list-inside space-y-1">
                  <li>Always backup your content before performing sync operations</li>
                  <li>The sync process will overwrite existing data - use validation first</li>
                  <li>Large content repositories may take several minutes to sync</li>
                  <li>Ensure the API server has proper file system permissions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleSyncPage;
