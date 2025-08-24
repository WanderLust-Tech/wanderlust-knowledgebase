/**
 * User Profile Panel Component
 * Displays user information, badges, and quick stats
 */

import React from 'react';
import { User } from '../types/CommunityTypes';

interface UserProfilePanelProps {
  user: User;
}

const UserProfilePanel: React.FC<UserProfilePanelProps> = ({ user }) => {
  const formatJoinDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
  };

  const getRoleColor = (role: User['role']): string => {
    const colors = {
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      moderator: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      contributor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      member: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colors[role];
  };

  const getRoleIcon = (role: User['role']): string => {
    const icons = {
      admin: '🛡️',
      moderator: '⭐',
      contributor: '💎',
      member: '👤'
    };
    return icons[role];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="text-center">
        {/* Avatar */}
        <div className="relative mx-auto mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {user.displayName.substring(0, 2).toUpperCase()}
          </div>
          {user.role !== 'member' && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
              <span className="text-sm" title={user.role}>
                {getRoleIcon(user.role)}
              </span>
            </div>
          )}
        </div>

        {/* User Info */}
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          {user.displayName}
        </h3>
        
        <div className="flex items-center justify-center mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
            {getRoleIcon(user.role)} {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Member since {formatJoinDate(user.joinDate)}
        </p>

        {/* Reputation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {user.reputation}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Reputation Points
          </div>
        </div>

        {/* Badges */}
        {user.badges.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Recent Badges
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {user.badges.slice(0, 3).map((badge) => (
                <div
                  key={badge.id}
                  className="group relative"
                  title={`${badge.name}: ${badge.description}`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2"
                    style={{ 
                      backgroundColor: `${badge.color}20`,
                      borderColor: badge.color
                    }}
                  >
                    {badge.icon}
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {badge.name}
                  </div>
                </div>
              ))}
              {user.badges.length > 3 && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-gray-300 dark:border-gray-600">
                  +{user.badges.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <button className="w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
            View Profile
          </button>
          
          <button className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            Edit Profile
          </button>
        </div>

        {/* Stats Preview */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                0
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Discussions
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                0
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Comments
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePanel;
