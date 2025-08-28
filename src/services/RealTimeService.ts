import * as signalR from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';

export interface RealTimeNotification {
  type: string;
  data: any;
  timestamp: Date;
}

export interface CommunityUpdate {
  type: 'new_post' | 'new_comment' | 'new_reaction' | 'user_mention' | 'content_update' | 'system_notification';
  postId?: string;
  commentId?: string;
  author?: string;
  content?: string;
  title?: string;
  category?: string;
  reactionType?: string;
  action?: string;
  message?: string;
  timestamp: Date;
}

export interface UserActivity {
  username: string;
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  activity?: string;
  timestamp: Date;
}

export interface TypingIndicator {
  username: string;
  userId: string;
  postId: string;
  isTyping: boolean;
  timestamp: Date;
}

class RealTimeService {
  private connection: signalR.HubConnection | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionPromise: Promise<void> | null = null;
  
  // Event handlers
  private onNewPostHandlers: ((data: CommunityUpdate) => void)[] = [];
  private onNewCommentHandlers: ((data: CommunityUpdate) => void)[] = [];
  private onNewReactionHandlers: ((data: CommunityUpdate) => void)[] = [];
  private onUserActivityHandlers: ((data: UserActivity) => void)[] = [];
  private onTypingIndicatorHandlers: ((data: TypingIndicator) => void)[] = [];
  private onSystemNotificationHandlers: ((data: CommunityUpdate) => void)[] = [];
  private onLiveUserCountHandlers: ((count: number) => void)[] = [];
  private onConnectionStatusHandlers: ((connected: boolean) => void)[] = [];

  constructor() {
    this.setupConnection();
  }

