import React, { useState } from 'react';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import { CommunityUpdate } from '../services/RealTimeService';

interface RealTimeNotificationsProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
}

const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({
  position = 'top-right',
  maxNotifications = 5
}) => {
  const realTime = useRealTimeNotifications();
  const [isExpanded, setIsExpanded] = useState(false);

  const getPositionClasses = () => {
    const baseClasses = 'fixed z-50';
    switch (position) {
      case 'top-right':
        return `${baseClasses} top-4 right-4`;
      case 'top-left':
        return `${baseClasses} top-4 left-4`;
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`;
      default:
        return `${baseClasses} top-4 right-4`;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_post':
        return '📝';
      case 'new_comment':
        return '💬';
      case 'new_reaction':
        return '👍';
      case 'user_mention':
        return '@';
      case 'system_notification':
        return '🔔';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_post':
        return 'bg-blue-500';
      case 'new_comment':
        return 'bg-green-500';
      case 'new_reaction':
        return 'bg-yellow-500';
      case 'user_mention':
        return 'bg-purple-500';
      case 'system_notification':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatNotificationText = (notification: CommunityUpdate) => {
    switch (notification.type) {
      case 'new_post':
        return `${notification.author} created a new post: "${notification.title}"`;
      case 'new_comment':
        return `${notification.author} commented on a post`;
      case 'new_reaction':
        return `${notification.author} reacted with ${notification.reactionType}`;
      case 'user_mention':
        return `You were mentioned in a discussion`;
      case 'system_notification':
        return notification.message || 'System notification';
      default:
        return 'New activity';
    }
  };

  const visibleNotifications = realTime.notifications.slice(0, maxNotifications);

  if (!realTime.connected) {
    return (
      <div className={getPositionClasses()}>
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              Connecting to real-time updates...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={getPositionClasses()}>
      {/* Connection Status & Stats */}
      <div className="mb-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Live
              </span>
              {realTime.onlineUsers > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {realTime.onlineUsers} online
                </span>
              )}
            </div>
            
            {realTime.unreadCount > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-medium">
                  {realTime.unreadCount}
                </span>
                <span>{isExpanded ? '▼' : '▶'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {isExpanded && visibleNotifications.length > 0 && (
        <div className="space-y-2 max-w-sm">
          {visibleNotifications.map((notification, index) => (
            <div
              key={`${notification.type}-${notification.timestamp}-${index}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 animate-in slide-in-from-right duration-300"
            >
              <div className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full ${getNotificationColor(notification.type)} flex items-center justify-center text-white text-sm`}>
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatNotificationText(notification)}
                  </p>
                  
                  {notification.content && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    // Remove this notification
                    // You can implement this in the hook if needed
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          
          {realTime.notifications.length > maxNotifications && (
            <div className="text-center">
              <button
                onClick={realTime.clearNotifications}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Typing Indicators */}
      {realTime.typingUsers.length > 0 && (
        <div className="mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {realTime.typingUsers.length === 1
                ? `${realTime.typingUsers[0].username} is typing...`
                : `${realTime.typingUsers.length} people are typing...`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeNotifications;
