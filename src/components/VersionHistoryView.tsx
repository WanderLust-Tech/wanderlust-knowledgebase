/**
 * Version History Component
 * Interactive version history viewer with diff comparison,
 * collaborative editing, branch management, and merge capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ContentVersion, 
  VersionHistory, 
  VersionDiff, 
  VersionBranch,
  MergeRequest,
  CollaborativeSession,
  VersionAuthor 
} from '../types/VersioningTypes';
import { versioningService } from '../services/ContentVersioningService';

interface VersionHistoryViewProps {
  contentPath: string;
  onVersionSelect?: (version: ContentVersion) => void;
  onContentChange?: (content: string) => void;
}

const VersionHistoryView: React.FC<VersionHistoryViewProps> = ({
  contentPath,
  onVersionSelect,
  onContentChange
}) => {
  const [versionHistory, setVersionHistory] = useState<VersionHistory | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<[string?, string?]>([]);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'branches' | 'collaborative'>('history');
  const [collaborativeSession, setCollaborativeSession] = useState<CollaborativeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDiffView, setShowDiffView] = useState(false);

  // Current user (mock data)
  const currentUser: VersionAuthor = {
    id: 'user-1',
    name: 'Current User',
    email: 'user@wanderlust.dev',
    role: 'editor',
    expertise: ['documentation', 'architecture']
  };

  useEffect(() => {
    loadVersionHistory();
  }, [contentPath]);

  const loadVersionHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const history = versioningService.getVersionHistory(contentPath);
      setVersionHistory(history);
    } catch (error) {
      console.error('Failed to load version history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contentPath]);

  const handleVersionSelect = useCallback((versionId: string) => {
    const version = versionHistory?.versions.find(v => v.id === versionId);
    if (version && onVersionSelect) {
      onVersionSelect(version);
    }
  }, [versionHistory, onVersionSelect]);

  const handleVersionCompare = useCallback((versionId: string) => {
    if (!selectedVersions[0]) {
      setSelectedVersions([versionId]);
    } else if (!selectedVersions[1]) {
      setSelectedVersions([selectedVersions[0], versionId]);
      generateDiff(selectedVersions[0], versionId);
    } else {
      setSelectedVersions([versionId]);
      setDiff(null);
      setShowDiffView(false);
    }
  }, [selectedVersions]);

  const generateDiff = useCallback(async (fromVersionId: string, toVersionId: string) => {
    try {
      const versionDiff = versioningService.generateDiff(contentPath, fromVersionId, toVersionId);
      setDiff(versionDiff);
      setShowDiffView(true);
    } catch (error) {
      console.error('Failed to generate diff:', error);
    }
  }, [contentPath]);

  const handleCreateBranch = useCallback(async (branchName: string, description: string, baseVersionId: string) => {
    try {
      const branch = versioningService.createBranch(contentPath, branchName, description, baseVersionId, currentUser);
      await loadVersionHistory();
      console.log('Branch created:', branch);
    } catch (error) {
      console.error('Failed to create branch:', error);
    }
  }, [contentPath, currentUser, loadVersionHistory]);

  const handleStartCollaboration = useCallback(async () => {
    try {
      const session = versioningService.startCollaborativeSession(contentPath, currentUser);
      setCollaborativeSession(session);
      setActiveTab('collaborative');
    } catch (error) {
      console.error('Failed to start collaboration:', error);
    }
  }, [contentPath, currentUser]);

  const handlePublishVersion = useCallback(async (versionId: string) => {
    try {
      const success = versioningService.publishVersion(contentPath, versionId, currentUser);
      if (success) {
        await loadVersionHistory();
        console.log('Version published successfully');
      }
    } catch (error) {
      console.error('Failed to publish version:', error);
    }
  }, [contentPath, currentUser, loadVersionHistory]);

  const handleRollback = useCallback(async (versionId: string) => {
    try {
      const rollbackVersion = versioningService.rollbackToVersion(contentPath, versionId, currentUser);
      if (rollbackVersion && onContentChange) {
        onContentChange(rollbackVersion.content);
        await loadVersionHistory();
      }
    } catch (error) {
      console.error('Failed to rollback:', error);
    }
  }, [contentPath, currentUser, onContentChange, loadVersionHistory]);

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading version history...</span>
      </div>
    );
  }

  if (!versionHistory) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No version history found for this content.</p>
        <button
          onClick={() => {/* Create initial version */}}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Initialize Versioning
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
          <div className="flex space-x-2">
            <button
              onClick={handleStartCollaboration}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Start Collaboration
            </button>
            <button
              onClick={() => setShowDiffView(!showDiffView)}
              disabled={selectedVersions.length < 2}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              Compare Versions
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-4">
          {(['history', 'branches', 'collaborative'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm font-medium rounded ${
                activeTab === tab
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {showDiffView && diff ? (
          <DiffView diff={diff} onClose={() => setShowDiffView(false)} />
        ) : (
          <>
            {activeTab === 'history' && (
              <VersionList
                versions={versionHistory.versions}
                selectedVersions={selectedVersions}
                onVersionSelect={handleVersionSelect}
                onVersionCompare={handleVersionCompare}
                onPublishVersion={handlePublishVersion}
                onRollback={handleRollback}
                formatTimestamp={formatTimestamp}
                getStatusBadgeColor={getStatusBadgeColor}
              />
            )}

            {activeTab === 'branches' && (
              <BranchView
                branches={versionHistory.branches}
                onCreateBranch={handleCreateBranch}
              />
            )}

            {activeTab === 'collaborative' && (
              <CollaborativeView
                session={collaborativeSession}
                onJoinSession={(sessionId) => versioningService.joinCollaborativeSession(sessionId, currentUser)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Version List Component
interface VersionListProps {
  versions: ContentVersion[];
  selectedVersions: [string?, string?];
  onVersionSelect: (versionId: string) => void;
  onVersionCompare: (versionId: string) => void;
  onPublishVersion: (versionId: string) => void;
  onRollback: (versionId: string) => void;
  formatTimestamp: (timestamp: Date) => string;
  getStatusBadgeColor: (status: string) => string;
}

const VersionList: React.FC<VersionListProps> = ({
  versions,
  selectedVersions,
  onVersionSelect,
  onVersionCompare,
  onPublishVersion,
  onRollback,
  formatTimestamp,
  getStatusBadgeColor
}) => (
  <div className="space-y-4">
    {versions.map((version) => (
      <div
        key={version.id}
        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
          selectedVersions.includes(version.id)
            ? 'border-blue-300 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={selectedVersions.includes(version.id)}
              onChange={() => onVersionCompare(version.id)}
              className="rounded border-gray-300"
            />
            <div>
              <h4 className="font-medium text-gray-900">
                Version {version.version} - {version.title}
              </h4>
              <p className="text-sm text-gray-500">
                by {version.author.name} • {formatTimestamp(version.timestamp)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(version.status)}`}>
              {version.status}
            </span>
            
            <div className="flex space-x-1">
              <button
                onClick={() => onVersionSelect(version.id)}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                View
              </button>
              {version.status === 'draft' && (
                <button
                  onClick={() => onPublishVersion(version.id)}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  Publish
                </button>
              )}
              <button
                onClick={() => onRollback(version.id)}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
              >
                Rollback
              </button>
            </div>
          </div>
        </div>

        {version.changes.length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            <p>{version.changes.length} change(s): {version.changes.map(c => c.description).join(', ')}</p>
          </div>
        )}
      </div>
    ))}
  </div>
);

// Diff View Component
interface DiffViewProps {
  diff: VersionDiff;
  onClose: () => void;
}

const DiffView: React.FC<DiffViewProps> = ({ diff, onClose }) => (
  <div className="border rounded-lg">
    <div className="flex items-center justify-between p-4 border-b">
      <h4 className="font-medium">
        Version {diff.fromVersion} → {diff.toVersion}
      </h4>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>
    </div>
    
    <div className="p-4">
      <div className="mb-4 flex space-x-4 text-sm">
        <span className="text-green-600">+{diff.summary.additions} additions</span>
        <span className="text-red-600">-{diff.summary.deletions} deletions</span>
        <span className="text-blue-600">{diff.summary.modifications} modifications</span>
      </div>
      
      <div className="space-y-2">
        {diff.sections.map((section, index) => (
          <div key={index} className="border rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{section.section}</span>
              <span className={`px-2 py-1 text-xs rounded ${
                section.type === 'addition' ? 'bg-green-100 text-green-800' :
                section.type === 'deletion' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {section.type}
              </span>
            </div>
            
            {section.oldContent && (
              <div className="mb-2">
                <div className="text-xs text-gray-500 mb-1">Before:</div>
                <div className="bg-red-50 p-2 rounded text-sm font-mono">
                  {section.oldContent}
                </div>
              </div>
            )}
            
            {section.newContent && (
              <div>
                <div className="text-xs text-gray-500 mb-1">After:</div>
                <div className="bg-green-50 p-2 rounded text-sm font-mono">
                  {section.newContent}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Branch View Component
interface BranchViewProps {
  branches: VersionBranch[];
  onCreateBranch: (name: string, description: string, baseVersionId: string) => void;
}

const BranchView: React.FC<BranchViewProps> = ({ branches, onCreateBranch }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', description: '', baseVersionId: '' });

  const handleCreateBranch = () => {
    if (branchForm.name && branchForm.description && branchForm.baseVersionId) {
      onCreateBranch(branchForm.name, branchForm.description, branchForm.baseVersionId);
      setBranchForm({ name: '', description: '', baseVersionId: '' });
      setShowCreateForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Branches</h4>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Branch
        </button>
      </div>

      {showCreateForm && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h5 className="font-medium mb-3">Create New Branch</h5>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Branch name"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <textarea
              placeholder="Description"
              value={branchForm.description}
              onChange={(e) => setBranchForm({ ...branchForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
            <input
              type="text"
              placeholder="Base version ID"
              value={branchForm.baseVersionId}
              onChange={(e) => setBranchForm({ ...branchForm, baseVersionId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleCreateBranch}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {branches.map((branch) => (
          <div key={branch.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium">{branch.name}</h5>
                <p className="text-sm text-gray-600">{branch.description}</p>
                <p className="text-xs text-gray-500">
                  Created by {branch.author.name} • {branch.versions.length} versions
                </p>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                branch.status === 'active' ? 'bg-green-100 text-green-800' :
                branch.status === 'merged' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {branch.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Collaborative View Component
interface CollaborativeViewProps {
  session: CollaborativeSession | null;
  onJoinSession: (sessionId: string) => void;
}

const CollaborativeView: React.FC<CollaborativeViewProps> = ({ session, onJoinSession }) => {
  if (!session) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No active collaborative session.</p>
        <p className="text-sm mt-2">Start a collaboration session to enable real-time editing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Active Session: {session.id}</h4>
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-gray-700">Participants ({session.participants.length})</h5>
            <div className="mt-2 space-y-2">
              {session.participants.map((participant) => (
                <div key={participant.userId} className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    participant.isActive ? 'bg-green-400' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-sm">{participant.name}</span>
                  <span className="text-xs text-gray-500">({participant.role})</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h5 className="text-sm font-medium text-gray-700">Recent Changes ({session.changes.length})</h5>
            <div className="mt-2 text-sm text-gray-600">
              {session.changes.length === 0 ? (
                <p>No changes yet</p>
              ) : (
                <p>{session.changes.length} real-time changes made</p>
              )}
            </div>
          </div>

          <div>
            <h5 className="text-sm font-medium text-gray-700">Comments ({session.comments.length})</h5>
            <div className="mt-2 text-sm text-gray-600">
              {session.comments.length === 0 ? (
                <p>No comments yet</p>
              ) : (
                <p>{session.comments.length} comments posted</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryView;
