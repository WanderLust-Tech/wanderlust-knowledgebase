/**
 * Shared Type Definitions
 * Types that match exactly with backend models to ensure API consistency
 */

// User-related types that match backend C# models
export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string;
  reputation: number;
  badges: UserBadge[];
  preferences: UserPreferences;
}

export type UserRole = 'Member' | 'Contributor' | 'Moderator' | 'Admin';

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedDate: string;
  category: BadgeCategory;
  userId: number;
}

export type BadgeCategory = 'Contribution' | 'Learning' | 'Community' | 'Achievement';

export interface UserPreferences {
  id: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  themePreference: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  discussionSort: 'newest' | 'oldest' | 'popular' | 'relevance';
  autoSubscribe: boolean;
  userId: number;
}

// Article types that match backend
export interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  path: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  description?: string;
  readingTimeMinutes: number;
  isPublished: boolean;
  author?: string;
  authorId: number;
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  metaDescription?: string;
  metaKeywords?: string;
  featuredImage?: string;
  version: string;
  versionNumber: number;
}

// Enhanced CommunityPost/Discussion types
export interface CommunityPost {
  id: number;
  title: string;
  content: string;
  authorName: string;
  authorAvatar: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  authorId: number;
  category: string;
  tags: string[];
  isPinned: boolean;
  isClosed: boolean;
  isLocked: boolean;
  viewCount: number;
  replyCount: number;
  likeCount: number;
  shareCount: number;
  lastActivity: string;
  lastReplyById?: number;
  lastReplyByName?: string;
  relatedArticles: string[];
  attachments: string[];
  subscribers: string[];
  isApproved: boolean;
  isFlagged: boolean;
  moderationReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
}

export interface DiscussionCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  parentId?: string;
  moderators: string[];
  isPrivate: boolean;
  requireApproval: boolean;
}

// Comment types that match backend
export interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
  postId: number;
  parentCommentId?: string;
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  isHidden: boolean;
  isDeleted: boolean;
  moderationReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  mentions?: string[];
  attachments?: string[];
}

// Reaction types that match backend
export interface Reaction {
  id: string;
  type: string;
  author: string;
  authorId: string;
  createdAt: string;
  postId?: number;
  commentId?: string;
  content?: string;
  isActive: boolean;
}

// CodeExample enums that match backend exactly
export type ProgrammingLanguage = 
  | 'Javascript' 
  | 'Typescript' 
  | 'Cpp' 
  | 'Python' 
  | 'Html' 
  | 'Css' 
  | 'Json' 
  | 'Gn';

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type CodeExampleCategory = 
  | 'GettingStarted'
  | 'Architecture'
  | 'Debugging'
  | 'Performance'
  | 'Security';

export type ExecutionEnvironment = 'Browser' | 'Node' | 'Python' | 'None';

// CodeExample types that match backend exactly
export interface CodeExample {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  code: string;
  language: ProgrammingLanguage;
  category: CodeExampleCategory;
  subcategory?: string;
  tags: string[];
  difficulty: DifficultyLevel;
  runnable: boolean;
  environment: ExecutionEnvironment;
  dependencies: string[];
  setupInstructions?: string;
  expectedOutput?: string;
  relatedArticles: string[];
  relatedExamples: string[];
  learningObjectives: string[];
  prerequisites: string[];
  author: string;
  dateCreated: string;
  dateModified: string;
  verified: boolean;
  source?: string;
  license?: string;
  ratings: CodeExampleRatings;
  usage: CodeExampleUsageStats;
  comments: string[];
  bookmarks: string[];
}

export interface CodeExampleRatings {
  average: number;
  count: number;
  distribution: Record<number, number>;
}

export interface CodeExampleUsageStats {
  views: number;
  executions: number;
  downloads: number;
  shares: number;
  lastAccessed: string;
  averageExecutionTime: number;
  successRate: number;
}

// Collection type that matches backend
export interface Collection {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
