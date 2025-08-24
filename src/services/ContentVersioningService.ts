/**
 * Content Versioning Service
 * Comprehensive service for content version management, collaborative editing,
 * change tracking, merging, and content evolution
 */

import { 
  ContentVersion, 
  VersionHistory, 
  VersionDiff, 
  VersionBranch, 
  MergeRequest, 
  VersioningPreferences,
  CollaborativeSession,
  VersioningConfiguration,
  ChangeType,
  VersionStatus,
  ReviewStatus,
  VersionAuthor,
  VersionChange,
  MergeConflict,
  SectionDiff
} from '../types/VersioningTypes';

class ContentVersioningService {
  private versions: Map<string, VersionHistory> = new Map();
  private collaborativeSessions: Map<string, CollaborativeSession> = new Map();
  private preferences: Map<string, VersioningPreferences> = new Map();
  private configuration: VersioningConfiguration;

  constructor() {
    this.configuration = this.getDefaultConfiguration();
    this.initializeVersioning();
  }

  /**
   * Initialize the versioning system with default data
   */
  private initializeVersioning(): void {
    // Initialize with sample version history for demonstration
    const sampleHistory: VersionHistory = {
      contentPath: '/content/architecture/overview.md',
      versions: [
        {
          id: 'v1',
          contentPath: '/content/architecture/overview.md',
          version: 1,
          title: 'Chromium Architecture Overview',
          content: 'Initial content about Chromium architecture...',
          metadata: {
            wordCount: 1200,
            readingTime: 6,
            lastModified: new Date('2025-01-15'),
            language: 'en',
            difficulty: 'intermediate',
            categories: ['architecture', 'browser'],
            prerequisites: ['basic-web-concepts'],
            relatedContent: ['/content/architecture/process-model.md'],
            contentType: 'article'
          },
          changes: [],
          author: {
            id: 'author1',
            name: 'John Developer',
            email: 'john@wanderlust.dev',
            role: 'maintainer',
            expertise: ['architecture', 'browser-internals']
          },
          timestamp: new Date('2025-01-15'),
          status: 'published',
          tags: ['architecture', 'chromium', 'browser'],
          hash: 'sha256-abc123'
        }
      ],
      branches: [],
      totalVersions: 1,
      latestVersion: {} as ContentVersion,
      statistics: {
        totalChanges: 0,
        contributors: 1,
        averageReviewTime: 0,
        approvalRate: 100,
        conflictRate: 0,
        mostActiveContributor: {} as VersionAuthor,
        changeFrequency: { daily: 0, weekly: 0, monthly: 1 },
        contentGrowth: { wordCountChange: 0, sectionChanges: 0, qualityImprovements: 0 }
      }
    };

    this.versions.set('/content/architecture/overview.md', sampleHistory);
  }

  /**
   * Create a new version of content
   */
  createVersion(
    contentPath: string, 
    content: string, 
    author: VersionAuthor, 
    changes: VersionChange[],
    parentVersionId?: string
  ): ContentVersion {
    const history = this.versions.get(contentPath) || this.createNewHistory(contentPath);
    const newVersion: ContentVersion = {
      id: `v${history.totalVersions + 1}`,
      contentPath,
      version: history.totalVersions + 1,
      title: this.extractTitle(content),
      content,
      metadata: this.generateMetadata(content),
      changes,
      author,
      timestamp: new Date(),
      status: 'draft',
      parentVersionId,
      tags: this.extractTags(content),
      hash: this.generateHash(content)
    };

    history.versions.push(newVersion);
    history.totalVersions++;
    history.latestVersion = newVersion;
    this.updateStatistics(history, newVersion);

    this.versions.set(contentPath, history);
    return newVersion;
  }

  /**
   * Get version history for content
   */
  getVersionHistory(contentPath: string): VersionHistory | null {
    return this.versions.get(contentPath) || null;
  }

  /**
   * Get specific version by ID
   */
  getVersion(contentPath: string, versionId: string): ContentVersion | null {
    const history = this.versions.get(contentPath);
    if (!history) return null;
    return history.versions.find(v => v.id === versionId) || null;
  }

  /**
   * Get latest version of content
   */
  getLatestVersion(contentPath: string): ContentVersion | null {
    const history = this.versions.get(contentPath);
    return history?.latestVersion || null;
  }

  /**
   * Get published version of content
   */
  getPublishedVersion(contentPath: string): ContentVersion | null {
    const history = this.versions.get(contentPath);
    return history?.publishedVersion || null;
  }

