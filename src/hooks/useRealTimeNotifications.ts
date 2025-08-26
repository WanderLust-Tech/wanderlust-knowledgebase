import { useEffect, useState, useCallback } from 'react';
import { realTimeService, CommunityUpdate, UserActivity, TypingIndicator } from '../services/RealTimeService';
import { useAuth } from '../contexts/AuthContext';

export interface RealTimeState {
  connected: boolean;
  onlineUsers: number;
  notifications: CommunityUpdate[];
  typingUsers: TypingIndicator[];
  userActivity: UserActivity[];
}

export const useRealTimeNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<RealTimeState>({
    connected: false,
    onlineUsers: 0,
    notifications: [],
    typingUsers: [],
    userActivity: []
  });

  const [unreadCount, setUnreadCount] = useState(0);

  // Add notification
  const addNotification = useCallback((notification: CommunityUpdate) => {
    setState(prev => ({
      ...prev,
      notifications: [notification, ...prev.notifications].slice(0, 50) // Keep last 50
    }));
    setUnreadCount(prev => prev + 1);
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
    setUnreadCount(0);
  }, []);

  // Mark notifications as read
  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Remove old typing indicators
  const cleanupTypingIndicators = useCallback(() => {
    setState(prev => ({
      ...prev,
      typingUsers: prev.typingUsers.filter(
        typing => Date.now() - new Date(typing.timestamp).getTime() < 5000 // 5 seconds
      )
    }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Start connection
    realTimeService.start().catch(console.error);

    // Setup event handlers
    const unsubscribeFunctions: (() => void)[] = [];

    // Connection status
    unsubscribeFunctions.push(
      realTimeService.onConnectionStatus((connected) => {
        setState(prev => ({ ...prev, connected }));
      })
    );

    // New posts
    unsubscribeFunctions.push(
      realTimeService.onNewPost((data) => {
        addNotification(data);
      })
    );

    // New comments
    unsubscribeFunctions.push(
      realTimeService.onNewComment((data) => {
        addNotification(data);
      })
    );

    // New reactions
    unsubscribeFunctions.push(
      realTimeService.onNewReaction((data) => {
        addNotification(data);
      })
    );

    // User activity
    unsubscribeFunctions.push(
      realTimeService.onUserActivity((data) => {
        setState(prev => ({
          ...prev,
          userActivity: [data, ...prev.userActivity.filter(u => u.userId !== data.userId)].slice(0, 20)
        }));
      })
    );

    // Typing indicators
    unsubscribeFunctions.push(
      realTimeService.onTypingIndicator((data) => {
        setState(prev => {
          const filtered = prev.typingUsers.filter(
            t => t.userId !== data.userId || t.postId !== data.postId
          );
          
          if (data.isTyping) {
            return {
              ...prev,
              typingUsers: [...filtered, data]
            };
          } else {
            return {
              ...prev,
              typingUsers: filtered
            };
          }
        });
      })
    );

    // System notifications
    unsubscribeFunctions.push(
      realTimeService.onSystemNotification((data) => {
        addNotification(data);
      })
    );

    // Live user count
    unsubscribeFunctions.push(
      realTimeService.onLiveUserCount((count) => {
        setState(prev => ({ ...prev, onlineUsers: count }));
      })
    );

    // Cleanup typing indicators periodically
    const typingCleanupInterval = setInterval(cleanupTypingIndicators, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(typingCleanupInterval);
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      realTimeService.stop();
    };
  }, [isAuthenticated, addNotification, cleanupTypingIndicators]);

  // Helper functions
  const joinPostGroup = useCallback(async (postId: string) => {
    await realTimeService.joinPostGroup(postId);
  }, []);

  const leavePostGroup = useCallback(async (postId: string) => {
    await realTimeService.leavePostGroup(postId);
  }, []);

  const sendTypingIndicator = useCallback(async (postId: string, isTyping: boolean) => {
    await realTimeService.sendTypingIndicator(postId, isTyping);
  }, []);

  const updateUserStatus = useCallback(async (status: string, activity?: string) => {
    await realTimeService.updateUserStatus(status, activity);
  }, []);

  return {
    ...state,
    unreadCount,
    clearNotifications,
    markAsRead,
    joinPostGroup,
    leavePostGroup,
    sendTypingIndicator,
    updateUserStatus,
    service: realTimeService
  };
};

// Hook for specific post real-time updates
export const usePostRealTime = (postId: string) => {
  const realTime = useRealTimeNotifications();
  const [postNotifications, setPostNotifications] = useState<CommunityUpdate[]>([]);
  const [typingInPost, setTypingInPost] = useState<TypingIndicator[]>([]);

  useEffect(() => {
    if (postId) {
      realTime.joinPostGroup(postId);
      
      return () => {
        realTime.leavePostGroup(postId);
      };
    }
  }, [postId, realTime]);

  useEffect(() => {
    // Filter notifications for this post
    const postSpecificNotifications = realTime.notifications.filter(
      notification => notification.postId === postId
    );
    setPostNotifications(postSpecificNotifications);

    // Filter typing indicators for this post
    const postTyping = realTime.typingUsers.filter(
      typing => typing.postId === postId
    );
    setTypingInPost(postTyping);
  }, [realTime.notifications, realTime.typingUsers, postId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    realTime.sendTypingIndicator(postId, isTyping);
  }, [postId, realTime]);

  return {
    notifications: postNotifications,
    typingUsers: typingInPost,
    sendTyping,
    connected: realTime.connected
  };
};