  private setupConnection() {
    // Get the API base URL from environment variable
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5071';
    
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/community`, {
        accessTokenFactory: () => {
          const token = localStorage.getItem('token');
          return token || '';
        },
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          if (retryContext.previousRetryCount < 3) {
            return 1000 * (retryContext.previousRetryCount + 1); // 1s, 2s, 3s
          }
          return null; // Stop retrying after 3 attempts
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.connection) return;

    // Connection events
    this.connection.onclose(async (error) => {
      this.isConnected = false;
      this.notifyConnectionStatus(false);
      console.log('SignalR connection closed:', error);
      
      if (error && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.start(), 5000 * this.reconnectAttempts);
      }
    });

    this.connection.onreconnecting((error) => {
      this.isConnected = false;
      this.notifyConnectionStatus(false);
      console.log('SignalR reconnecting:', error);
    });

    this.connection.onreconnected((connectionId) => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionStatus(true);
      console.log('SignalR reconnected:', connectionId);
    });

    // Community events
    this.connection.on('NewPost', (data: CommunityUpdate) => {
      this.onNewPostHandlers.forEach(handler => handler(data));
    });

    this.connection.on('NewComment', (data: CommunityUpdate) => {
      this.onNewCommentHandlers.forEach(handler => handler(data));
    });

    this.connection.on('NewReaction', (data: CommunityUpdate) => {
      this.onNewReactionHandlers.forEach(handler => handler(data));
    });

    this.connection.on('NewActivity', (data: CommunityUpdate) => {
      // Handle generic activity updates
      console.log('New activity:', data);
    });

    // User activity events
    this.connection.on('UserConnected', (data: UserActivity) => {
      this.onUserActivityHandlers.forEach(handler => handler({ ...data, status: 'online' }));
    });

    this.connection.on('UserDisconnected', (data: UserActivity) => {
      this.onUserActivityHandlers.forEach(handler => handler({ ...data, status: 'offline' }));
    });

    this.connection.on('UserStatusUpdate', (data: UserActivity) => {
      this.onUserActivityHandlers.forEach(handler => handler(data));
    });

    this.connection.on('TypingIndicator', (data: TypingIndicator) => {
      this.onTypingIndicatorHandlers.forEach(handler => handler(data));
    });

    // System events
    this.connection.on('SystemNotification', (data: CommunityUpdate) => {
      this.onSystemNotificationHandlers.forEach(handler => handler(data));
    });

    this.connection.on('LiveUserCount', (data: { count: number }) => {
      this.onLiveUserCountHandlers.forEach(handler => handler(data.count));
    });

    this.connection.on('ContentUpdate', (data: CommunityUpdate) => {
      // Handle content updates (posts/comments edited, deleted, etc.)
      console.log('Content updated:', data);
    });

    this.connection.on('UserMention', (data: CommunityUpdate) => {
      // Handle user mentions
      this.onSystemNotificationHandlers.forEach(handler => 
        handler({ ...data, type: 'user_mention' })
      );
    });
  }

  async start(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.startConnection();
    return this.connectionPromise;
  }

  private async startConnection(): Promise<void> {
    if (!this.connection || this.isConnected) {
      return;
    }

    try {
      await this.connection.start();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionStatus(true);
      console.log('SignalR connected successfully');
    } catch (error) {
      console.error('SignalR connection failed:', error);
      this.isConnected = false;
      this.notifyConnectionStatus(false);
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  async stop(): Promise<void> {
    if (this.connection && this.isConnected) {
      await this.connection.stop();
      this.isConnected = false;
      this.notifyConnectionStatus(false);
    }
  }

  // Group management
  async joinPostGroup(postId: string): Promise<void> {
    if (this.isConnected && this.connection) {
      await this.connection.invoke('JoinPostGroup', postId);
    }
  }

  async leavePostGroup(postId: string): Promise<void> {
    if (this.isConnected && this.connection) {
      await this.connection.invoke('LeavePostGroup', postId);
    }
  }

  async joinCategoryGroup(category: string): Promise<void> {
    if (this.isConnected && this.connection) {
      await this.connection.invoke('JoinCategoryGroup', category);
    }
  }

  async leaveCategoryGroup(category: string): Promise<void> {
    if (this.isConnected && this.connection) {
      await this.connection.invoke('LeaveCategoryGroup', category);
    }
  }

  // User interactions
  async sendTypingIndicator(postId: string, isTyping: boolean): Promise<void> {
    if (this.isConnected && this.connection) {
      await this.connection.invoke('SendTypingIndicator', postId, isTyping);
    }
  }

  async updateUserStatus(status: string, activity?: string): Promise<void> {
    if (this.isConnected && this.connection) {
      await this.connection.invoke('UpdateUserStatus', status, activity);
    }
  }

  // Event subscriptions
  onNewPost(handler: (data: CommunityUpdate) => void): () => void {
    this.onNewPostHandlers.push(handler);
    return () => {
      const index = this.onNewPostHandlers.indexOf(handler);
      if (index > -1) {
        this.onNewPostHandlers.splice(index, 1);
      }
    };
  }

  onNewComment(handler: (data: CommunityUpdate) => void): () => void {
    this.onNewCommentHandlers.push(handler);
    return () => {
      const index = this.onNewCommentHandlers.indexOf(handler);
      if (index > -1) {
        this.onNewCommentHandlers.splice(index, 1);
      }
    };
  }

  onNewReaction(handler: (data: CommunityUpdate) => void): () => void {
    this.onNewReactionHandlers.push(handler);
    return () => {
      const index = this.onNewReactionHandlers.indexOf(handler);
      if (index > -1) {
        this.onNewReactionHandlers.splice(index, 1);
      }
    };
  }

  onUserActivity(handler: (data: UserActivity) => void): () => void {
    this.onUserActivityHandlers.push(handler);
    return () => {
      const index = this.onUserActivityHandlers.indexOf(handler);
      if (index > -1) {
        this.onUserActivityHandlers.splice(index, 1);
      }
    };
  }

  onTypingIndicator(handler: (data: TypingIndicator) => void): () => void {
    this.onTypingIndicatorHandlers.push(handler);
    return () => {
      const index = this.onTypingIndicatorHandlers.indexOf(handler);
      if (index > -1) {
        this.onTypingIndicatorHandlers.splice(index, 1);
      }
    };
  }

  onSystemNotification(handler: (data: CommunityUpdate) => void): () => void {
    this.onSystemNotificationHandlers.push(handler);
    return () => {
      const index = this.onSystemNotificationHandlers.indexOf(handler);
      if (index > -1) {
        this.onSystemNotificationHandlers.splice(index, 1);
      }
    };
  }

  onLiveUserCount(handler: (count: number) => void): () => void {
    this.onLiveUserCountHandlers.push(handler);
    return () => {
      const index = this.onLiveUserCountHandlers.indexOf(handler);
      if (index > -1) {
        this.onLiveUserCountHandlers.splice(index, 1);
      }
    };
  }

  onConnectionStatus(handler: (connected: boolean) => void): () => void {
    this.onConnectionStatusHandlers.push(handler);
    // Call immediately with current status
    handler(this.isConnected);
    return () => {
      const index = this.onConnectionStatusHandlers.indexOf(handler);
      if (index > -1) {
        this.onConnectionStatusHandlers.splice(index, 1);
      }
    };
  }

  private notifyConnectionStatus(connected: boolean): void {
    this.onConnectionStatusHandlers.forEach(handler => handler(connected));
  }

  // Utility methods
  get connected(): boolean {
    return this.isConnected;
  }

  get connectionState(): signalR.HubConnectionState {
    return this.connection?.state || signalR.HubConnectionState.Disconnected;
  }
}

// Create singleton instance
export const realTimeService = new RealTimeService();

// Hook for easy use in React components
export const useRealTime = () => {
  return realTimeService;
};