  /**
   * Compare two versions and generate diff
   */
  generateDiff(contentPath: string, fromVersionId: string, toVersionId: string): VersionDiff | null {
    const fromVersion = this.getVersion(contentPath, fromVersionId);
    const toVersion = this.getVersion(contentPath, toVersionId);
    
    if (!fromVersion || !toVersion) return null;

    const sections = this.calculateSectionDiffs(fromVersion.content, toVersion.content);
    const summary = this.calculateDiffSummary(sections);

    return {
      contentPath,
      fromVersion: fromVersion.version,
      toVersion: toVersion.version,
      summary,
      sections,
      metadata: this.calculateMetadataDiff(fromVersion.metadata, toVersion.metadata)
    };
  }

  /**
   * Create a new branch for collaborative editing
   */
  createBranch(
    contentPath: string, 
    branchName: string, 
    description: string, 
    baseVersionId: string, 
    author: VersionAuthor
  ): VersionBranch {
    const history = this.versions.get(contentPath);
    if (!history) throw new Error('Content not found');

    const baseVersion = this.getVersion(contentPath, baseVersionId);
    if (!baseVersion) throw new Error('Base version not found');

    const branch: VersionBranch = {
      id: `branch-${Date.now()}`,
      name: branchName,
      description,
      baseVersionId,
      headVersionId: baseVersionId,
      author,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      versions: [baseVersion],
      mergeRequests: []
    };

    history.branches.push(branch);
    this.versions.set(contentPath, history);

    return branch;
  }

  /**
   * Create a merge request
   */
  createMergeRequest(
    contentPath: string,
    title: string,
    description: string,
    sourceBranchId: string,
    targetBranchId: string,
    author: VersionAuthor
  ): MergeRequest {
    const history = this.versions.get(contentPath);
    if (!history) throw new Error('Content not found');

    const sourceBranch = history.branches.find(b => b.id === sourceBranchId);
    const targetBranch = history.branches.find(b => b.id === targetBranchId);

    if (!sourceBranch || !targetBranch) {
      throw new Error('Source or target branch not found');
    }

    const changes = this.calculateBranchChanges(sourceBranch, targetBranch);

    const mergeRequest: MergeRequest = {
      id: `mr-${Date.now()}`,
      title,
      description,
      sourceBranchId,
      targetBranchId,
      author,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      changes,
      discussions: []
    };

    sourceBranch.mergeRequests.push(mergeRequest);
    this.versions.set(contentPath, history);

    return mergeRequest;
  }

  /**
   * Merge branches with conflict detection
   */
  mergeBranches(
    contentPath: string, 
    sourceBranchId: string, 
    targetBranchId: string,
    strategy: 'auto' | 'manual' = 'auto'
  ): { success: boolean; conflicts?: MergeConflict[]; mergedVersion?: ContentVersion } {
    const history = this.versions.get(contentPath);
    if (!history) return { success: false };

    const sourceBranch = history.branches.find(b => b.id === sourceBranchId);
    const targetBranch = history.branches.find(b => b.id === targetBranchId);

    if (!sourceBranch || !targetBranch) {
      return { success: false };
    }

    const conflicts = this.detectMergeConflicts(sourceBranch, targetBranch);

    if (conflicts.length > 0 && strategy === 'auto') {
      return { success: false, conflicts };
    }

    // Perform merge
    const mergedContent = this.performMerge(sourceBranch, targetBranch, conflicts);
    const mergedVersion = this.createVersion(
      contentPath,
      mergedContent,
      sourceBranch.author,
      [],
      targetBranch.headVersionId
    );

    // Update branch status
    sourceBranch.status = 'merged';
    targetBranch.headVersionId = mergedVersion.id;
    targetBranch.versions.push(mergedVersion);

    this.versions.set(contentPath, history);

    return { success: true, mergedVersion };
  }

  /**
   * Start a collaborative editing session
   */
  startCollaborativeSession(contentPath: string, initiator: VersionAuthor): CollaborativeSession {
    const session: CollaborativeSession = {
      id: `session-${Date.now()}`,
      contentPath,
      participants: [{
        userId: initiator.id,
        name: initiator.name,
        role: 'editor',
        joinedAt: new Date(),
        isActive: true,
        permissions: {
          canEdit: true,
          canReview: true,
          canComment: true,
          canApprove: initiator.role === 'maintainer'
        }
      }],
      startedAt: new Date(),
      status: 'active',
      changes: [],
      cursor: [],
      comments: []
    };

    this.collaborativeSessions.set(session.id, session);
    return session;
  }

