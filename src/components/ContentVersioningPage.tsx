/**
 * Content Versioning Page
 * Main page for content versioning, collaborative editing,
 * branch management, and version control operations
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VersionHistoryView from '../components/VersionHistoryView';
import { useVersioning } from '../hooks/useVersioning';
import { ContentVersion, VersionAuthor } from '../types/VersioningTypes';

const ContentVersioningPage: React.FC = () => {
  const { contentPath } = useParams<{ contentPath: string }>();
  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState<'editor' | 'history' | 'analytics'>('editor');
  const [isEditing, setIsEditing] = useState(false);

  // Decode content path from URL
  const decodedContentPath = contentPath ? decodeURIComponent(contentPath) : '/content/architecture/overview.md';

  // Use versioning hook
  const {
    versionHistory,
    currentVersion,
    publishedVersion,
    content,
    setContent,
    hasUnsavedChanges,
    saveContent,
    discardChanges,
    isLoading,
    error,
    collaborativeSession,
    startCollaboration,
    endCollaboration,
    collaborators,
    publishVersion,
    rollbackToVersion,
    createBranch,
    getVersioningAnalytics
  } = useVersioning({
    contentPath: decodedContentPath,
    autoSave: true,
    autoSaveInterval: 30000,
    enableRealTimeSync: true,
    onVersionChange: (version) => {
      console.log('Version changed:', version);
    },
    onContentChange: (newContent) => {
      console.log('Content changed, length:', newContent.length);
    },
    onCollaboratorJoin: (collaborator) => {
      console.log('Collaborator joined:', collaborator.name);
    }
  });

  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (selectedView === 'analytics') {
      const analyticsData = getVersioningAnalytics();
      setAnalytics(analyticsData);
    }
  }, [selectedView, getVersioningAnalytics]);

  const handleVersionSelect = (version: ContentVersion) => {
    setContent(version.content);
    setSelectedView('editor');
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleSave = async () => {
    const success = await saveContent();
    if (success) {
      setIsEditing(false);
    }
  };

  const handlePublish = async () => {
    if (currentVersion) {
      const success = await publishVersion(currentVersion.id);
      if (success) {
        console.log('Version published successfully');
      }
    }
  };

  const handleStartCollaboration = async () => {
    const session = await startCollaboration();
    if (session) {
      console.log('Collaboration started:', session.id);
    }
  };

  const handleEndCollaboration = async () => {
    const success = await endCollaboration();
    if (success) {
      console.log('Collaboration ended');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading content versioning...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Content</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/content')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Content
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/content')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to Content
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Content Versioning</h1>
                <p className="text-sm text-gray-500">{decodedContentPath}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-yellow-600">Unsaved changes</span>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={discardChanges}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Discard
                  </button>
                </div>
              )}

              {currentVersion?.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Publish
                </button>
              )}

              {!collaborativeSession ? (
                <button
                  onClick={handleStartCollaboration}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Start Collaboration
                </button>
              ) : (
                <button
                  onClick={handleEndCollaboration}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  End Collaboration
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Collaboration Status */}
      {collaborativeSession && (
        <div className="bg-purple-50 border-b border-purple-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-purple-800">
                    Collaborative Session Active
                  </span>
                </div>
                <span className="text-sm text-purple-600">
                  {collaborators.length} collaborator(s)
                </span>
              </div>
              <div className="flex -space-x-2">
                {collaborators.slice(0, 3).map((collaborator, index) => (
                  <div
                    key={collaborator.id}
                    className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-xs font-medium text-purple-800 border-2 border-white"
                    title={collaborator.name}
                  >
                    {collaborator.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {collaborators.length > 3 && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 border-2 border-white">
                    +{collaborators.length - 3}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {(['editor', 'history', 'analytics'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedView === view
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedView === 'editor' && (
          <ContentEditor
            content={content}
            onContentChange={handleContentChange}
            isEditing={isEditing}
            onEditingChange={setIsEditing}
            currentVersion={currentVersion}
            publishedVersion={publishedVersion}
          />
        )}

        {selectedView === 'history' && (
          <VersionHistoryView
            contentPath={decodedContentPath}
            onVersionSelect={handleVersionSelect}
            onContentChange={handleContentChange}
          />
        )}

        {selectedView === 'analytics' && (
          <VersioningAnalytics analytics={analytics} />
        )}
      </div>
    </div>
  );
};

// Content Editor Component
interface ContentEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  currentVersion: ContentVersion | null;
  publishedVersion: ContentVersion | null;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  content,
  onContentChange,
  isEditing,
  onEditingChange,
  currentVersion,
  publishedVersion
}) => {
  return (
    <div className="space-y-6">
      {/* Version Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-700">Current Version</h4>
            {currentVersion ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">Version {currentVersion.version}</p>
                <p className="text-sm text-gray-600">
                  Status: <span className="font-medium">{currentVersion.status}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Author: {currentVersion.author.name}
                </p>
                <p className="text-sm text-gray-600">
                  Modified: {new Date(currentVersion.timestamp).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No current version</p>
            )}
          </div>

          <div>
            <h4 className="font-medium text-gray-700">Published Version</h4>
            {publishedVersion ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">Version {publishedVersion.version}</p>
                <p className="text-sm text-gray-600">
                  Published: {new Date(publishedVersion.timestamp).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  Author: {publishedVersion.author.name}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No published version</p>
            )}
          </div>
        </div>
      </div>

      {/* Content Editor */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Content Editor</h3>
            <button
              onClick={() => onEditingChange(!isEditing)}
              className={`px-3 py-1 text-sm rounded ${
                isEditing
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {isEditing ? 'Stop Editing' : 'Start Editing'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {isEditing ? (
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-vertical focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter content here..."
            />
          ) : (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg border">
                {content || 'No content available'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Versioning Analytics Component
interface VersioningAnalyticsProps {
  analytics: any;
}

const VersioningAnalytics: React.FC<VersioningAnalyticsProps> = ({ analytics }) => {
  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Versioning Analytics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{analytics.totalChanges || 0}</div>
            <div className="text-sm text-gray-600">Total Changes</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{analytics.contributors || 0}</div>
            <div className="text-sm text-gray-600">Contributors</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{analytics.averageReviewTime || 0}h</div>
            <div className="text-sm text-gray-600">Avg Review Time</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{analytics.approvalRate || 0}%</div>
            <div className="text-sm text-gray-600">Approval Rate</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Change Frequency</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Daily</span>
              <span className="font-medium">{analytics.changeFrequency?.daily || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Weekly</span>
              <span className="font-medium">{analytics.changeFrequency?.weekly || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Monthly</span>
              <span className="font-medium">{analytics.changeFrequency?.monthly || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Content Growth</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Word Count Change</span>
              <span className="font-medium">{analytics.contentGrowth?.wordCountChange || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Section Changes</span>
              <span className="font-medium">{analytics.contentGrowth?.sectionChanges || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Quality Improvements</span>
              <span className="font-medium">{analytics.contentGrowth?.qualityImprovements || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentVersioningPage;
