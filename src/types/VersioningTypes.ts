/**
 * Content Versioning System Types
 * Comprehensive type definitions for content version management,
 * collaborative editing, and change tracking
 */

export interface ContentVersion {
  id: string;
  contentPath: string;
  version: number;
  title: string;
  content: string;
  metadata: ContentMetadata;
  changes: VersionChange[];
  author: VersionAuthor;
  timestamp: Date;
  status: VersionStatus;
  parentVersionId?: string;
  mergeInfo?: MergeInfo;
  reviewInfo?: ReviewInfo;
  tags: string[];
  hash: string;
}

export interface ContentMetadata {
  wordCount: number;
  readingTime: number;
  lastModified: Date;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  categories: string[];
  prerequisites: string[];
  relatedContent: string[];
  contentType: 'article' | 'tutorial' | 'reference' | 'guide';
}

export interface VersionChange {
  id: string;
  type: ChangeType;
  section: string;
  description: string;
  oldContent?: string;
  newContent?: string;
  lineNumbers: {
    start: number;
    end: number;
  };
  impact: ChangeImpact;
  reviewStatus: ReviewStatus;
}

export type ChangeType = 
  | 'addition'
  | 'deletion'
  | 'modification'
  | 'restructure'
  | 'format'
  | 'correction'
  | 'enhancement'
  | 'translation';

export type ChangeImpact = 'minor' | 'moderate' | 'major' | 'breaking';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';

export interface VersionAuthor {
  id: string;
  name: string;
  email: string;
  role: 'contributor' | 'editor' | 'reviewer' | 'maintainer' | 'observer';
  avatar?: string;
  expertise: string[];
}

export type VersionStatus = 
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'deprecated';

export interface MergeInfo {
  sourceVersionId: string;
  targetVersionId: string;
  mergedBy: string;
  mergedAt: Date;
  conflicts: MergeConflict[];
  strategy: MergeStrategy;
}