  /**
   * Join a collaborative session
   */
  joinCollaborativeSession(sessionId: string, participant: VersionAuthor): boolean {
    const session = this.collaborativeSessions.get(sessionId);
    if (!session || session.status !== 'active') return false;

    const existingParticipant = session.participants.find(p => p.userId === participant.id);
    if (existingParticipant) {
      existingParticipant.isActive = true;
      existingParticipant.leftAt = undefined;
      return true;
    }

    session.participants.push({
      userId: participant.id,
      name: participant.name,
      role: 'editor',
      joinedAt: new Date(),
      isActive: true,
      permissions: {
        canEdit: true,
        canReview: participant.role !== 'observer',
        canComment: true,
        canApprove: participant.role === 'maintainer'
      }
    });

    return true;
  }

  /**
   * Publish a version (move from draft to published)
   */
  publishVersion(contentPath: string, versionId: string, reviewer?: VersionAuthor): boolean {
    const version = this.getVersion(contentPath, versionId);
    if (!version) return false;

    if (this.configuration.requireReviewForPublish && !reviewer) {
      return false;
    }

    version.status = 'published';
    if (reviewer) {
      version.reviewInfo = {
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        reviewedAt: new Date(),
        status: 'approved',
        comments: [],
        suggestions: [],
        approval: { approved: true }
      };
    }

    const history = this.versions.get(contentPath);
    if (history) {
      history.publishedVersion = version;
      this.versions.set(contentPath, history);
    }

    return true;
  }

  /**
   * Rollback to a previous version
   */
  rollbackToVersion(contentPath: string, targetVersionId: string, author: VersionAuthor): ContentVersion | null {
    const targetVersion = this.getVersion(contentPath, targetVersionId);
    if (!targetVersion) return null;

    const rollbackVersion = this.createVersion(
      contentPath,
      targetVersion.content,
      author,
      [{
        id: `rollback-${Date.now()}`,
        type: 'modification',
        section: 'full-content',
        description: `Rollback to version ${targetVersion.version}`,
        newContent: targetVersion.content,
        lineNumbers: { start: 1, end: -1 },
        impact: 'major',
        reviewStatus: 'pending'
      }],
      this.getLatestVersion(contentPath)?.id
    );

    return rollbackVersion;
  }

  /**
   * Get content versioning analytics
   */
  getVersioningAnalytics(contentPath?: string): any {
    if (contentPath) {
      const history = this.versions.get(contentPath);
      return history?.statistics || null;
    }

    // Platform-wide analytics
    const allHistories = Array.from(this.versions.values());
    return {
      totalContent: allHistories.length,
      totalVersions: allHistories.reduce((sum, h) => sum + h.totalVersions, 0),
      totalContributors: new Set(allHistories.flatMap(h => h.versions.map(v => v.author.id))).size,
      averageVersionsPerContent: allHistories.reduce((sum, h) => sum + h.totalVersions, 0) / allHistories.length,
      mostActiveContent: allHistories.sort((a, b) => b.totalVersions - a.totalVersions)[0]?.contentPath,
      recentActivity: this.getRecentVersioningActivity()
    };
  }

  // Private helper methods

