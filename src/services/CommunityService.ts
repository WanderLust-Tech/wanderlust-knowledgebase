/**
 * Community Service
 * Manages discussions, comments, user interactions, and community features
 */

import { 
  Discussion, 
  Comment, 
  ArticleComment, 
  User, 
  DiscussionFilter, 
  CommentFilter, 
  CommunityStats,
  Notification,
  ModerationAction,
  UserBadge,
  Reaction
} from '../types/CommunityTypes';

class CommunityService {
  private storageKey = 'wanderlust_community';
  private notificationKey = 'wanderlust_notifications';
  private currentUser: User | null = null;

  constructor() {
    this.initializeDefaultUser();
  }

  // ==================== User Management ====================

  private initializeDefaultUser(): void {
    const savedUser = this.getStoredData('currentUser');
    if (!savedUser) {
      this.currentUser = {
        id: `user_${Date.now()}`,
        username: 'anonymous',
        displayName: 'Anonymous User',
        email: '',
        role: 'member',
        joinDate: new Date().toISOString(),
        reputation: 0,
        badges: [],
        preferences: {
          emailNotifications: true,
          pushNotifications: false,
          themePreference: 'system',
          language: 'en',
          timezone: 'UTC',
          discussionSort: 'newest',
          autoSubscribe: true
        }
      };
      this.saveCurrentUser();
    } else {
      this.currentUser = savedUser;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  setCurrentUser(user: User): void {
    this.currentUser = user;
    this.saveCurrentUser();
  }

  private saveCurrentUser(): void {
    this.setStoredData('currentUser', this.currentUser);
  }

  updateUserPreferences(preferences: Partial<User['preferences']>): void {
    if (this.currentUser) {
      this.currentUser.preferences = { ...this.currentUser.preferences, ...preferences };
      this.saveCurrentUser();
    }
  }

  awardBadge(userId: string, badge: UserBadge): void {
    const user = this.getCurrentUser();
    if (user && user.id === userId) {
      user.badges.push(badge);
      user.reputation += 10; // Badge bonus
      this.saveCurrentUser();
      this.createNotification({
        userId,
        type: 'badge_earned',
        title: '🎉 New Badge Earned!',
        message: `You've earned the "${badge.name}" badge!`,
        data: { badge },
        priority: 'medium'
      });
    }
  }

  // ==================== Discussion Management ====================

  getDiscussions(filter?: DiscussionFilter): Discussion[] {
    const discussions = this.getStoredData('discussions') || [];
    return this.filterDiscussions(discussions, filter);
  }

  getDiscussion(id: string): Discussion | null {
    const discussions = this.getStoredData('discussions') || [];
    const discussion = discussions.find((d: Discussion) => d.id === id);
    
    if (discussion) {
      // Increment view count
      discussion.viewCount = (discussion.viewCount || 0) + 1;
      this.setStoredData('discussions', discussions);
    }
    
    return discussion || null;
  }

  createDiscussion(discussionData: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'replyCount' | 'likeCount' | 'lastActivity' | 'subscribers'>): Discussion {
    const discussions = this.getStoredData('discussions') || [];
    
    const newDiscussion: Discussion = {
      id: `discussion_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: 0,
      replyCount: 0,
      likeCount: 0,
      lastActivity: new Date().toISOString(),
      subscribers: [discussionData.author.id],
      ...discussionData
    };

    discussions.unshift(newDiscussion);
    this.setStoredData('discussions', discussions);

    // Award contribution badge if it's user's first discussion
    const userDiscussions = discussions.filter((d: Discussion) => d.author.id === discussionData.author.id);
    if (userDiscussions.length === 1) {
      this.awardBadge(discussionData.author.id, {
        id: `badge_first_discussion_${Date.now()}`,
        name: 'Discussion Starter',
        description: 'Created your first discussion',
        icon: '💬',
        color: '#3B82F6',
        earnedDate: new Date().toISOString(),
        category: 'contribution'
      });
    }

    return newDiscussion;
  }

  updateDiscussion(id: string, updates: Partial<Discussion>): boolean {
    const discussions = this.getStoredData('discussions') || [];
    const index = discussions.findIndex((d: Discussion) => d.id === id);
    
    if (index !== -1) {
      discussions[index] = {
        ...discussions[index],
        ...updates,
        updatedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      this.setStoredData('discussions', discussions);
      return true;
    }
    return false;
  }

  private filterDiscussions(discussions: Discussion[], filter?: DiscussionFilter): Discussion[] {
    if (!filter) return discussions;

    let filtered = discussions;

    if (filter.category) {
      filtered = filtered.filter(d => d.category.id === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(d => 
        filter.tags!.some(tag => d.tags.includes(tag))
      );
    }

    if (filter.author) {
      filtered = filtered.filter(d => d.author.id === filter.author);
    }

    if (filter.hasReplies !== undefined) {
      filtered = filtered.filter(d => 
        filter.hasReplies ? d.replyCount > 0 : d.replyCount === 0
      );
    }

    if (filter.isPinned !== undefined) {
      filtered = filtered.filter(d => d.isPinned === filter.isPinned);
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(query) ||
        d.content.toLowerCase().includes(query) ||
        d.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort discussions
    filtered.sort((a, b) => {
      switch (filter.sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'popular':
          return (b.likeCount + b.replyCount) - (a.likeCount + a.replyCount);
        case 'activity':
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }

  // ==================== Comment Management ====================

  getComments(discussionId: string, filter?: CommentFilter): Comment[] {
    const comments = this.getStoredData('comments') || [];
    const discussionComments = comments.filter((c: Comment) => c.discussionId === discussionId);
    return this.filterComments(discussionComments, filter);
  }

  getArticleComments(articlePath: string): ArticleComment[] {
    const comments = this.getStoredData('articleComments') || [];
    return comments.filter((c: ArticleComment) => c.articlePath === articlePath);
  }

  createComment(commentData: Omit<Comment, 'id' | 'createdAt' | 'isEdited' | 'likeCount' | 'dislikeCount' | 'isApproved' | 'isFlagged' | 'reactions'>): Comment {
    const comments = this.getStoredData('comments') || [];
    const discussions = this.getStoredData('discussions') || [];
    
    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isEdited: false,
      likeCount: 0,
      dislikeCount: 0,
      isApproved: true,
      isFlagged: false,
      reactions: [],
      ...commentData
    };

    comments.push(newComment);
    this.setStoredData('comments', comments);

    // Update discussion reply count and last activity
    const discussionIndex = discussions.findIndex((d: Discussion) => d.id === commentData.discussionId);
    if (discussionIndex !== -1) {
      discussions[discussionIndex].replyCount++;
      discussions[discussionIndex].lastActivity = new Date().toISOString();
      discussions[discussionIndex].lastReplyBy = commentData.author;
      this.setStoredData('discussions', discussions);
    }

    // Notify discussion author and subscribers
    const discussion = discussions[discussionIndex];
    if (discussion && discussion.author.id !== commentData.author.id) {
      this.createNotification({
        userId: discussion.author.id,
        type: 'discussion_reply',
        title: 'New Reply to Your Discussion',
        message: `${commentData.author.displayName} replied to "${discussion.title}"`,
        data: { discussionId: discussion.id, commentId: newComment.id },
        priority: 'medium'
      });
    }

    return newComment;
  }

  createArticleComment(commentData: Omit<ArticleComment, 'id' | 'createdAt' | 'isEdited' | 'likeCount' | 'isApproved' | 'isFlagged' | 'reactions' | 'isHighlighted'>): ArticleComment {
    const comments = this.getStoredData('articleComments') || [];
    
    const newComment: ArticleComment = {
      id: `article_comment_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isEdited: false,
      likeCount: 0,
      isApproved: true,
      isFlagged: false,
      reactions: [],
      isHighlighted: false,
      ...commentData
    };

    comments.push(newComment);
    this.setStoredData('articleComments', comments);

    return newComment;
  }

  private filterComments(comments: Comment[], filter?: CommentFilter): Comment[] {
    if (!filter) return comments;

    let filtered = comments;

    if (filter.author) {
      filtered = filtered.filter(c => c.author.id === filter.author);
    }

    if (filter.hasReplies !== undefined) {
      const allComments = this.getStoredData('comments') || [];
      filtered = filtered.filter(c => {
        const hasReplies = allComments.some((reply: Comment) => reply.parentId === c.id);
        return filter.hasReplies ? hasReplies : !hasReplies;
      });
    }

    // Sort comments
    filtered.sort((a, b) => {
      switch (filter.sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'popular':
          return (b.likeCount - b.dislikeCount) - (a.likeCount - a.dislikeCount);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }

  // ==================== Reactions & Interactions ====================

  addReaction(targetType: 'discussion' | 'comment' | 'article_comment', targetId: string, reactionType: Reaction['type']): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    const storageKey = targetType === 'discussion' ? 'discussions' : 
                      targetType === 'comment' ? 'comments' : 'articleComments';
    const items = this.getStoredData(storageKey) || [];
    const itemIndex = items.findIndex((item: any) => item.id === targetId);

    if (itemIndex === -1) return false;

    const reaction: Reaction = {
      id: `reaction_${Date.now()}`,
      type: reactionType,
      emoji: this.getReactionEmoji(reactionType),
      userId: user.id,
      timestamp: new Date().toISOString()
    };

    if (!items[itemIndex].reactions) {
      items[itemIndex].reactions = [];
    }

    // Remove existing reaction from this user
    items[itemIndex].reactions = items[itemIndex].reactions.filter((r: Reaction) => r.userId !== user.id);
    
    // Add new reaction
    items[itemIndex].reactions.push(reaction);

    // Update like count for backwards compatibility
    if (reactionType === 'like') {
      items[itemIndex].likeCount = items[itemIndex].reactions.filter((r: Reaction) => r.type === 'like').length;
    }

    this.setStoredData(storageKey, items);
    return true;
  }

  private getReactionEmoji(type: Reaction['type']): string {
    const emojiMap = {
      'like': '👍',
      'love': '❤️',
      'laugh': '😂',
      'wow': '😮',
      'sad': '😢',
      'angry': '😠'
    };
    return emojiMap[type];
  }

  // ==================== Notifications ====================

  getNotifications(userId: string): Notification[] {
    const notifications = this.getStoredData(this.notificationKey) || [];
    return notifications
      .filter((n: Notification) => n.userId === userId)
      .sort((a: Notification, b: Notification) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  createNotification(notificationData: Omit<Notification, 'id' | 'isRead' | 'createdAt'>): void {
    const notifications = this.getStoredData(this.notificationKey) || [];
    
    const notification: Notification = {
      id: `notification_${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      ...notificationData
    };

    notifications.push(notification);
    this.setStoredData(this.notificationKey, notifications);
  }

  markNotificationAsRead(notificationId: string): void {
    const notifications = this.getStoredData(this.notificationKey) || [];
    const index = notifications.findIndex((n: Notification) => n.id === notificationId);
    
    if (index !== -1) {
      notifications[index].isRead = true;
      this.setStoredData(this.notificationKey, notifications);
    }
  }

  // ==================== Community Stats ====================

  getCommunityStats(): CommunityStats {
    const discussions = this.getStoredData('discussions') || [];
    const comments = this.getStoredData('comments') || [];
    const users = [this.currentUser].filter(Boolean) as User[];

    const tagStats = this.calculateTagStats(discussions);
    const userStats = this.calculateUserStats(discussions, comments, users);

    return {
      totalUsers: users.length,
      activeUsers: users.length, // Simplified for demo
      totalDiscussions: discussions.length,
      totalComments: comments.length,
      popularTags: tagStats,
      topContributors: userStats,
      recentActivity: this.getRecentActivity(),
      weeklyStats: this.getWeeklyStats()
    };
  }

  private calculateTagStats(discussions: Discussion[]): Array<{tag: string, count: number, trend: 'up' | 'down' | 'stable'}> {
    const tagCounts: Record<string, number> = {};
    
    discussions.forEach(discussion => {
      discussion.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count, trend: 'stable' as const }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateUserStats(discussions: Discussion[], comments: Comment[], users: User[]): Array<any> {
    return users.map(user => ({
      user,
      contributionScore: user.reputation,
      discussionsCreated: discussions.filter(d => d.author.id === user.id).length,
      commentsPosted: comments.filter(c => c.author.id === user.id).length,
      likesReceived: discussions.filter(d => d.author.id === user.id).reduce((sum, d) => sum + d.likeCount, 0)
    }));
  }

  private getRecentActivity(): Array<any> {
    const discussions = this.getStoredData('discussions') || [];
    const comments = this.getStoredData('comments') || [];
    
    const activities = [
      ...discussions.slice(0, 5).map((d: Discussion) => ({
        id: `activity_discussion_${d.id}`,
        type: 'discussion_created' as const,
        user: d.author,
        title: `Created discussion: ${d.title}`,
        timestamp: d.createdAt,
        url: `/community/discussion/${d.id}`
      })),
      ...comments.slice(0, 5).map((c: Comment) => ({
        id: `activity_comment_${c.id}`,
        type: 'comment_posted' as const,
        user: c.author,
        title: 'Posted a comment',
        timestamp: c.createdAt
      }))
    ];

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }

  private getWeeklyStats(): any {
    // Simplified implementation for demo
    return {
      newUsers: 5,
      newDiscussions: 12,
      newComments: 34,
      totalActivity: 51,
      previousWeek: {
        newUsers: 3,
        newDiscussions: 8,
        newComments: 28,
        totalActivity: 39
      }
    };
  }

  // ==================== Storage Utilities ====================

  private getStoredData(key: string): any {
    try {
      const data = localStorage.getItem(`${this.storageKey}_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading community data:', error);
      return null;
    }
  }

  private setStoredData(key: string, data: any): void {
    try {
      localStorage.setItem(`${this.storageKey}_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving community data:', error);
    }
  }

  // ==================== Demo Data ====================

  initializeDemoData(): void {
    if (!this.getStoredData('discussions')) {
      this.createDemoDiscussions();
    }
  }

  private createDemoDiscussions(): void {
    const demoUser = this.getCurrentUser()!;
    
    const demoDiscussion = this.createDiscussion({
      title: 'Welcome to the Chromium Knowledge Base Community!',
      content: `Welcome everyone! This is our new community discussion space where you can:

- Ask questions about Chromium development
- Share tips and best practices
- Discuss architecture decisions
- Get help with build issues
- Connect with other developers

Feel free to introduce yourself and let us know what you're working on!`,
      author: {
        ...demoUser,
        displayName: 'Community Bot',
        role: 'admin',
        badges: [{
          id: 'admin_badge',
          name: 'Community Admin',
          description: 'Administrator of the community',
          icon: '🛡️',
          color: '#DC2626',
          earnedDate: new Date().toISOString(),
          category: 'community'
        }]
      },
      category: {
        id: 'general',
        name: 'General Discussion',
        description: 'General topics and announcements',
        color: '#3B82F6',
        icon: '💬',
        moderators: [demoUser.id],
        isPrivate: false,
        requireApproval: false
      },
      tags: ['welcome', 'community', 'introduction'],
      isPinned: true,
      isClosed: false,
      relatedArticles: ['/introduction/overview'],
      attachments: []
    });

    // Add a demo comment
    this.createComment({
      content: `Thanks for setting up this community space! I'm excited to connect with other Chromium developers. 

I'm currently working on understanding the multi-process architecture. Looking forward to learning from everyone here! 🚀`,
      author: {
        ...demoUser,
        displayName: 'Developer Mike',
        role: 'member'
      },
      discussionId: demoDiscussion.id,
      attachments: [],
      mentions: []
    });
  }
}

export const communityService = new CommunityService();
