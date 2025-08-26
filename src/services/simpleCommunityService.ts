/**
 * Simple API-Based Community Service
 * Minimal implementation to replace localStorage with API calls
 */

import { apiService, ApiCommunityPost } from './ApiService';
import { authService } from './AuthService';

// Simplified types for initial implementation
export interface SimpleCommunityPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorAvatar: string;
  type: string;
  createdAt: string;
}

export interface CommunityStats {
  totalPosts: number;
  recentPosts: SimpleCommunityPost[];
}

class SimpleCommunityService {
  private isOnline = navigator.onLine;
  private useApi = true;
  private localStorageKey = 'wanderlust_community_simple';

  constructor() {
    this.testApiConnection();
    
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineChanges();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private async testApiConnection(): Promise<void> {
    try {
      this.useApi = await apiService.healthCheck();
      console.log('Community API status:', this.useApi ? 'Available' : 'Offline');
    } catch (error) {
      console.warn('Community API not available, using localStorage fallback');
      this.useApi = false;
    }
  }

  // ==================== Posts Management ====================

  async getPosts(): Promise<SimpleCommunityPost[]> {
    try {
      if (this.useApi && this.isOnline) {
        console.log('📡 Fetching posts from API...');
        const apiPosts = await apiService.getCommunityPosts();
        const posts = apiPosts.map(this.mapApiPostToSimple);
        
        // Cache in localStorage for offline access
        this.setStoredData('posts', posts);
        
        return posts;
      } else {
        console.log('📱 Loading posts from localStorage...');
        return this.getStoredData('posts') || [];
      }
    } catch (error) {
      console.error('Error fetching posts from API, using localStorage:', error);
      return this.getStoredData('posts') || [];
    }
  }

  async getPostsByType(type: string): Promise<SimpleCommunityPost[]> {
    try {
      if (this.useApi && this.isOnline) {
        console.log(`📡 Fetching ${type} posts from API...`);
        const apiPosts = await apiService.getCommunityPostsByType(type);
        return apiPosts.map(this.mapApiPostToSimple);
      } else {
        console.log(`📱 Loading ${type} posts from localStorage...`);
        const allPosts = this.getStoredData('posts') || [];
        return allPosts.filter((post: SimpleCommunityPost) => post.type === type);
      }
    } catch (error) {
      console.error(`Error fetching ${type} posts from API:`, error);
      const allPosts = this.getStoredData('posts') || [];
      return allPosts.filter((post: SimpleCommunityPost) => post.type === type);
    }
  }

  async createPost(post: Omit<SimpleCommunityPost, 'id' | 'createdAt'>): Promise<SimpleCommunityPost> {
    try {
      if (this.useApi && this.isOnline) {
        console.log('📡 Creating post via API...');
        const apiPost = await apiService.createCommunityPost({
          title: post.title,
          content: post.content,
          authorName: post.authorName,
          authorAvatar: post.authorAvatar,
          type: post.type
        });
        
        const newPost = this.mapApiPostToSimple(apiPost);
        
        // Update local cache
        const posts = this.getStoredData('posts') || [];
        posts.unshift(newPost);
        this.setStoredData('posts', posts);
        
        return newPost;
      } else {
        console.log('📱 Creating post locally...');
        return this.createPostLocally(post);
      }
    } catch (error) {
      console.error('Error creating post via API, saving locally:', error);
      const localPost = this.createPostLocally(post);
      this.markForSync('createPost', post);
      return localPost;
    }
  }

  async updatePost(id: string, updates: Partial<SimpleCommunityPost>): Promise<void> {
    try {
      if (this.useApi && this.isOnline && !id.startsWith('local_')) {
        console.log(`📡 Updating post ${id} via API...`);
        await apiService.updateCommunityPost(parseInt(id), {
          title: updates.title,
          content: updates.content,
          type: updates.type
        });
      }
      
      // Always update local cache
      this.updatePostLocally(id, updates);
      
      if (!id.startsWith('local_')) {
        this.markForSync('updatePost', { id, updates });
      }
    } catch (error) {
      console.error('Error updating post via API:', error);
      this.updatePostLocally(id, updates);
      this.markForSync('updatePost', { id, updates });
    }
  }

  async deletePost(id: string): Promise<void> {
    try {
      if (this.useApi && this.isOnline && !id.startsWith('local_')) {
        console.log(`📡 Deleting post ${id} via API...`);
        await apiService.deleteCommunityPost(parseInt(id));
      }
      
      // Always remove from local cache
      this.deletePostLocally(id);
    } catch (error) {
      console.error('Error deleting post via API:', error);
      this.deletePostLocally(id);
      this.markForSync('deletePost', { id });
    }
  }

  // ==================== Statistics ====================

  async getStats(): Promise<CommunityStats> {
    try {
      const posts = await this.getPosts();
      return {
        totalPosts: posts.length,
        recentPosts: posts.slice(0, 5)
      };
    } catch (error) {
      console.error('Error getting community stats:', error);
      return {
        totalPosts: 0,
        recentPosts: []
      };
    }
  }

  // ==================== User Management ====================

  getCurrentUser(): { username: string; displayName: string; avatar?: string } | null {
    const authUser = authService.getCurrentUserSync();
    if (authUser) {
      return {
        username: authUser.username,
        displayName: authUser.displayName || authUser.username,
        avatar: authUser.avatarUrl
      };
    }
    return null;
  }

  // ==================== Private Helper Methods ====================

  private mapApiPostToSimple(apiPost: ApiCommunityPost): SimpleCommunityPost {
    return {
      id: apiPost.id.toString(),
      title: apiPost.title,
      content: apiPost.content,
      authorName: apiPost.authorName,
      authorAvatar: apiPost.authorAvatar,
      type: apiPost.type,
      createdAt: apiPost.createdAt
    };
  }

  private createPostLocally(post: Omit<SimpleCommunityPost, 'id' | 'createdAt'>): SimpleCommunityPost {
    const newPost: SimpleCommunityPost = {
      ...post,
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const posts = this.getStoredData('posts') || [];
    posts.unshift(newPost);
    this.setStoredData('posts', posts);

    return newPost;
  }

  private updatePostLocally(id: string, updates: Partial<SimpleCommunityPost>): void {
    const posts = this.getStoredData('posts') || [];
    const index = posts.findIndex((p: SimpleCommunityPost) => p.id === id);
    
    if (index !== -1) {
      posts[index] = { ...posts[index], ...updates };
      this.setStoredData('posts', posts);
    }
  }

  private deletePostLocally(id: string): void {
    const posts = this.getStoredData('posts') || [];
    const filtered = posts.filter((p: SimpleCommunityPost) => p.id !== id);
    this.setStoredData('posts', filtered);
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

  private async syncOfflineChanges(): Promise<void> {
    if (!this.useApi || !this.isOnline) return;

    const syncQueue = this.getStoredData('syncQueue') || [];
    if (syncQueue.length === 0) return;

    console.log(`🔄 Syncing ${syncQueue.length} offline changes...`);

    const successfulSyncs: any[] = [];

    for (const item of syncQueue) {
      try {
        await this.processSyncItem(item);
        successfulSyncs.push(item);
        console.log('✅ Synced:', item.action);
      } catch (error) {
        console.error('❌ Failed to sync:', item.action, error);
        // Keep failed items in queue for retry
      }
    }

    // Remove successfully synced items
    const remainingQueue = syncQueue.filter((item: any) => !successfulSyncs.includes(item));
    this.setStoredData('syncQueue', remainingQueue);

    if (successfulSyncs.length > 0) {
      console.log(`🎉 Successfully synced ${successfulSyncs.length} changes`);
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    switch (item.action) {
      case 'createPost':
        await apiService.createCommunityPost({
          title: item.data.title,
          content: item.data.content,
          authorName: item.data.authorName,
          authorAvatar: item.data.authorAvatar,
          type: item.data.type
        });
        break;
      case 'updatePost':
        await apiService.updateCommunityPost(parseInt(item.data.id), {
          title: item.data.updates.title,
          content: item.data.updates.content,
          type: item.data.updates.type
        });
        break;
      case 'deletePost':
        await apiService.deleteCommunityPost(parseInt(item.data.id));
        break;
      default:
        console.warn('Unknown sync action:', item.action);
    }
  }

  // ==================== Local Storage Helpers ====================

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

  // ==================== Migration Helper ====================

  /**
   * Migrate existing localStorage data from the old community service
   */
  async migrateFromLegacyService(): Promise<void> {
    try {
      const legacyDiscussions = localStorage.getItem('wanderlust_community_discussions');
      if (legacyDiscussions) {
        const discussions = JSON.parse(legacyDiscussions);
        console.log(`🔄 Migrating ${discussions.length} legacy discussions...`);
        
        const posts: SimpleCommunityPost[] = discussions.map((d: any) => ({
          id: d.id,
          title: d.title,
          content: d.content,
          authorName: d.author?.displayName || 'Unknown',
          authorAvatar: d.author?.avatar || '',
          type: d.category || 'discussion',
          createdAt: d.createdAt
        }));
        
        this.setStoredData('posts', posts);
        console.log('✅ Legacy discussions migrated successfully');
      }
    } catch (error) {
      console.error('Error migrating legacy data:', error);
    }
  }
}

// Create singleton instance
export const simpleCommunityService = new SimpleCommunityService();
export default simpleCommunityService;
