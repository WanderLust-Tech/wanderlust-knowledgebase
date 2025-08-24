/**
 * Analytics Dashboard Component
 * Comprehensive analytics visualization for user behavior, learning patterns, and platform insights
 */

import React, { useState, useEffect, useMemo } from 'react';
import { analyticsService } from '../services/AdvancedAnalyticsService';
import {
  UserBehaviorAnalytics,
  PlatformAnalytics,
  LearningProgressAnalytics,
  EngagementMetrics
} from '../types/AnalyticsTypes';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: string;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, trend, icon, color }) => {
  const getTrendIcon = () => {
    if (!trend || trend === 'stable') return '→';
    return trend === 'up' ? '↗️' : '↘️';
  };

  const getTrendColor = () => {
    if (!trend || trend === 'stable') return 'text-gray-500';
    return trend === 'up' ? 'text-green-500' : 'text-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </h3>
          <div className="flex items-end space-x-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </span>
            {change !== undefined && (
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {getTrendIcon()} {Math.abs(change).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
};

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, max, color, showPercentage = true }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {showPercentage && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: color
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>{value}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

const AnalyticsDashboard: React.FC = () => {
  const [userAnalytics, setUserAnalytics] = useState<UserBehaviorAnalytics | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<PlatformAnalytics | null>(null);
  const [realTimeStats, setRealTimeStats] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [predictions, setPredictions] = useState<any>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
    
    // Set up real-time updates
    const interval = setInterval(loadRealTimeData, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [selectedTimeframe]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Load all analytics data
      const userAnalyticsData = analyticsService.getUserAnalytics();
      const platformAnalyticsData = analyticsService.getPlatformAnalytics();
      const insightsData = analyticsService.getPersonalizedInsights();
      const predictionsData = analyticsService.predictUserBehavior();
      
      setUserAnalytics(userAnalyticsData);
      setPlatformAnalytics(platformAnalyticsData);
      setInsights(insightsData);
      setPredictions(predictionsData);
      
      loadRealTimeData();
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealTimeData = () => {
    const realTimeData = analyticsService.getRealTimeStats();
    setRealTimeStats(realTimeData);
  };

  const formatDuration = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const timeframeOptions = [
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 3 Months' }
  ];

  const learningMetrics = useMemo(() => {
    if (!userAnalytics) return null;
    
    const { learningProgress } = userAnalytics;
    return [
      {
        title: 'Articles Read',
        value: learningProgress.articlesRead,
        change: 12.5,
        trend: 'up' as const,
        icon: '📚',
        color: '#3B82F6'
      },
      {
        title: 'Tutorials Completed',
        value: learningProgress.tutorialsCompleted,
        change: 8.3,
        trend: 'up' as const,
        icon: '🎯',
        color: '#10B981'
      },
      {
        title: 'Videos Watched',
        value: learningProgress.videosWatched,
        change: -2.1,
        trend: 'down' as const,
        icon: '🎥',
        color: '#8B5CF6'
      },
      {
        title: 'Learning Streak',
        value: `${learningProgress.streakDays} days`,
        change: 25.0,
        trend: 'up' as const,
        icon: '🔥',
        color: '#F59E0B'
      }
    ];
  }, [userAnalytics]);

  const engagementMetrics = useMemo(() => {
    if (!userAnalytics) return null;
    
    const { engagementMetrics: engagement } = userAnalytics;
    return [
      {
        title: 'Engagement Score',
        value: engagement.engagementScore,
        change: 5.7,
        trend: 'up' as const,
        icon: '⭐',
        color: '#EF4444'
      },
      {
        title: 'Community Reputation',
        value: formatNumber(engagement.communityReputation),
        change: 15.2,
        trend: 'up' as const,
        icon: '🏆',
        color: '#F97316'
      },
      {
        title: 'Discussions Created',
        value: engagement.discussionsCreated,
        change: 0,
        trend: 'stable' as const,
        icon: '💬',
        color: '#06B6D4'
      },
      {
        title: 'Comments Posted',
        value: engagement.commentsPosted,
        change: 33.3,
        trend: 'up' as const,
        icon: '💭',
        color: '#84CC16'
      }
    ];
  }, [userAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                📊 Analytics Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Deep insights into your learning journey and platform engagement
              </p>
            </div>
            
            <div className="mt-4 lg:mt-0">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {timeframeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Real-time Stats */}
        {realTimeStats && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Current Session
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Session Duration"
                value={formatDuration(realTimeStats.currentSessionDuration)}
                icon="⏱️"
                color="#3B82F6"
              />
              <MetricCard
                title="Pages Viewed"
                value={realTimeStats.pagesViewedThisSession}
                icon="📄"
                color="#10B981"
              />
              <MetricCard
                title="Actions Taken"
                value={realTimeStats.actionsThisSession}
                icon="🎯"
                color="#8B5CF6"
              />
              <MetricCard
                title="Engagement Level"
                value={`${realTimeStats.engagementLevel}%`}
                icon="📈"
                color="#F59E0B"
              />
            </div>
          </div>
        )}

        {/* Learning Progress Metrics */}
        {learningMetrics && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Learning Progress
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {learningMetrics.map((metric, index) => (
                <MetricCard key={index} {...metric} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Learning Analytics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Completion Rates */}
            {userAnalytics && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Completion Rates
                </h3>
                <div className="space-y-4">
                  <ProgressBar
                    label="Tutorial Completion Rate"
                    value={userAnalytics.learningProgress.tutorialsCompleted}
                    max={userAnalytics.learningProgress.tutorialsStarted}
                    color="#10B981"
                  />
                  <ProgressBar
                    label="Reading Progress"
                    value={userAnalytics.learningProgress.articlesRead}
                    max={50} // Assuming 50 total articles
                    color="#3B82F6"
                  />
                  <ProgressBar
                    label="Video Progress"
                    value={userAnalytics.learningProgress.videosWatched}
                    max={20} // Assuming 20 total videos
                    color="#8B5CF6"
                  />
                </div>
              </div>
            )}

            {/* Topic Mastery */}
            {insights && insights.strongAreas && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Topic Mastery
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-green-600 dark:text-green-400">🎯</span>
                      <span className="font-medium text-gray-900 dark:text-white">Strong Areas</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {insights.strongAreas.map((area: string, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-full"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-yellow-600 dark:text-yellow-400">📈</span>
                      <span className="font-medium text-gray-900 dark:text-white">Improvement Areas</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {insights.improvementAreas.map((area: string, index: number) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded-full"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Engagement & Insights */}
          <div className="space-y-6">
            {/* Engagement Metrics */}
            {engagementMetrics && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Engagement Overview
                </h3>
                <div className="space-y-4">
                  {engagementMetrics.slice(0, 2).map((metric, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{metric.icon}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {metric.title}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Predictions */}
            {predictions && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  AI Predictions
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Next Action
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                      {predictions.nextAction}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      Optimal Learning Time
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                      {predictions.optimalLearningTime}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Completion Probability
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                      {Math.round(predictions.completionProbability * 100)}% likely to complete current path
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                  📋 Export Learning Report
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                  🎯 Set Learning Goals
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">
                  🔔 Configure Notifications
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors">
                  📊 Detailed Analytics
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
