/**
 * AI Content Suggestions Page
 * Main page for AI-powered content recommendations, intelligent suggestions,
 * content analysis, and personalized learning recommendations
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AIContentSuggestions from '../components/AIContentSuggestions';
import { useAIContentSuggestions } from '../hooks/useAIContentSuggestions';
import { ContentSuggestion } from '../types/AIContentTypes';

const AIContentSuggestionsPage: React.FC = () => {
  const { contentPath } = useParams<{ contentPath?: string }>();
  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState<'suggestions' | 'analytics' | 'personalization'>('suggestions');
  const [selectedContentPath, setSelectedContentPath] = useState<string>('');

  // Use AI content suggestions hook
  const {
    suggestions,
    personalizedSuggestions,
    trendingSuggestions,
    contentAnalysis,
    isLoading,
    error,
    refreshSuggestions,
    getSuggestionAnalytics,
    getPersonalizationInsights,
    getContentHealth,
    getUserInsights,
    userProfile,
    implementSuggestion,
    provideFeedback
  } = useAIContentSuggestions({
    contentPath: contentPath ? decodeURIComponent(contentPath) : selectedContentPath,
    userId: 'user-1',
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutes
    enablePersonalization: true,
    enableTrending: true,
    maxSuggestions: 20,
    categories: [],
    onSuggestionGenerated: (suggestion) => {
      console.log('New AI suggestion generated:', suggestion.title);
    },
    onAnalysisComplete: (analysis) => {
      console.log('Content analysis complete:', analysis.contentPath);
    }
  });

  const [analytics, setAnalytics] = useState<any>(null);
  const [personalizationInsights, setPersonalizationInsights] = useState<any>(null);
  const [contentHealth, setContentHealth] = useState<any>(null);
  const [userInsights, setUserInsights] = useState<any>(null);

  useEffect(() => {
    if (selectedView === 'analytics') {
      const analyticsData = getSuggestionAnalytics();
      const healthData = getContentHealth();
      setAnalytics(analyticsData);
      setContentHealth(healthData);
    } else if (selectedView === 'personalization') {
      const insights = getPersonalizationInsights();
      const userInsightsData = getUserInsights();
      setPersonalizationInsights(insights);
      setUserInsights(userInsightsData);
    }
  }, [selectedView, getSuggestionAnalytics, getContentHealth, getPersonalizationInsights, getUserInsights]);

  const handleSuggestionImplement = async (suggestion: ContentSuggestion) => {
    const success = await implementSuggestion(suggestion.id);
    if (success) {
      console.log('Suggestion implemented successfully:', suggestion.title);
    }
  };

  const handleSuggestionFeedback = async (suggestionId: string, feedback: any) => {
    const success = await provideFeedback(suggestionId, feedback);
    if (success) {
      console.log('Feedback provided for suggestion:', suggestionId);
    }
  };

  const handleContentPathChange = (path: string) => {
    setSelectedContentPath(path);
    if (path) {
      navigate(`/ai-suggestions/${encodeURIComponent(path)}`);
    }
  };

  if (isLoading && !suggestions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">AI is analyzing content and generating suggestions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🤖❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Service Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refreshSuggestions}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry AI Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/content')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to Content
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center">
                  <span className="mr-2">🤖</span>
                  AI Content Suggestions
                </h1>
                <p className="text-sm text-gray-500">
                  Intelligent recommendations powered by advanced AI models
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedContentPath}
                onChange={(e) => handleContentPathChange(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select content to analyze...</option>
                <option value="/content/architecture/overview.md">Architecture Overview</option>
                <option value="/content/architecture/process-model.md">Process Model</option>
                <option value="/content/security/sandbox-architecture.md">Sandbox Architecture</option>
                <option value="/content/modules/javascript-v8.md">JavaScript V8</option>
                <option value="/content/debugging/debugging-tools.md">Debugging Tools</option>
              </select>

              <button
                onClick={refreshSuggestions}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Analyzing...' : 'Refresh AI'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Status Banner */}
      {(suggestions.length > 0 || personalizedSuggestions || trendingSuggestions.length > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-800">AI Analysis Active</span>
                </div>
                <span className="text-sm text-blue-600">
                  {suggestions.length} content suggestions
                </span>
                <span className="text-sm text-purple-600">
                  {personalizedSuggestions?.suggestions.length || 0} personalized recommendations
                </span>
                <span className="text-sm text-orange-600">
                  {trendingSuggestions.length} trending opportunities
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {contentHealth && (
                  <div className="text-sm text-gray-600">
                    Content Health: 
                    <span className={`ml-1 font-medium ${
                      contentHealth.overallScore > 0.8 ? 'text-green-600' :
                      contentHealth.overallScore > 0.6 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {Math.round(contentHealth.overallScore * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {(['suggestions', 'analytics', 'personalization'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedView === view
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedView === 'suggestions' && (
          <div className="space-y-6">
            {/* Content Health Overview */}
            {contentHealth && (
              <ContentHealthDashboard contentHealth={contentHealth} />
            )}

            {/* AI Content Suggestions Component */}
            <AIContentSuggestions
              contentPath={contentPath ? decodeURIComponent(contentPath) : selectedContentPath}
              userId="user-1"
              showPersonalized={true}
              maxSuggestions={20}
              onSuggestionImplement={handleSuggestionImplement}
              onSuggestionFeedback={handleSuggestionFeedback}
            />
          </div>
        )}

        {selectedView === 'analytics' && (
          <AIAnalyticsDashboard 
            analytics={analytics} 
            contentHealth={contentHealth}
          />
        )}

        {selectedView === 'personalization' && (
          <PersonalizationDashboard 
            insights={personalizationInsights}
            userInsights={userInsights}
            userProfile={userProfile}
          />
        )}
      </div>
    </div>
  );
};

// Content Health Dashboard Component
interface ContentHealthDashboardProps {
  contentHealth: any;
}

const ContentHealthDashboard: React.FC<ContentHealthDashboardProps> = ({ contentHealth }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Health Overview</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600">
          {Math.round(contentHealth.overallScore * 100)}%
        </div>
        <div className="text-sm text-gray-600">Overall Score</div>
      </div>
      
      <div className="text-center">
        <div className="text-3xl font-bold text-green-600">
          {Math.round(contentHealth.completenessScore * 100)}%
        </div>
        <div className="text-sm text-gray-600">Completeness</div>
      </div>
      
      <div className="text-center">
        <div className="text-3xl font-bold text-purple-600">
          {Math.round(contentHealth.qualityScore * 100)}%
        </div>
        <div className="text-sm text-gray-600">Quality</div>
      </div>
      
      <div className="text-center">
        <div className="text-3xl font-bold text-orange-600">
          {Math.round(contentHealth.engagementPotential * 100)}%
        </div>
        <div className="text-sm text-gray-600">Engagement Potential</div>
      </div>
    </div>

    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Issues & Opportunities</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Critical Issues</span>
            <span className="font-medium text-red-600">{contentHealth.criticalIssues}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Improvement Opportunities</span>
            <span className="font-medium text-blue-600">{contentHealth.improvementOpportunities}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Content Trends</h4>
        <div className="space-y-1 text-sm">
          <div className="text-green-600">
            ↗ Improving: {contentHealth.trends.improving.length} areas
          </div>
          <div className="text-red-600">
            ↘ Declining: {contentHealth.trends.declining.length} areas
          </div>
          <div className="text-gray-600">
            → Stable: {contentHealth.trends.stable.length} areas
          </div>
        </div>
      </div>
    </div>
  </div>
);

// AI Analytics Dashboard Component
interface AIAnalyticsDashboardProps {
  analytics: any;
  contentHealth: any;
}

const AIAnalyticsDashboard: React.FC<AIAnalyticsDashboardProps> = ({ analytics, contentHealth }) => {
  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading AI analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">AI Suggestion Analytics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{analytics.totalSuggestions || 0}</div>
            <div className="text-sm text-gray-600">Total Suggestions</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{analytics.implementedCount || 0}</div>
            <div className="text-sm text-gray-600">Implemented</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {Math.round((analytics.implementationRate || 0) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Implementation Rate</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {analytics.averageRating?.toFixed(1) || '0.0'}
            </div>
            <div className="text-sm text-gray-600">Avg Rating</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Top Suggestion Categories</h4>
          <div className="space-y-3">
            {analytics.topCategories?.slice(0, 5).map(([category, count]: [string, number], index: number) => (
              <div key={category} className="flex justify-between">
                <span className="text-sm text-gray-600 capitalize">{category.replace('_', ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
            )) || <p className="text-gray-500 text-sm">No data available</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">AI Engine Performance</h4>
          <div className="space-y-3">
            {analytics.enginePerformance?.map((engine: any, index: number) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">{engine.name}</span>
                  <span className="text-sm text-gray-600">{Math.round(engine.performance.qualityScore * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 bg-blue-500 rounded-full" 
                    style={{ width: `${engine.performance.qualityScore * 100}%` }}
                  ></div>
                </div>
              </div>
            )) || <p className="text-gray-500 text-sm">No engine data available</p>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Content Impact Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              +{Math.round((analytics.contentImpact?.engagementIncrease || 0) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Engagement Increase</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              +{Math.round((analytics.contentImpact?.completionRateIncrease || 0) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Completion Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              +{Math.round((analytics.contentImpact?.userSatisfactionIncrease || 0) * 100)}%
            </div>
            <div className="text-sm text-gray-600">User Satisfaction</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Personalization Dashboard Component
interface PersonalizationDashboardProps {
  insights: any;
  userInsights: any;
  userProfile: any;
}

const PersonalizationDashboard: React.FC<PersonalizationDashboardProps> = ({ 
  insights, 
  userInsights, 
  userProfile 
}) => {
  if (!userProfile) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Loading personalization data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Learning Profile</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Experience Level</h4>
            <div className="text-2xl font-bold text-blue-600 capitalize">
              {userProfile.experienceLevel}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Learning Velocity</h4>
            <div className="text-2xl font-bold text-green-600">
              {userInsights?.learningVelocity?.toFixed(1) || '0.0'}/day
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Goal Progress</h4>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round((userProfile.goals?.[0]?.progress || 0) * 100)}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Skill Areas</h4>
          <div className="space-y-4">
            {userProfile.skillAreas?.slice(0, 5).map((skill: any, index: number) => (
              <div key={index}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                  <span className="text-sm text-gray-600">{skill.level}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 bg-blue-500 rounded-full" 
                    style={{ width: `${(skill.level / 10) * 100}%` }}
                  ></div>
                </div>
              </div>
            )) || <p className="text-gray-500 text-sm">No skill data available</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Learning Style</h4>
          <div className="space-y-3">
            {Object.entries(userProfile.learningStyle || {}).map(([style, value]: [string, any]) => (
              <div key={style} className="flex justify-between">
                <span className="text-sm text-gray-600 capitalize">{style}</span>
                <span className="font-medium">{Math.round(value * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Current Goals</h4>
        <div className="space-y-4">
          {userProfile.goals?.map((goal: any, index: number) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-medium text-gray-900">{goal.title}</h5>
                <span className="text-sm text-gray-500">
                  {Math.round(goal.progress * 100)}% complete
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 bg-green-500 rounded-full" 
                  style={{ width: `${goal.progress * 100}%` }}
                ></div>
              </div>
            </div>
          )) || <p className="text-gray-500">No active goals</p>}
        </div>
      </div>
    </div>
  );
};

export default AIContentSuggestionsPage;
