import React, { useState } from 'react';
import { useProgress } from '../contexts/ProgressContext';

export const ProgressDashboard: React.FC = () => {
  const {
    readingProgress,
    learningPaths,
    stats,
    getWeeklyProgress,
    getCategoryProgress,
    getRecommendedArticles,
    exportProgress,
    importProgress,
    clearAllProgress,
  } = useProgress();

  const [showExportModal, setShowExportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'articles' | 'paths' | 'analytics'>('overview');

  const weeklyProgress = getWeeklyProgress();
  const categoryProgress = getCategoryProgress();
  const recommendedArticles = getRecommendedArticles();

  const handleExport = () => {
    const data = exportProgress();
    navigator.clipboard.writeText(data);
    setShowExportModal(false);
    alert('Progress data copied to clipboard!');
  };

  const handleImport = () => {
    try {
      importProgress(importData);
      setImportData('');
      alert('Progress data imported successfully!');
    } catch (error) {
      alert('Error importing data: ' + (error as Error).message);
    }
  };

  const formatTime = (minutes: number): string => {
    if (isNaN(minutes) || minutes < 0) return '0m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatNumber = (num: number): string => {
    return isNaN(num) ? '0' : num.toString();
  };

  const formatPercentage = (num: number): string => {
    return isNaN(num) ? '0' : Math.round(num).toString();
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Learning Progress</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your journey through the Chromium knowledge base
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export Data
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            onClick={() => {
              if (confirm('Are you sure you want to clear all progress? This cannot be undone.')) {
                clearAllProgress();
              }
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'articles', label: 'Articles', icon: '📚' },
            { id: 'paths', label: 'Learning Paths', icon: '🛤️' },
            { id: 'analytics', label: 'Analytics', icon: '📈' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <span className="text-2xl">📖</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Articles Read</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats.totalArticlesRead)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <span className="text-2xl">⏱️</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Time Spent</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(stats.totalTimeSpent)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <span className="text-2xl">🔥</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Streak</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats.currentStreak)} days</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Progress</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatPercentage(stats.totalProgress)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Progress</h3>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${formatPercentage(stats.totalProgress)}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {formatNumber(stats.totalArticlesRead)} articles completed • {formatNumber(stats.categoriesExplored.length)} categories explored
            </p>
          </div>

          {/* Recommended Articles */}
          {recommendedArticles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Continue Reading</h3>
              <div className="space-y-3">
                {recommendedArticles.slice(0, 3).map(articlePath => {
                  const progress = readingProgress.find(p => p.path === articlePath);
                  return (
                    <div key={articlePath} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {progress?.title || articlePath.split('/').pop()?.replace(/-/g, ' ')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{progress?.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {progress?.progress || 0}% complete
                        </p>
                        <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${progress?.progress || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Articles Tab */}
      {activeTab === 'articles' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reading History</h3>
            <div className="space-y-3">
              {readingProgress
                .sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime())
                .map(article => (
                  <div key={article.path} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {article.completed ? '✅' : article.progress > 50 ? '📖' : '📄'}
                        </span>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{article.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {article.category} • Last read {formatDate(new Date(article.lastVisited))}
                            {article.timeSpent > 0 && ` • ${formatTime(article.timeSpent)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {article.progress}% complete
                      </p>
                      <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                        <div 
                          className={`h-2 rounded-full ${
                            article.completed ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${article.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            
            {readingProgress.length === 0 && (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📚</span>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No reading history yet</h3>
                <p className="text-gray-600 dark:text-gray-400">Start exploring articles to track your progress!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Learning Paths Tab */}
      {activeTab === 'paths' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Learning Paths</h3>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Create New Path
            </button>
          </div>
          
          <div className="grid gap-4">
            {learningPaths.map(path => (
              <div key={path.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">{path.title}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        path.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        path.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {path.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{path.description}</p>
                    <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                      <span>{path.completedArticles.length}/{path.articles.length} articles</span>
                      <span>{formatTime(path.estimatedTotalTime)} estimated</span>
                      <span>Last accessed {formatDate(new Date(path.lastAccessed))}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {Math.round(path.progress)}%
                    </p>
                    <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-3 mt-2">
                      <div 
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: `${path.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {learningPaths.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-6xl mb-4 block">🛤️</span>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No learning paths yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Create structured learning paths to guide your study!</p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Create Your First Path
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Weekly Progress Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Activity</h3>
            <div className="space-y-3">
              {weeklyProgress.map(day => (
                <div key={day.date} className="flex items-center space-x-4">
                  <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(new Date(day.date))}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (day.articlesRead / 5) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {day.articlesRead} articles • {formatTime(day.timeSpent)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Progress */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Progress by Category</h3>
            <div className="space-y-4">
              {categoryProgress.map(category => (
                <div key={category.category} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {category.category.replace(/-/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {Math.round(category.progress)}% • {formatTime(category.timeSpent)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
                      style={{ width: `${category.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Progress Data</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your progress data will be copied to clipboard as JSON.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleExport}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