export interface MergeConflict {
  section: string;
  description: string;
  sourceContent: string;
  targetContent: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export type MergeStrategy = 'auto' | 'manual' | 'smart_merge' | 'conflict_resolution';

export interface ReviewInfo {
  reviewerId: string;
  reviewerName: string;
  reviewedAt: Date;
  status: ReviewStatus;
  comments: ReviewComment[];
  suggestions: ReviewSuggestion[];
  approval: ReviewApproval;
}

export interface ReviewComment {
  id: string;
  section: string;
  lineNumber?: number;
  comment: string;
  type: 'suggestion' | 'issue' | 'praise' | 'question';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  timestamp: Date;
}

export interface ReviewSuggestion {
  id: string;
  section: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  accepted: boolean;
  timestamp: Date;
}

export interface ReviewApproval {
  approved: boolean;
  conditions?: string[];
  nextReviewDate?: Date;
  requiredChanges?: string[];
}

export interface VersionBranch {
  id: string;
  name: string;
  description: string;
  baseVersionId: string;
  headVersionId: string;
  author: VersionAuthor;
  createdAt: Date;
  updatedAt: Date;
  status: BranchStatus;
  versions: ContentVersion[];
  mergeRequests: MergeRequest[];
}

export type BranchStatus = 'active' | 'merged' | 'abandoned' | 'stale';

export interface MergeRequest {
  id: string;
  title: string;
  description: string;
  sourceBranchId: string;
  targetBranchId: string;
  author: VersionAuthor;
  reviewer?: VersionAuthor;
  createdAt: Date;
  updatedAt: Date;
  status: MergeRequestStatus;
  changes: VersionChange[];
  discussions: MergeDiscussion[];
  approval?: MergeApproval;
}

export type MergeRequestStatus = 
  | 'open'
  | 'under_review'
  | 'approved'
  | 'merged'
  | 'rejected'
  | 'closed';

export interface MergeDiscussion {
  id: string;
  author: VersionAuthor;
  message: string;
  timestamp: Date;
  replies: MergeDiscussion[];
  resolved: boolean;
}

export interface MergeApproval {
  approvedBy: VersionAuthor;
  approvedAt: Date;
  conditions?: string[];
  autoMerge: boolean;
}

export interface VersionHistory {
  contentPath: string;
  versions: ContentVersion[];
  branches: VersionBranch[];
  totalVersions: number;
  latestVersion: ContentVersion;
  publishedVersion?: ContentVersion;
  statistics: VersionStatistics;
}

export interface VersionStatistics {
  totalChanges: number;
  contributors: number;
  averageReviewTime: number;
  approvalRate: number;
  conflictRate: number;
  mostActiveContributor: VersionAuthor;
  changeFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  contentGrowth: {
    wordCountChange: number;
    sectionChanges: number;
    qualityImprovements: number;
  };
}

export interface VersionDiff {
  contentPath: string;
  fromVersion: number;
  toVersion: number;
  summary: DiffSummary;
  sections: SectionDiff[];
  metadata: MetadataDiff;
  conflicts?: DiffConflict[];
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  modifications: number;
  wordCountChange: number;
  readingTimeChange: number;
  impact: ChangeImpact;
}

export interface SectionDiff {
  section: string;
  type: ChangeType;
  oldContent?: string;
  newContent?: string;
  lineNumbers: {
    old: { start: number; end: number };
    new: { start: number; end: number };
  };
  confidence: number;
}

export interface MetadataDiff {
  title?: { old: string; new: string };
  categories?: { added: string[]; removed: string[]; modified: string[] };
  difficulty?: { old: string; new: string };
  prerequisites?: { added: string[]; removed: string[] };
  tags?: { added: string[]; removed: string[] };
}

export interface DiffConflict {
  section: string;
  type: 'content' | 'metadata' | 'structure';
  description: string;
  suggestions: string[];
}

export interface VersioningPreferences {
  userId: string;
  autoSave: boolean;
  autoSaveInterval: number; // minutes
  reviewNotifications: boolean;
  mergeNotifications: boolean;
  defaultBranch: string;
  preferredReviewers: string[];
  diffViewMode: 'side-by-side' | 'unified' | 'inline';
  showLineNumbers: boolean;
  highlightChanges: boolean;
}

export interface CollaborativeSession {
  id: string;
  contentPath: string;
  participants: SessionParticipant[];
  startedAt: Date;
  endedAt?: Date;
  status: SessionStatus;
  changes: RealTimeChange[];
  cursor: CursorPosition[];
  comments: SessionComment[];
}

export interface SessionParticipant {
  userId: string;
  name: string;
  role: 'editor' | 'reviewer' | 'observer';
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
  permissions: SessionPermissions;
}

export interface SessionPermissions {
  canEdit: boolean;
  canReview: boolean;
  canComment: boolean;
  canApprove: boolean;
}

export type SessionStatus = 'active' | 'paused' | 'ended' | 'abandoned';

export interface RealTimeChange {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'format';
  position: number;
  content: string;
  timestamp: Date;
  applied: boolean;
}

export interface CursorPosition {
  userId: string;
  position: number;
  selection?: {
    start: number;
    end: number;
  };
  timestamp: Date;
}

export interface SessionComment {
  id: string;
  userId: string;
  position: number;
  content: string;
  timestamp: Date;
  resolved: boolean;
  replies: SessionComment[];
}

export interface VersioningConfiguration {
  maxVersionsPerContent: number;
  autoArchiveAfterDays: number;
  requireReviewForPublish: boolean;
  allowAnonymousContributions: boolean;
  enableRealTimeCollaboration: boolean;
  enableAutoMerge: boolean;
  conflictResolutionStrategy: MergeStrategy;
  notificationSettings: NotificationSettings;
  backupSettings: BackupSettings;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  reviewRequests: boolean;
  mergeRequests: boolean;
  conflicts: boolean;
  mentions: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  retentionPeriod: number; // days
  includeHistory: boolean;
  compressionEnabled: boolean;
}
