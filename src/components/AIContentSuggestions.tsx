/**
 * AI Content Suggestions Component
 * Interactive component for displaying AI-powered content recommendations,
 * content improvements, and intelligent suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ContentSuggestion, 
  SuggestionType, 
  SuggestionPriority,
  PersonalizedSuggestions 
} from '../types/AIContentTypes';
import { aiContentSuggestionsService } from '../services/AIContentSuggestionsService';

interface AIContentSuggestionsProps {
  contentPath?: string;
  userId?: string;
  showPersonalized?: boolean;
  maxSuggestions?: number;
  categories?: string[];
  onSuggestionImplement?: (suggestion: ContentSuggestion) => void;
  onSuggestionFeedback?: (suggestionId: string, feedback: any) => void;
}

const AIContentSuggestions: React.FC<AIContentSuggestionsProps> = ({
  contentPath,
  userId = 'user-1',
  showPersonalized = true,
  maxSuggestions = 10,
  categories = [],
  onSuggestionImplement,
  onSuggestionFeedback
}) => {
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState<PersonalizedSuggestions | null>(null);
  const [trendingSuggestions, setTrendingSuggestions] = useState<ContentSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'personalized' | 'trending'>('content');
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [implementingId, setImplementingId] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, [contentPath, userId]);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load content-specific suggestions
      if (contentPath) {
        const contentSuggestions = await aiContentSuggestionsService.generateContentSuggestions(contentPath);
        setSuggestions(contentSuggestions.slice(0, maxSuggestions));
      }

      // Load personalized suggestions
      if (showPersonalized && userId) {
        const personalizedData = await aiContentSuggestionsService.generatePersonalizedSuggestions(userId);
        setPersonalizedSuggestions(personalizedData);
      }

      // Load trending suggestions
      const trending = await aiContentSuggestionsService.getTrendingSuggestions();
      setTrendingSuggestions(trending);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [contentPath, userId, showPersonalized, maxSuggestions]);

  const handleImplementSuggestion = useCallback(async (suggestion: ContentSuggestion) => {
    if (!contentPath) return;

    setImplementingId(suggestion.id);
    try {
      const success = await aiContentSuggestionsService.implementSuggestion(suggestion.id, contentPath);
      if (success && onSuggestionImplement) {
        onSuggestionImplement(suggestion);
      }
      await loadSuggestions(); // Refresh suggestions
    } catch (error) {
      console.error('Failed to implement suggestion:', error);
    } finally {
      setImplementingId(null);
    }
  }, [contentPath, onSuggestionImplement, loadSuggestions]);

  const handleProvideFeedback = useCallback(async (
    suggestionId: string, 
    rating: number, 
    helpful: boolean, 
    comments: string
  ) => {
    if (!contentPath) return;

    try {
      const success = await aiContentSuggestionsService.provideSuggestionFeedback(
        suggestionId, 
        contentPath, 
        { rating, helpful, comments }
      );
      
      if (success && onSuggestionFeedback) {
        onSuggestionFeedback(suggestionId, { rating, helpful, comments });
      }
      
      await loadSuggestions(); // Refresh to show updated feedback
    } catch (error) {
      console.error('Failed to provide feedback:', error);
    }
  }, [contentPath, onSuggestionFeedback, loadSuggestions]);

  const getSuggestionIcon = (type: SuggestionType): string => {
    const icons: Record<SuggestionType, string> = {
      content_improvement: '✨',
      new_content: '📝',
      content_expansion: '📈',
      content_update: '🔄',
      content_reorganization: '🗂️',
      related_content: '🔗',
      missing_content: '❓',
      content_enhancement: '⭐',
      interactive_element: '🎮',
      video_suggestion: '🎥',
      tutorial_suggestion: '📚',
      example_code: '💻',
      diagram_suggestion: '📊',
      cross_reference: '🔀',
      glossary_term: '📖'
    };
    return icons[type] || '💡';
  };

  const getPriorityColor = (priority: SuggestionPriority): string => {
    const colors: Record<SuggestionPriority, string> = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[priority];
  };

  const getConfidenceBar = (confidence: number): JSX.Element => {
    const percentage = Math.round(confidence * 100);
    const color = confidence > 0.8 ? 'bg-green-500' : confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${color}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading AI suggestions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="text-center text-red-600">
          <p className="font-medium">Failed to load AI suggestions</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadSuggestions}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="mr-2">🤖</span>
            AI Content Suggestions
          </h3>
          <button
            onClick={loadSuggestions}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-4">
          {[
            { key: 'content', label: 'Content', count: suggestions.length },
            { key: 'personalized', label: 'Personalized', count: personalizedSuggestions?.suggestions.length || 0 },
            { key: 'trending', label: 'Trending', count: trendingSuggestions.length }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`px-3 py-1 text-sm font-medium rounded flex items-center space-x-2 ${
                activeTab === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{label}</span>
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'content' && (
          <ContentSuggestionsList
            suggestions={suggestions}
            expandedSuggestion={expandedSuggestion}
            implementingId={implementingId}
            onToggleExpand={setExpandedSuggestion}
            onImplement={handleImplementSuggestion}
            onFeedback={handleProvideFeedback}
            getSuggestionIcon={getSuggestionIcon}
            getPriorityColor={getPriorityColor}
            getConfidenceBar={getConfidenceBar}
          />
        )}

        {activeTab === 'personalized' && (
          <PersonalizedSuggestionsList
            personalizedSuggestions={personalizedSuggestions}
            expandedSuggestion={expandedSuggestion}
            onToggleExpand={setExpandedSuggestion}
          />
        )}

        {activeTab === 'trending' && (
          <TrendingSuggestionsList
            suggestions={trendingSuggestions}
            expandedSuggestion={expandedSuggestion}
            implementingId={implementingId}
            onToggleExpand={setExpandedSuggestion}
            onImplement={handleImplementSuggestion}
            onFeedback={handleProvideFeedback}
            getSuggestionIcon={getSuggestionIcon}
            getPriorityColor={getPriorityColor}
            getConfidenceBar={getConfidenceBar}
          />
        )}
      </div>
    </div>
  );
};

// Content Suggestions List Component
interface ContentSuggestionsListProps {
  suggestions: ContentSuggestion[];
  expandedSuggestion: string | null;
  implementingId: string | null;
  onToggleExpand: (id: string | null) => void;
  onImplement: (suggestion: ContentSuggestion) => void;
  onFeedback: (suggestionId: string, rating: number, helpful: boolean, comments: string) => void;
  getSuggestionIcon: (type: SuggestionType) => string;
  getPriorityColor: (priority: SuggestionPriority) => string;
  getConfidenceBar: (confidence: number) => JSX.Element;
}

const ContentSuggestionsList: React.FC<ContentSuggestionsListProps> = ({
  suggestions,
  expandedSuggestion,
  implementingId,
  onToggleExpand,
  onImplement,
  onFeedback,
  getSuggestionIcon,
  getPriorityColor,
  getConfidenceBar
}) => {
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No content suggestions available.</p>
        <p className="text-sm mt-2">AI is analyzing your content for improvement opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          isExpanded={expandedSuggestion === suggestion.id}
          isImplementing={implementingId === suggestion.id}
          onToggleExpand={() => onToggleExpand(
            expandedSuggestion === suggestion.id ? null : suggestion.id
          )}
          onImplement={() => onImplement(suggestion)}
          onFeedback={onFeedback}
          getSuggestionIcon={getSuggestionIcon}
          getPriorityColor={getPriorityColor}
          getConfidenceBar={getConfidenceBar}
        />
      ))}
    </div>
  );
};

// Personalized Suggestions List Component
interface PersonalizedSuggestionsListProps {
  personalizedSuggestions: PersonalizedSuggestions | null;
  expandedSuggestion: string | null;
  onToggleExpand: (id: string | null) => void;
}

const PersonalizedSuggestionsList: React.FC<PersonalizedSuggestionsListProps> = ({
  personalizedSuggestions,
  expandedSuggestion,
  onToggleExpand
}) => {
  if (!personalizedSuggestions) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Loading personalized suggestions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Learning Path */}
      {personalizedSuggestions.learningPath && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h4 className="font-medium text-blue-900 mb-2">Suggested Learning Path</h4>
          <p className="text-blue-800 text-sm">{personalizedSuggestions.learningPath.description}</p>
        </div>
      )}

      {/* Content Recommendations */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Content Recommendations</h4>
        <div className="space-y-3">
          {personalizedSuggestions.contentRecommendations.slice(0, 5).map((rec, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-gray-900">{rec.title}</h5>
                <span className="text-sm text-gray-500">
                  {Math.round(rec.relevanceScore * 100)}% match
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
              <p className="text-xs text-blue-600 mt-2">{rec.personalizedReason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Skill Gaps */}
      {personalizedSuggestions.skillGaps.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Skill Development Opportunities</h4>
          <div className="space-y-3">
            {personalizedSuggestions.skillGaps.slice(0, 3).map((gap, index) => (
              <div key={index} className="border rounded-lg p-3 bg-yellow-50">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-yellow-900">{gap.skill}</h5>
                  <span className="text-sm text-yellow-700">
                    Level {gap.currentLevel} → {gap.targetLevel}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-yellow-200 rounded-full h-2">
                    <div 
                      className="h-2 bg-yellow-600 rounded-full" 
                      style={{ width: `${(gap.currentLevel / gap.targetLevel) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  Estimated time to close: {gap.timeToClose}h
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Trending Suggestions List Component
interface TrendingSuggestionsListProps {
  suggestions: ContentSuggestion[];
  expandedSuggestion: string | null;
  implementingId: string | null;
  onToggleExpand: (id: string | null) => void;
  onImplement: (suggestion: ContentSuggestion) => void;
  onFeedback: (suggestionId: string, rating: number, helpful: boolean, comments: string) => void;
  getSuggestionIcon: (type: SuggestionType) => string;
  getPriorityColor: (priority: SuggestionPriority) => string;
  getConfidenceBar: (confidence: number) => JSX.Element;
}

const TrendingSuggestionsList: React.FC<TrendingSuggestionsListProps> = (props) => {
  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-purple-900 mb-2">🔥 Trending Content Opportunities</h4>
        <p className="text-purple-800 text-sm">
          Based on community activity, search trends, and industry developments
        </p>
      </div>
      <ContentSuggestionsList {...props} />
    </div>
  );
};

// Individual Suggestion Card Component
interface SuggestionCardProps {
  suggestion: ContentSuggestion;
  isExpanded: boolean;
  isImplementing: boolean;
  onToggleExpand: () => void;
  onImplement: () => void;
  onFeedback: (suggestionId: string, rating: number, helpful: boolean, comments: string) => void;
  getSuggestionIcon: (type: SuggestionType) => string;
  getPriorityColor: (priority: SuggestionPriority) => string;
  getConfidenceBar: (confidence: number) => JSX.Element;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isExpanded,
  isImplementing,
  onToggleExpand,
  onImplement,
  onFeedback,
  getSuggestionIcon,
  getPriorityColor,
  getConfidenceBar
}) => {
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    helpful: true,
    comments: ''
  });
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  const handleSubmitFeedback = () => {
    onFeedback(suggestion.id, feedbackForm.rating, feedbackForm.helpful, feedbackForm.comments);
    setShowFeedbackForm(false);
    setFeedbackForm({ rating: 5, helpful: true, comments: '' });
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">{getSuggestionIcon(suggestion.type)}</span>
          <div>
            <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(suggestion.priority)}`}>
            {suggestion.priority}
          </span>
          <button
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* Confidence and Relevance */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Confidence</span>
          <span className="font-medium">{Math.round(suggestion.confidence * 100)}%</span>
        </div>
        {getConfidenceBar(suggestion.confidence)}
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Relevance</span>
          <span className="font-medium">{Math.round(suggestion.relevanceScore * 100)}%</span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <h5 className="font-medium text-gray-900 mb-2">Suggested Content:</h5>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {suggestion.content}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Impact:</span>
              <span className="ml-2 text-gray-600">{suggestion.metadata.estimatedImpact}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Effort:</span>
              <span className="ml-2 text-gray-600">{suggestion.metadata.implementationEffort}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Difficulty:</span>
              <span className="ml-2 text-gray-600">{suggestion.metadata.difficultyLevel}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <span className="ml-2 text-gray-600">{suggestion.category}</span>
            </div>
          </div>

          {suggestion.source.reasoning && (
            <div className="bg-blue-50 rounded-lg p-3">
              <h5 className="font-medium text-blue-900 mb-2">AI Reasoning:</h5>
              <p className="text-sm text-blue-800">{suggestion.source.reasoning}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <button
                onClick={onImplement}
                disabled={isImplementing || suggestion.status === 'implemented'}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {isImplementing ? 'Implementing...' : 
                 suggestion.status === 'implemented' ? 'Implemented' : 'Implement'}
              </button>
              <button
                onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Feedback
              </button>
            </div>
            
            <div className="text-xs text-gray-500">
              by {suggestion.source.model} • {suggestion.timestamp.toLocaleDateString()}
            </div>
          </div>

          {/* Feedback Form */}
          {showFeedbackForm && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Provide Feedback</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rating (1-5)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackForm.rating}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-center text-sm text-gray-600">{feedbackForm.rating}/5</div>
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={feedbackForm.helpful}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, helpful: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">This suggestion is helpful</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comments (optional)
                  </label>
                  <textarea
                    value={feedbackForm.comments}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={3}
                    placeholder="Any additional feedback..."
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleSubmitFeedback}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => setShowFeedbackForm(false)}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIContentSuggestions;
