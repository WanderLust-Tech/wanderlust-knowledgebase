import React from 'react';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';

interface LiveUserActivityProps {
  showDetailed?: boolean;
  maxUsers?: number;
}

const LiveUserActivity: React.FC<LiveUserActivityProps> = ({
  showDetailed = false,
  maxUsers = 10
}) => {
  const realTime = useRealTimeNotifications();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  if (!realTime.connected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          User Activity
        </h3>
        <div className="flex items-center justify-center py-4">
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Connecting to live updates...
          </div>
        </div>
      </div>
    );
  }

  const visibleUsers = realTime.userActivity.slice(0, maxUsers);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Live Activity
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 dark:text-green-400">
              {realTime.onlineUsers} online
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {visibleUsers.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              No recent activity
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleUsers.map((user, index) => (
              <div
                key={`${user.userId}-${user.timestamp}`}
                className="flex items-center space-x-3 py-2"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(
                      user.status
                    )} rounded-full border-2 border-white dark:border-gray-800`}
                  ></div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.username}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.status === 'online'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : user.status === 'away'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : user.status === 'busy'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}
                    >
                      {getStatusText(user.status)}
                    </span>
                  </div>

                  {showDetailed && user.activity && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {user.activity}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(user.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {realTime.userActivity.length > maxUsers && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              And {realTime.userActivity.length - maxUsers} more users...
            </p>
          </div>
        )}

        {/* Real-time stats */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {realTime.notifications.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Recent Updates
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {realTime.typingUsers.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Typing Now
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveUserActivity;