  private createNewHistory(contentPath: string): VersionHistory {
    return {
      contentPath,
      versions: [],
      branches: [],
      totalVersions: 0,
      latestVersion: {} as ContentVersion,
      statistics: {
        totalChanges: 0,
        contributors: 0,
        averageReviewTime: 0,
        approvalRate: 100,
        conflictRate: 0,
        mostActiveContributor: {} as VersionAuthor,
        changeFrequency: { daily: 0, weekly: 0, monthly: 0 },
        contentGrowth: { wordCountChange: 0, sectionChanges: 0, qualityImprovements: 0 }
      }
    };
  }

  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1] : 'Untitled';
  }

  private generateMetadata(content: string): any {
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // Assume 200 words per minute

    return {
      wordCount,
      readingTime,
      lastModified: new Date(),
      language: 'en',
      difficulty: 'intermediate',
      categories: this.extractCategories(content),
      prerequisites: [],
      relatedContent: [],
      contentType: 'article'
    };
  }

  private extractCategories(content: string): string[] {
    // Simple category extraction based on common keywords
    const categories: string[] = [];
    if (content.includes('architecture')) categories.push('architecture');
    if (content.includes('security')) categories.push('security');
    if (content.includes('performance')) categories.push('performance');
    if (content.includes('debugging')) categories.push('debugging');
    return categories;
  }

  private extractTags(content: string): string[] {
    // Extract potential tags from content
    const tags: string[] = [];
    const commonTags = ['chromium', 'browser', 'web', 'javascript', 'performance', 'security'];
    for (const tag of commonTags) {
      if (content.toLowerCase().includes(tag)) {
        tags.push(tag);
      }
    }
    return tags;
  }

  private generateHash(content: string): string {
    // Simple hash generation (in real implementation, use proper crypto)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `sha256-${Math.abs(hash).toString(16)}`;
  }

  private updateStatistics(history: VersionHistory, newVersion: ContentVersion): void {
    history.statistics.totalChanges += newVersion.changes.length;
    const contributorIds = new Set(history.versions.map(v => v.author.id));
    history.statistics.contributors = contributorIds.size;

    // Update frequency counters
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    history.statistics.changeFrequency.daily = history.versions.filter(v => v.timestamp > dayAgo).length;
    history.statistics.changeFrequency.weekly = history.versions.filter(v => v.timestamp > weekAgo).length;
    history.statistics.changeFrequency.monthly = history.versions.filter(v => v.timestamp > monthAgo).length;
  }

  private calculateSectionDiffs(oldContent: string, newContent: string): SectionDiff[] {
    // Simplified diff calculation
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffs: SectionDiff[] = [];

    // Basic line-by-line comparison
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine !== newLine) {
        diffs.push({
          section: `line-${i + 1}`,
          type: !oldLine ? 'addition' : !newLine ? 'deletion' : 'modification',
          oldContent: oldLine,
          newContent: newLine,
          lineNumbers: {
            old: { start: i + 1, end: i + 1 },
            new: { start: i + 1, end: i + 1 }
          },
          confidence: 0.9
        });
      }
    }

    return diffs;
  }

  private calculateDiffSummary(sections: SectionDiff[]): any {
    const additions = sections.filter(s => s.type === 'addition').length;
    const deletions = sections.filter(s => s.type === 'deletion').length;
    const modifications = sections.filter(s => s.type === 'modification').length;

    return {
      additions,
      deletions,
      modifications,
      wordCountChange: 0, // Simplified
      readingTimeChange: 0, // Simplified
      impact: modifications > 10 || additions > 10 ? 'major' : 'minor'
    };
  }

  private calculateMetadataDiff(oldMetadata: any, newMetadata: any): any {
    return {
      title: oldMetadata.title !== newMetadata.title ? 
        { old: oldMetadata.title, new: newMetadata.title } : undefined,
      categories: {
        added: newMetadata.categories?.filter((c: string) => !oldMetadata.categories?.includes(c)) || [],
        removed: oldMetadata.categories?.filter((c: string) => !newMetadata.categories?.includes(c)) || [],
        modified: []
      }
    };
  }

  private calculateBranchChanges(sourceBranch: VersionBranch, targetBranch: VersionBranch): VersionChange[] {
    // Simplified branch change calculation
    return [{
      id: 'branch-change-1',
      type: 'modification',
      section: 'content',
      description: 'Branch modifications',
      lineNumbers: { start: 1, end: -1 },
      impact: 'moderate',
      reviewStatus: 'pending'
    }];
  }

  private detectMergeConflicts(sourceBranch: VersionBranch, targetBranch: VersionBranch): MergeConflict[] {
    // Simplified conflict detection
    return [];
  }

  private performMerge(sourceBranch: VersionBranch, targetBranch: VersionBranch, conflicts: MergeConflict[]): string {
    // Simplified merge logic - in real implementation, use proper merge algorithms
    const sourceVersion = sourceBranch.versions[sourceBranch.versions.length - 1];
    return sourceVersion.content;
  }

  private getRecentVersioningActivity(): any {
    const allVersions = Array.from(this.versions.values())
      .flatMap(h => h.versions)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return allVersions.map(v => ({
      contentPath: v.contentPath,
      version: v.version,
      author: v.author.name,
      timestamp: v.timestamp,
      changes: v.changes.length
    }));
  }

  private getDefaultConfiguration(): VersioningConfiguration {
    return {
      maxVersionsPerContent: 100,
      autoArchiveAfterDays: 365,
      requireReviewForPublish: true,
      allowAnonymousContributions: false,
      enableRealTimeCollaboration: true,
      enableAutoMerge: false,
      conflictResolutionStrategy: 'manual',
      notificationSettings: {
        email: true,
        inApp: true,
        reviewRequests: true,
        mergeRequests: true,
        conflicts: true,
        mentions: true
      },
      backupSettings: {
        enabled: true,
        frequency: 'daily',
        retentionPeriod: 90,
        includeHistory: true,
        compressionEnabled: true
      }
    };
  }
}

export const versioningService = new ContentVersioningService();
