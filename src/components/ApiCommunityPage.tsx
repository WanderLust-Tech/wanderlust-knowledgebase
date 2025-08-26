/**
 * API-Enabled Community Page Component
 * Demonstrates using the new API-based community service
 */

import React, { useState, useEffect } from 'react';
import { simpleCommunityService, SimpleCommunityPost, CommunityStats } from '../services/simpleCommunityService';

interface User {
  username: string;
  displayName: string;
  avatar?: string;
}

const ApiCommunityPage: React.FC = () => {
  const [posts, setPosts] = useState<SimpleCommunityPost[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    type: 'discussion'
  });

  useEffect(() => {
    loadData();
    setCurrentUser(simpleCommunityService.getCurrentUser());
    
    // Migrate legacy data on first load
    simpleCommunityService.migrateFromLegacyService();
  }, []);

  useEffect(() => {
    if (selectedType === 'all') {
      loadAllPosts();
    } else {
      loadPostsByType(selectedType);
    }
  }, [selectedType]);

  const loadData = async () => {
    await Promise.all([loadAllPosts(), loadStats()]);
  };

  const loadAllPosts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allPosts = await simpleCommunityService.getPosts();
      setPosts(allPosts);
    } catch (error) {
      setError('Failed to load posts. Please try again.');
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPostsByType = async (type: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const typedPosts = await simpleCommunityService.getPostsByType(type);
      setPosts(typedPosts);
    } catch (error) {
      setError('Failed to load posts. Please try again.');
      console.error('Error loading posts by type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const communityStats = await simpleCommunityService.getStats();
      setStats(communityStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('Please log in to create a post.');
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      setError('Please fill in both title and content.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const postData = {
        title: newPost.title,
        content: newPost.content,
        type: newPost.type,
        authorName: currentUser.displayName,
        authorAvatar: currentUser.avatar || ''
      };

      await simpleCommunityService.createPost(postData);
      
      // Reset form
      setNewPost({ title: '', content: '', type: 'discussion' });
      
      // Reload data
      await loadData();
      
      console.log('✅ Post created successfully!');
    } catch (error) {
      setError('Failed to create post. It has been saved locally and will sync when online.');
      console.error('Error creating post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setIsLoading(true);
    try {
      await simpleCommunityService.deletePost(id);
      await loadData();
      console.log('✅ Post deleted successfully!');
    } catch (error) {
      setError('Failed to delete post.');
      console.error('Error deleting post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🌟 API-Enabled Community
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            This demonstrates the new API-based community service that replaces localStorage with backend integration.
          </p>
          
          {/* API Status Indicator */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-600 dark:text-green-400">API Integration Active</span>
            </div>
            {!navigator.onLine && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-orange-600 dark:text-orange-400">Offline Mode</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center">
              <span className="text-xl mr-2">⚠️</span>
              {error}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-2">
              {['all', 'discussion', 'question', 'announcement', 'tutorial'].map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Create Post Form */}
            {currentUser && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create New Post
                </h3>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Post title..."
                      value={newPost.title}
                      onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <textarea
                      placeholder="What's on your mind?"
                      value={newPost.content}
                      onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <select
                      value={newPost.type}
                      onChange={(e) => setNewPost(prev => ({ ...prev, type: e.target.value }))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    >
                      <option value="discussion">Discussion</option>
                      <option value="question">Question</option>
                      <option value="tutorial">Tutorial</option>
                      <option value="announcement">Announcement</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isLoading || !newPost.title.trim() || !newPost.content.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Creating...' : 'Create Post'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Posts List */}
            <div className="space-y-4">
              {isLoading && posts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading posts...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    No posts found. {currentUser ? 'Create the first post!' : 'Log in to create a post.'}
                  </p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={post.authorAvatar || '/default-avatar.png'}
                          alt={post.authorName}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {post.authorName}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                          {post.type}
                        </span>
                        {post.id.startsWith('local_') && (
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs rounded-full">
                            Local
                          </span>
                        )}
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          disabled={isLoading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* User Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Current User
              </h3>
              {currentUser ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={currentUser.avatar || '/default-avatar.png'}
                    alt={currentUser.displayName}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {currentUser.displayName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      @{currentUser.username}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  Please log in to participate in discussions.
                </p>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Community Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Posts:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {stats.totalPosts}
                    </span>
                  </div>
                  
                  {stats.recentPosts.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        Recent Activity
                      </h4>
                      <div className="space-y-2">
                        {stats.recentPosts.slice(0, 3).map(post => (
                          <div key={post.id} className="text-sm">
                            <p className="text-gray-900 dark:text-white font-medium truncate">
                              {post.title}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-xs">
                              by {post.authorName}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiCommunityPage;
