/**
 * Community Page Component
 * Main community hub with discussions, stats, and navigation
 */

import React, { useState, useEffect } from 'react';
import { 
  Discussion, 
  DiscussionFilter, 
  CommunityStats, 
  User,
  DiscussionCategory 
} from '../types/CommunityTypes';
import { communityService } from '../services/CommunityService';
import DiscussionList from './DiscussionList';
import CommunityStatsPanel from './CommunityStatsPanel';
import CreateDiscussionModal from './CreateDiscussionModal';
import UserProfilePanel from './UserProfilePanel';

const CommunityPage: React.FC = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<DiscussionFilter>({ sortBy: 'newest' });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Initialize demo data if needed
    communityService.initializeDemoData();
    
    // Load initial data
    loadDiscussions();
    loadStats();
    setCurrentUser(communityService.getCurrentUser());
  }, []);

  useEffect(() => {
    loadDiscussions();
  }, [filter]);

  const loadDiscussions = () => {
    const filteredDiscussions = communityService.getDiscussions(filter);
    setDiscussions(filteredDiscussions);
  };

  const loadStats = () => {
    const communityStats = communityService.getCommunityStats();
    setStats(communityStats);
  };

  const handleCreateDiscussion = (discussionData: any) => {
    if (currentUser) {
      const newDiscussion = communityService.createDiscussion({
        ...discussionData,
        author: currentUser
      });
      loadDiscussions();
      loadStats();
      setIsCreateModalOpen(false);
    }
  };

  const handleFilterChange = (newFilter: Partial<DiscussionFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    handleFilterChange({ searchQuery: query });
  };

  const categories: DiscussionCategory[] = [
    {
      id: 'general',
      name: 'General Discussion',
      description: 'General topics and announcements',
      color: '#3B82F6',
      icon: '💬',
      moderators: [],
      isPrivate: false,
      requireApproval: false
    },
    {
      id: 'development',
      name: 'Development',
      description: 'Code discussions and technical help',
      color: '#10B981',
      icon: '⚡',
      moderators: [],
      isPrivate: false,
      requireApproval: false
    },
    {
      id: 'architecture',
      name: 'Architecture',
      description: 'System design and architecture discussions',
      color: '#8B5CF6',
      icon: '🏗️',
      moderators: [],
      isPrivate: false,
      requireApproval: false
    },
    {
      id: 'debugging',
      name: 'Debugging',
      description: 'Help with debugging and troubleshooting',
      color: '#F59E0B',
      icon: '🐛',
      moderators: [],
      isPrivate: false,
      requireApproval: false
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Community Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                🌟 Community Hub
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Connect, discuss, and learn with the Chromium development community
              </p>
            </div>
            
            <div className="mt-4 lg:mt-0 flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search discussions..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-64 px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Create Discussion Button */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Discussion
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Community Stats */}
            {stats && <CommunityStatsPanel stats={stats} />}

            {/* User Profile */}
            {currentUser && <UserProfilePanel user={currentUser} />}

            {/* Category Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Categories
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    handleFilterChange({ category: undefined });
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  📋 All Discussions
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      handleFilterChange({ category: category.id });
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-2">{category.icon}</span>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Filter Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sort by:
                  </span>
                  <select
                    value={filter.sortBy}
                    onChange={(e) => handleFilterChange({ sortBy: e.target.value as DiscussionFilter['sortBy'] })}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="popular">Most Popular</option>
                    <option value="activity">Latest Activity</option>
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={filter.isPinned === true}
                      onChange={(e) => handleFilterChange({ 
                        isPinned: e.target.checked ? true : undefined 
                      })}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    Pinned Only
                  </label>
                  
                  <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={filter.hasReplies === true}
                      onChange={(e) => handleFilterChange({ 
                        hasReplies: e.target.checked ? true : undefined 
                      })}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    Has Replies
                  </label>
                </div>
              </div>
            </div>

            {/* Discussions List */}
            <DiscussionList 
              discussions={discussions} 
              onDiscussionUpdate={loadDiscussions}
              currentUser={currentUser}
            />
          </div>
        </div>
      </div>

      {/* Create Discussion Modal */}
      {isCreateModalOpen && (
        <CreateDiscussionModal
          categories={categories}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateDiscussion}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default CommunityPage;
