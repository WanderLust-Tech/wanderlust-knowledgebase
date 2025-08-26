/**
 * API-Based Community Service
 * Manages discussions, comments, and community features using the backend API
 * Falls back to localStorage when API is unavailable
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

import { apiService, ApiCommunityPost } from './ApiService';
import { authService } from './AuthService';

// Type mappings between API and frontend types
interface ApiDiscussion extends ApiCommunityPost {
  // Extended properties for discussions
  category?: string;
  tags?: string[];
  status?: 'open' | 'closed' | 'resolved';
  views?: number;
  votes?: number;
  isSticky?: boolean;
  lastActivityAt?: string;
}

class ApiCommunityService {
  private localStorageKey = 'wanderlust_community_fallback';
  private notificationKey = 'wanderlust_notifications';
  private isOnline = navigator.onLine;
  private useApi = true;

  constructor() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncLocalChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Test API availability
    this.testApiConnection();
  }

  private async testApiConnection(): Promise<void> {
    try {
      this.useApi = await apiService.healthCheck();
      if (!this.useApi) {
        console.warn('API not available, falling back to localStorage');
      }
    } catch (error) {
      console.warn('API connection test failed, using localStorage:', error);
      this.useApi = false;
    }
  }

  // ==================== User Management ====================

  getCurrentUser(): User | null {
    // Get user from auth service (synchronous version)
    const authUser = authService.getCurrentUserSync();
    if (authUser) {
      return {
        id: authUser.id.toString(),
        username: authUser.username,
        displayName: authUser.displayName || authUser.username,
        email: authUser.email,
        avatar: authUser.avatarUrl,
        role: this.mapAuthRoleToCommunityRole(authUser.role),
        joinDate: authUser.createdAt,
        reputation: 0, // TODO: Add reputation system to API
        badges: [], // TODO: Add badges system to API
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
    }
    
    // Fallback to localStorage for anonymous users
    return this.getStoredData('currentUser');
  }

  private mapAuthRoleToCommunityRole(authRole: string): 'admin' | 'moderator' | 'contributor' | 'member' {
    switch (authRole.toLowerCase()) {
      case 'admin': return 'admin';
      case 'moderator': return 'moderator';
      case 'contributor': return 'contributor';
      default: return 'member';
    }
  }

  // ==================== Discussion Management ====================

  async getDiscussions(filter?: DiscussionFilter): Promise<Discussion[]> {
    try {
      if (this.useApi && this.isOnline) {
        return await this.getDiscussionsFromApi(filter);
      } else {
        return this.getDiscussionsFromStorage(filter);
      }
    } catch (error) {
      console.error('Error fetching discussions, falling back to localStorage:', error);
      return this.getDiscussionsFromStorage(filter);
    }
  }

  private async getDiscussionsFromApi(filter?: DiscussionFilter): Promise<Discussion[]> {
    let posts: ApiCommunityPost[];
    
    if (filter?.category) {
      posts = await apiService.getCommunityPostsByType(filter.category);
    } else {
      posts = await apiService.getCommunityPosts();
    }

    return posts.map(this.mapApiPostToDiscussion);
  }

  private getDiscussionsFromStorage(filter?: DiscussionFilter): Discussion[] {
    const discussions = this.getStoredData('discussions') || [];
    return this.filterDiscussions(discussions, filter);
  }

  private mapApiPostToDiscussion(post: ApiCommunityPost): Discussion {
    return {
      id: post.id.toString(),
      title: post.title,
      content: post.content,
      author: {
        id: 'api-user', // TODO: Get actual user ID from API
        username: post.authorName,
        displayName: post.authorName,
        email: '', // Not available from API
        avatar: post.authorAvatar || '/default-avatar.png',
        role: 'member',
        joinDate: post.createdAt,
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
      },
      category: {
        id: 'general',
        name: 'General',
        description: 'General discussions',
        color: '#3b82f6',
        icon: 'chat',
        moderators: [],
        isPrivate: false,
        requireApproval: false
      },
      tags: [], // TODO: Add tags to API model
      createdAt: post.createdAt,
      updatedAt: post.createdAt,
      isPinned: false,
      isClosed: false,
      viewCount: 0,
      replyCount: 0,
      likeCount: 0,
      lastActivity: post.createdAt,
      relatedArticles: [],
      attachments: [],
      subscribers: []
    };
  }

  async createDiscussion(discussion: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>): Promise<Discussion> {
    try {
      if (this.useApi && this.isOnline) {
        return await this.createDiscussionViaApi(discussion);
      } else {
        return this.createDiscussionLocally(discussion);
      }
    } catch (error) {
      console.error('Error creating discussion via API, saving locally:', error);
      const localDiscussion = this.createDiscussionLocally(discussion);
      this.markForSync('createDiscussion', discussion);
      return localDiscussion;
    }
  }

  private async createDiscussionViaApi(discussion: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity'>): Promise<Discussion> {
    const apiPost: Omit<ApiCommunityPost, 'id' | 'createdAt'> = {
      title: discussion.title,
      content: discussion.content,
      authorName: discussion.author.displayName,
      authorAvatar: discussion.author.avatar || '',
      type: discussion.category.name || 'discussion'
    };

    const createdPost = await apiService.createCommunityPost(apiPost);
    return this.mapApiPostToDiscussion(createdPost);
  }

  private createDiscussionLocally(discussion: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity'>): Discussion {
    const now = new Date().toISOString();
    const newDiscussion: Discussion = {
      ...discussion,
      id: `local_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
      viewCount: 0,
      replyCount: 0,
      likeCount: 0,
      isPinned: false,
      isClosed: false,
      relatedArticles: [],
      attachments: [],
      subscribers: []
    };

    const discussions = this.getStoredData('discussions') || [];
    discussions.unshift(newDiscussion);
    this.setStoredData('discussions', discussions);

    return newDiscussion;
  }

  async updateDiscussion(id: string, updates: Partial<Discussion>): Promise<void> {
    try {
      if (this.useApi && this.isOnline && !id.startsWith('local_')) {
        await this.updateDiscussionViaApi(id, updates);
      } else {
        this.updateDiscussionLocally(id, updates);
        if (!id.startsWith('local_')) {
          this.markForSync('updateDiscussion', { id, updates });
        }
      }
    } catch (error) {
      console.error('Error updating discussion via API, saving locally:', error);
      this.updateDiscussionLocally(id, updates);
      this.markForSync('updateDiscussion', { id, updates });
    }
  }

  private async updateDiscussionViaApi(id: string, updates: Partial<Discussion>): Promise<void> {
    const apiUpdates: Partial<ApiCommunityPost> = {
      title: updates.title,
      content: updates.content,
      type: updates.category
    };

    await apiService.updateCommunityPost(parseInt(id), apiUpdates);
  }

  private updateDiscussionLocally(id: string, updates: Partial<Discussion>): void {
    const discussions = this.getStoredData('discussions') || [];
    const index = discussions.findIndex(d => d.id === id);
    
    if (index !== -1) {
      discussions[index] = { 
        ...discussions[index], 
        ...updates, 
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };
      this.setStoredData('discussions', discussions);
    }
  }

  async deleteDiscussion(id: string): Promise<void> {
    try {
      if (this.useApi && this.isOnline && !id.startsWith('local_')) {
        await apiService.deleteCommunityPost(parseInt(id));
      }
      
      // Always remove from local storage
      this.deleteDiscussionLocally(id);
    } catch (error) {
      console.error('Error deleting discussion via API:', error);
      this.deleteDiscussionLocally(id);
      this.markForSync('deleteDiscussion', { id });
    }
  }

  private deleteDiscussionLocally(id: string): void {
    const discussions = this.getStoredData('discussions') || [];
    const filtered = discussions.filter(d => d.id !== id);
    this.setStoredData('discussions', filtered);
  }

  // ==================== Comment Management ====================

  async addComment(discussionId: string, content: string, parentId?: string): Promise<Comment> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('User must be logged in to comment');
    }

    const comment: Comment = {
      id: `comment_${Date.now()}`,
      content,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar || '/default-avatar.png',
        role: user.role,
        reputation: user.reputation
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      votes: 0,
      reactions: [],
      parentId,
      replies: [],
      isEdited: false,
      moderationStatus: 'approved'
    };

    // TODO: Implement comment API endpoints
    // For now, store locally
    this.addCommentLocally(discussionId, comment);
    this.markForSync('addComment', { discussionId, comment });

    return comment;
  }

  private addCommentLocally(discussionId: string, comment: Comment): void {
    const discussions = this.getStoredData('discussions') || [];
    const discussion = discussions.find(d => d.id === discussionId);
    
    if (discussion) {
      if (comment.parentId) {
        // Add as reply
        const parentComment = this.findCommentById(discussion.comments, comment.parentId);
        if (parentComment) {
          parentComment.replies.push(comment);
        }
      } else {
        // Add as top-level comment
        discussion.comments.push(comment);
      }
      
      discussion.lastActivityAt = comment.createdAt;
      this.setStoredData('discussions', discussions);
    }
  }

  private findCommentById(comments: Comment[], id: string): Comment | null {
    for (const comment of comments) {
      if (comment.id === id) return comment;
      const found = this.findCommentById(comment.replies, id);
      if (found) return found;
    }
    return null;
  }

  // ==================== Statistics ====================

  async getCommunityStats(): Promise<CommunityStats> {
    try {
      if (this.useApi && this.isOnline) {
        // TODO: Implement stats API endpoint
        return await this.getCommunityStatsFromApi();
      } else {
        return this.getCommunityStatsFromStorage();
      }
    } catch (error) {
      console.error('Error fetching community stats:', error);
      return this.getCommunityStatsFromStorage();
    }
  }

  private async getCommunityStatsFromApi(): Promise<CommunityStats> {
    const discussions = await this.getDiscussionsFromApi();
    
    return {
      totalDiscussions: discussions.length,
      totalComments: discussions.reduce((sum, d) => sum + this.countComments(d.comments), 0),
      activeUsers: new Set(discussions.map(d => d.author.id)).size,
      totalViews: discussions.reduce((sum, d) => sum + (d.views || 0), 0),
      topCategories: this.getTopCategories(discussions),
      recentActivity: discussions.slice(0, 5).map(d => ({
        type: 'discussion' as const,
        id: d.id,
        title: d.title,
        author: d.author.displayName,
        timestamp: d.lastActivityAt || d.createdAt
      }))
    };
  }

  private getCommunityStatsFromStorage(): CommunityStats {
    const discussions = this.getStoredData('discussions') || [];
    
    return {
      totalDiscussions: discussions.length,
      totalComments: discussions.reduce((sum, d) => sum + this.countComments(d.comments), 0),
      activeUsers: new Set(discussions.map(d => d.author.id)).size,
      totalViews: discussions.reduce((sum, d) => sum + (d.views || 0), 0),
      topCategories: this.getTopCategories(discussions),
      recentActivity: discussions.slice(0, 5).map(d => ({
        type: 'discussion' as const,
        id: d.id,
        title: d.title,
        author: d.author.displayName,
        timestamp: d.lastActivityAt || d.createdAt
      }))
    };
  }

  private countComments(comments: Comment[]): number {
    return comments.reduce((sum, comment) => sum + 1 + this.countComments(comment.replies), 0);
  }

  private getTopCategories(discussions: Discussion[]): Array<{ name: string; count: number }> {
    const categoryCount: Record<string, number> = {};
    
    discussions.forEach(d => {
      const category = d.category || 'General';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    return Object.entries(categoryCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // ==================== Sync Management ====================

  private markForSync(action: string, data: any): void {
    const syncQueue = this.getStoredData('syncQueue') || [];
    syncQueue.push({
      action,
      data,
      timestamp: new Date().toISOString()
    });
    this.setStoredData('syncQueue', syncQueue);
  }

  private async syncLocalChanges(): Promise<void> {
    if (!this.useApi || !this.isOnline) return;

    const syncQueue = this.getStoredData('syncQueue') || [];
    if (syncQueue.length === 0) return;

    console.log(`Syncing ${syncQueue.length} local changes...`);

    for (const item of syncQueue) {
      try {
        await this.processSyncItem(item);
      } catch (error) {
        console.error('Error syncing item:', item, error);
        // Keep the item in queue for retry
        continue;
      }
    }

    // Clear successfully synced items
    this.setStoredData('syncQueue', []);
  }

  private async processSyncItem(item: any): Promise<void> {
    switch (item.action) {
      case 'createDiscussion':
        await this.createDiscussionViaApi(item.data);
        break;
      case 'updateDiscussion':
        await this.updateDiscussionViaApi(item.data.id, item.data.updates);
        break;
      case 'deleteDiscussion':
        await apiService.deleteCommunityPost(parseInt(item.data.id));
        break;
      // TODO: Add more sync actions as needed
    }
  }

  // ==================== Utility Methods ====================

  private filterDiscussions(discussions: Discussion[], filter?: DiscussionFilter): Discussion[] {
    if (!filter) return discussions;

    let filtered = [...discussions];

    if (filter.category) {
      filtered = filtered.filter(d => d.category === filter.category);
    }

    if (filter.author) {
      filtered = filtered.filter(d => d.author.username.toLowerCase().includes(filter.author!.toLowerCase()));
    }

    if (filter.status) {
      filtered = filtered.filter(d => d.status === filter.status);
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(d => 
        filter.tags!.some(tag => d.tags.includes(tag))
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(searchLower) ||
        d.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    const sortBy = filter.sortBy || 'newest';
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'most-active':
        filtered.sort((a, b) => new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime());
        break;
      case 'most-votes':
        filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
        break;
    }

    return filtered;
  }

  // Local storage helpers
  private getStoredData(key: string): any {
    try {
      const data = localStorage.getItem(`${this.localStorageKey}_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  private setStoredData(key: string, data: any): void {
    try {
      localStorage.setItem(`${this.localStorageKey}_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  // ==================== Legacy Method Support ====================
  // These methods maintain compatibility with the existing UI components

  createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): void {
    // TODO: Implement notifications API
    const notifications = this.getStoredData('notifications') || [];
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    
    notifications.unshift(newNotification);
    this.setStoredData('notifications', notifications);
  }

  getNotifications(userId: string): Notification[] {
    const notifications = this.getStoredData('notifications') || [];
    return notifications.filter((n: Notification) => n.userId === userId);
  }

  markNotificationAsRead(id: string): void {
    const notifications = this.getStoredData('notifications') || [];
    const notification = notifications.find((n: Notification) => n.id === id);
    if (notification) {
      notification.isRead = true;
      this.setStoredData('notifications', notifications);
    }
  }
}

// Create singleton instance
export const apiCommunityService = new ApiCommunityService();
export default apiCommunityService;
