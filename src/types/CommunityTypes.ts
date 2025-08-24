/**
 * Community Features Type Definitions
 * Comprehensive type system for discussions, comments, and user interactions
 */

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'moderator' | 'contributor' | 'member';
  joinDate: string;
  reputation: number;
  badges: UserBadge[];
  preferences: UserPreferences;
}

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedDate: string;
  category: 'contribution' | 'learning' | 'community' | 'achievement';
}

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  themePreference: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  discussionSort: 'newest' | 'oldest' | 'popular' | 'relevance';
  autoSubscribe: boolean;
}

export interface Discussion {
  id: string;
  title: string;
  content: string;
  author: User;
  category: DiscussionCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isClosed: boolean;
  viewCount: number;
  replyCount: number;
  likeCount: number;
  lastActivity: string;
  lastReplyBy?: User;
  relatedArticles: string[];
  attachments: Attachment[];
  subscribers: string[];
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

export interface Comment {
  id: string;
  content: string;
  author: User;
  discussionId: string;
  parentId?: string; // For nested replies
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  likeCount: number;
  dislikeCount: number;
  isApproved: boolean;
  isFlagged: boolean;
  attachments: Attachment[];
  reactions: Reaction[];
  mentions: string[];
}

export interface Reaction {
  id: string;
  type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
  emoji: string;
  userId: string;
  timestamp: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ArticleComment {
  id: string;
  content: string;
  author: User;
  articlePath: string;
  section?: string; // Specific section of the article
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  likeCount: number;
  parentId?: string;
  isApproved: boolean;
  isFlagged: boolean;
  reactions: Reaction[];
  isHighlighted: boolean; // For author/moderator highlights
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export type NotificationType =
  | 'discussion_reply'
  | 'comment_reply'
  | 'mention'
  | 'like'
  | 'follow'
  | 'badge_earned'
  | 'system_update'
  | 'content_approved'
  | 'content_flagged'
  | 'moderator_action';

export interface CommunityStats {
  totalUsers: number;
  activeUsers: number;
  totalDiscussions: number;
  totalComments: number;
  popularTags: TagStats[];
  topContributors: UserStats[];
  recentActivity: ActivityItem[];
  weeklyStats: WeeklyStats;
}

export interface TagStats {
  tag: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface UserStats {
  user: User;
  contributionScore: number;
  discussionsCreated: number;
  commentsPosted: number;
  likesReceived: number;
}

export interface ActivityItem {
  id: string;
  type: 'discussion_created' | 'comment_posted' | 'user_joined' | 'badge_earned';
  user: User;
  title: string;
  timestamp: string;
  url?: string;
}

export interface WeeklyStats {
  newUsers: number;
  newDiscussions: number;
  newComments: number;
  totalActivity: number;
  previousWeek: {
    newUsers: number;
    newDiscussions: number;
    newComments: number;
    totalActivity: number;
  };
}

export interface DiscussionFilter {
  category?: string;
  tags?: string[];
  author?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  hasReplies?: boolean;
  isPinned?: boolean;
  sortBy: 'newest' | 'oldest' | 'popular' | 'activity' | 'relevance';
  searchQuery?: string;
}

export interface CommentFilter {
  author?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  hasReplies?: boolean;
  sortBy: 'newest' | 'oldest' | 'popular';
}

export interface ModerationAction {
  id: string;
  type: 'approve' | 'reject' | 'flag' | 'pin' | 'close' | 'delete' | 'edit';
  targetType: 'discussion' | 'comment' | 'user';
  targetId: string;
  moderator: User;
  reason: string;
  timestamp: string;
  details?: any;
}

export interface CommunitySettings {
  requireApproval: boolean;
  allowAnonymous: boolean;
  enableReactions: boolean;
  enableAttachments: boolean;
  maxAttachmentSize: number;
  allowedFileTypes: string[];
  autoCloseDiscussions: boolean;
  autoCloseAfterDays: number;
  enableBadges: boolean;
  enableReputation: boolean;
  moderationLevel: 'strict' | 'moderate' | 'relaxed';
}
