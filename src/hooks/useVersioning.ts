/**
 * Version Management Hook
 * React hook for content versioning, collaborative editing,
 * change tracking, and version control operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ContentVersion, 
  VersionHistory, 
  VersionDiff,
  VersionAuthor,
  VersionChange,
  CollaborativeSession,
  VersioningPreferences,
  RealTimeChange
} from '../types/VersioningTypes';
import { versioningService } from '../services/ContentVersioningService';

interface UseVersioningOptions {
  contentPath: string;
  autoSave?: boolean;
  autoSaveInterval?: number; // milliseconds
  enableRealTimeSync?: boolean;
  onVersionChange?: (version: ContentVersion) => void;
  onContentChange?: (content: string) => void;
  onCollaboratorJoin?: (collaborator: VersionAuthor) => void;
}

interface UseVersioningReturn {
  // Version data
  versionHistory: VersionHistory | null;
  currentVersion: ContentVersion | null;
  publishedVersion: ContentVersion | null;
  isLoading: boolean;
  error: string | null;

  // Version operations
  createVersion: (content: string, changes: VersionChange[]) => Promise<ContentVersion | null>;
  publishVersion: (versionId: string) => Promise<boolean>;
  rollbackToVersion: (versionId: string) => Promise<ContentVersion | null>;
  generateDiff: (fromVersionId: string, toVersionId: string) => Promise<VersionDiff | null>;

  // Content editing
  content: string;
  setContent: (content: string) => void;
  hasUnsavedChanges: boolean;
  saveContent: () => Promise<boolean>;
  discardChanges: () => void;

  // Collaborative editing
  collaborativeSession: CollaborativeSession | null;
  startCollaboration: () => Promise<CollaborativeSession | null>;
  joinCollaboration: (sessionId: string) => Promise<boolean>;
  endCollaboration: () => Promise<boolean>;
  collaborators: VersionAuthor[];
  realTimeChanges: RealTimeChange[];

  // Branch management
  createBranch: (name: string, description: string, baseVersionId: string) => Promise<boolean>;
  switchBranch: (branchId: string) => Promise<boolean>;
  mergeBranch: (sourceBranchId: string, targetBranchId: string) => Promise<boolean>;

  // Preferences
  preferences: VersioningPreferences | null;
  updatePreferences: (preferences: Partial<VersioningPreferences>) => Promise<boolean>;

  // Analytics
  getVersioningAnalytics: () => any;
  trackVersioningEvent: (eventType: string, data: any) => void;
}

export const useVersioning = (options: UseVersioningOptions): UseVersioningReturn => {
  const {
    contentPath,
    autoSave = true,
    autoSaveInterval = 30000, // 30 seconds
    enableRealTimeSync = true,
    onVersionChange,
    onContentChange,
    onCollaboratorJoin
  } = options;

  // State
  const [versionHistory, setVersionHistory] = useState<VersionHistory | null>(null);
  const [currentVersion, setCurrentVersion] = useState<ContentVersion | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<ContentVersion | null>(null);
  const [content, setContentState] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collaborativeSession, setCollaborativeSession] = useState<CollaborativeSession | null>(null);
  const [collaborators, setCollaborators] = useState<VersionAuthor[]>([]);
  const [realTimeChanges, setRealTimeChanges] = useState<RealTimeChange[]>([]);
  const [preferences, setPreferences] = useState<VersioningPreferences | null>(null);

  // Refs
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<number | null>(null);

  // Current user (mock data)
  const currentUser: VersionAuthor = {
    id: 'user-1',
    name: 'Current User',
    email: 'user@wanderlust.dev',
    role: 'editor',
    expertise: ['documentation', 'architecture']
  };

  // Computed values
  const hasUnsavedChanges = content !== originalContent;

  // Load version history
  const loadVersionHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const history = versioningService.getVersionHistory(contentPath);
      setVersionHistory(history);
      
      if (history) {
        setCurrentVersion(history.latestVersion);
        setPublishedVersion(history.publishedVersion || null);
        
        // Load content from latest version
        if (history.latestVersion && history.latestVersion.content) {
          setContentState(history.latestVersion.content);
          setOriginalContent(history.latestVersion.content);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  }, [contentPath]);

  // Initialize
  useEffect(() => {
    loadVersionHistory();
  }, [loadVersionHistory]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveContent();
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, hasUnsavedChanges, autoSave, autoSaveInterval]);

  // Real-time sync
  useEffect(() => {
    if (!enableRealTimeSync || !collaborativeSession) return;

    syncIntervalRef.current = setInterval(() => {
      // Simulate real-time sync
      // In real implementation, this would connect to WebSocket or similar
      syncRealTimeChanges();
    }, 1000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [enableRealTimeSync, collaborativeSession]);

  // Version operations
  const createVersion = useCallback(async (
    newContent: string, 
    changes: VersionChange[]
  ): Promise<ContentVersion | null> => {
    try {
      const version = versioningService.createVersion(
        contentPath,
        newContent,
        currentUser,
        changes,
        currentVersion?.id
      );

      await loadVersionHistory();
      
      if (onVersionChange) {
        onVersionChange(version);
      }

      return version;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version');
      return null;
    }
  }, [contentPath, currentUser, currentVersion, loadVersionHistory, onVersionChange]);

  const publishVersion = useCallback(async (versionId: string): Promise<boolean> => {
    try {
      const success = versioningService.publishVersion(contentPath, versionId, currentUser);
      
      if (success) {
        await loadVersionHistory();
      }
      
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish version');
      return false;
    }
  }, [contentPath, currentUser, loadVersionHistory]);

  const rollbackToVersion = useCallback(async (versionId: string): Promise<ContentVersion | null> => {
    try {
      const rollbackVersion = versioningService.rollbackToVersion(contentPath, versionId, currentUser);
      
      if (rollbackVersion) {
        setContentState(rollbackVersion.content);
        setOriginalContent(rollbackVersion.content);
        await loadVersionHistory();
        
        if (onContentChange) {
          onContentChange(rollbackVersion.content);
        }
      }
      
      return rollbackVersion;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback version');
      return null;
    }
  }, [contentPath, currentUser, loadVersionHistory, onContentChange]);

  const generateDiff = useCallback(async (
    fromVersionId: string, 
    toVersionId: string
  ): Promise<VersionDiff | null> => {
    try {
      return versioningService.generateDiff(contentPath, fromVersionId, toVersionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate diff');
      return null;
    }
  }, [contentPath]);

  // Content editing
  const setContent = useCallback((newContent: string) => {
    setContentState(newContent);
    
    if (onContentChange) {
      onContentChange(newContent);
    }
  }, [onContentChange]);

  const saveContent = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges) return true;

    try {
      const changes: VersionChange[] = [{
        id: `change-${Date.now()}`,
        type: 'modification',
        section: 'content',
        description: 'Content updated',
        oldContent: originalContent,
        newContent: content,
        lineNumbers: { start: 1, end: -1 },
        impact: 'moderate',
        reviewStatus: 'pending'
      }];

      const version = await createVersion(content, changes);
      
      if (version) {
        setOriginalContent(content);
        return true;
      }
      
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content');
      return false;
    }
  }, [content, originalContent, hasUnsavedChanges, createVersion]);

  const discardChanges = useCallback(() => {
    setContentState(originalContent);
  }, [originalContent]);

  // Collaborative editing
  const startCollaboration = useCallback(async (): Promise<CollaborativeSession | null> => {
    try {
      const session = versioningService.startCollaborativeSession(contentPath, currentUser);
      setCollaborativeSession(session);
      setCollaborators([currentUser]);
      
      return session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start collaboration');
      return null;
    }
  }, [contentPath, currentUser]);

  const joinCollaboration = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const success = versioningService.joinCollaborativeSession(sessionId, currentUser);
      
      if (success && onCollaboratorJoin) {
        onCollaboratorJoin(currentUser);
      }
      
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join collaboration');
      return false;
    }
  }, [currentUser, onCollaboratorJoin]);

  const endCollaboration = useCallback(async (): Promise<boolean> => {
    try {
      // End collaborative session
      setCollaborativeSession(null);
      setCollaborators([]);
      setRealTimeChanges([]);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end collaboration');
      return false;
    }
  }, []);

  // Branch management
  const createBranch = useCallback(async (
    name: string, 
    description: string, 
    baseVersionId: string
  ): Promise<boolean> => {
    try {
      versioningService.createBranch(contentPath, name, description, baseVersionId, currentUser);
      await loadVersionHistory();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
      return false;
    }
  }, [contentPath, currentUser, loadVersionHistory]);

  const switchBranch = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      // Switch to branch logic
      await loadVersionHistory();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch branch');
      return false;
    }
  }, [loadVersionHistory]);

  const mergeBranch = useCallback(async (
    sourceBranchId: string, 
    targetBranchId: string
  ): Promise<boolean> => {
    try {
      const result = versioningService.mergeBranches(contentPath, sourceBranchId, targetBranchId);
      
      if (result.success) {
        await loadVersionHistory();
        return true;
      } else {
        setError('Merge conflicts detected. Manual resolution required.');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge branch');
      return false;
    }
  }, [contentPath, loadVersionHistory]);

  // Preferences
  const updatePreferences = useCallback(async (
    newPreferences: Partial<VersioningPreferences>
  ): Promise<boolean> => {
    try {
      // Update preferences
      const updatedPreferences = { ...preferences, ...newPreferences } as VersioningPreferences;
      setPreferences(updatedPreferences);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      return false;
    }
  }, [preferences]);

  // Analytics
  const getVersioningAnalytics = useCallback(() => {
    return versioningService.getVersioningAnalytics(contentPath);
  }, [contentPath]);

  const trackVersioningEvent = useCallback((eventType: string, data: any) => {
    // Track versioning events for analytics
    console.log('Versioning event:', eventType, data);
  }, []);

  // Real-time sync helper
  const syncRealTimeChanges = useCallback(() => {
    // Simulate real-time changes sync
    // In real implementation, this would sync with server
    if (collaborativeSession) {
      setRealTimeChanges(collaborativeSession.changes);
      setCollaborators(collaborativeSession.participants.map(p => ({
        id: p.userId,
        name: p.name,
        email: '',
        role: p.role as any,
        expertise: []
      })));
    }
  }, [collaborativeSession]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return {
    // Version data
    versionHistory,
    currentVersion,
    publishedVersion,
    isLoading,
    error,

    // Version operations
    createVersion,
    publishVersion,
    rollbackToVersion,
    generateDiff,

    // Content editing
    content,
    setContent,
    hasUnsavedChanges,
    saveContent,
    discardChanges,

    // Collaborative editing
    collaborativeSession,
    startCollaboration,
    joinCollaboration,
    endCollaboration,
    collaborators,
    realTimeChanges,

    // Branch management
    createBranch,
    switchBranch,
    mergeBranch,

    // Preferences
    preferences,
    updatePreferences,

    // Analytics
    getVersioningAnalytics,
    trackVersioningEvent
  };
};
