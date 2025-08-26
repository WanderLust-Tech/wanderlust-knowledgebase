import React, { useState, useEffect } from 'react';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import LiveUserActivity from './LiveUserActivity';
import TypingIndicator from './TypingIndicator';

const RealTimeDemoPage: React.FC = () => {
  const realTime = useRealTimeNotifications();
  const [selectedPost, setSelectedPost] = useState<string>('demo-post-1');
  const [userStatus, setUserStatus] = useState<string>('online');
  const [currentActivity, setCurrentActivity] = useState<string>('');

  useEffect(() => {
    // Set initial user status when component mounts
    realTime.updateUserStatus(userStatus, 'Viewing real-time demo');
  }, []);

  const handleStatusChange = async (newStatus: string) => {
    setUserStatus(newStatus);
    await realTime.updateUserStatus(newStatus, currentActivity || 'Viewing real-time demo');
  };

  const handleActivityChange = async (activity: string) => {
    setCurrentActivity(activity);
    await realTime.updateUserStatus(userStatus, activity);
  };

  const simulateNewPost = () => {
    // This would normally be done through the API
    console.log('Simulating new post creation...');
  };

  const simulateNewComment = () => {
    // This would normally be done through the API
    console.log('Simulating new comment...');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Real-Time Features Demo
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Experience live community updates, typing indicators, and user activity.
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${realTime.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium text-gray-900 dark:text-white">
              {realTime.connected ? 'Connected to real-time updates' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Online Users: {realTime.onlineUsers}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Unread: {realTime.unreadCount}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Status Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Your Status
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={userStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="online">🟢 Online</option>
                  <option value="away">🟡 Away</option>
                  <option value="busy">🔴 Busy</option>
                  <option value="offline">⚪ Offline</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Activity
                </label>
                <input
                  type="text"
                  value={currentActivity}
                  onChange={(e) => handleActivityChange(e.target.value)}
                  placeholder="What are you doing?"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Demo Post with Typing Indicator */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Demo Discussion Post
            </h2>
            
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Welcome to Real-Time Features! 🚀
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                This is a demo post to showcase real-time typing indicators and live updates. 
                Try typing in the comment box below to see the typing indicator in action!
              </p>
              <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>👤 Demo User</span>
                <span>•</span>
                <span>📅 {new Date().toLocaleDateString()}</span>
                <span>•</span>
                <span>🏷️ Demo</span>
              </div>
            </div>

            {/* Typing Indicator Component */}
            <TypingIndicator 
              postId={selectedPost}
              onTyping={(isTyping) => {
                console.log('User typing:', isTyping);
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Test Real-Time Updates
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={simulateNewPost}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                📝 Simulate New Post
              </button>
              
              <button
                onClick={simulateNewComment}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                💬 Simulate New Comment
              </button>
              
              <button
                onClick={() => realTime.clearNotifications()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                🧹 Clear Notifications
              </button>
              
              <button
                onClick={() => realTime.markAsRead()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                ✅ Mark as Read
              </button>
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recent Notifications
            </h2>
            
            {realTime.notifications.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No notifications yet. Real-time updates will appear here!
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {realTime.notifications.slice(0, 10).map((notification, index) => (
                  <div
                    key={`${notification.type}-${notification.timestamp}-${index}`}
                    className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">
                        {notification.type === 'new_post' ? '📝' :
                         notification.type === 'new_comment' ? '💬' :
                         notification.type === 'new_reaction' ? '👍' : '📢'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.type.replace('_', ' ').toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {notification.author && `By ${notification.author} • `}
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar with Live Activity */}
        <div className="lg:col-span-1">
          <LiveUserActivity showDetailed={true} maxUsers={10} />
        </div>
      </div>
    </div>
  );
};

export default RealTimeDemoPage;
