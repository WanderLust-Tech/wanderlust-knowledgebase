/**
 * Community Stats Panel Component
 * Displays community statistics and activity overview
 */

import React from 'react';
import { CommunityStats } from '../types/CommunityTypes';

interface CommunityStatsPanelProps {
  stats: CommunityStats;
}

const CommunityStatsPanel: React.FC<CommunityStatsPanelProps> = ({ stats }) => {
  const calculateGrowth = (current: number, previous: number): { value: number; isPositive: boolean } => {
    if (previous === 0) return { value: 0, isPositive: true };
    const growth = ((current - previous) / previous) * 100;
    return { value: Math.abs(growth), isPositive: growth >= 0 };
  };

  const userGrowth = calculateGrowth(stats.weeklyStats.newUsers, stats.weeklyStats.previousWeek.newUsers);
  const discussionGrowth = calculateGrowth(stats.weeklyStats.newDiscussions, stats.weeklyStats.previousWeek.newDiscussions);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
        <span className="mr-2">📊</span>
        Community Stats
      </h3>
      
      {/* Key Metrics */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalUsers}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Total Users
            </div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.activeUsers}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Active Users
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.totalDiscussions}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Discussions
            </div>
          </div>
          
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.totalComments}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Comments
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Growth */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          This Week
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">New Users</span>
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-900 dark:text-white">
                {stats.weeklyStats.newUsers}
              </span>
              <span className={`text-xs ${userGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {userGrowth.isPositive ? '↑' : '↓'} {userGrowth.value.toFixed(0)}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">New Discussions</span>
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-900 dark:text-white">
                {stats.weeklyStats.newDiscussions}
              </span>
              <span className={`text-xs ${discussionGrowth.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {discussionGrowth.isPositive ? '↑' : '↓'} {discussionGrowth.value.toFixed(0)}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">New Comments</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {stats.weeklyStats.newComments}
            </span>
          </div>
        </div>
      </div>

      {/* Popular Tags */}
      {stats.popularTags.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Popular Tags
          </h4>
          <div className="space-y-2">
            {stats.popularTags.slice(0, 5).map((tag) => (
              <div key={tag.tag} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  #{tag.tag}
                </span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {tag.count}
                  </span>
                  <span className={`text-xs ${
                    tag.trend === 'up' ? 'text-green-600' : 
                    tag.trend === 'down' ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {tag.trend === 'up' ? '↗' : tag.trend === 'down' ? '↘' : '→'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats.recentActivity.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Recent Activity
          </h4>
          <div className="space-y-3">
            {stats.recentActivity.slice(0, 3).map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  {activity.user.displayName.substring(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {activity.user.displayName}
                    </span>{' '}
                    {activity.title.toLowerCase()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Contributors */}
      {stats.topContributors.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Top Contributors
          </h4>
          <div className="space-y-3">
            {stats.topContributors.slice(0, 3).map((contributor, index) => (
              <div key={contributor.user.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {contributor.user.displayName.substring(0, 1).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contributor.user.displayName}
                    </p>
                    {index === 0 && <span className="text-yellow-500">🏆</span>}
                    {index === 1 && <span className="text-gray-400">🥈</span>}
                    {index === 2 && <span className="text-orange-500">🥉</span>}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{contributor.discussionsCreated} discussions</span>
                    <span>•</span>
                    <span>{contributor.commentsPosted} comments</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {contributor.contributionScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityStatsPanel;
