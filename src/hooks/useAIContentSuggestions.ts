/**
 * AI Content Suggestions Hook
 * React hook for AI-powered content suggestions,
 * personalization, and intelligent content recommendations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ContentSuggestion, 
  PersonalizedSuggestions,
  UserLearningProfile,
  ContentAnalysisResult,
  SuggestionType,
  SuggestionPriority
} from '../types/AIContentTypes';
import { aiContentSuggestionsService } from '../services/AIContentSuggestionsService';

interface UseAIContentSuggestionsOptions {
  contentPath?: string;
  userId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  enablePersonalization?: boolean;
  enableTrending?: boolean;
  maxSuggestions?: number;
  categories?: string[];
  onSuggestionGenerated?: (suggestion: ContentSuggestion) => void;
  onAnalysisComplete?: (analysis: ContentAnalysisResult) => void;
  onPersonalizationUpdate?: (personalized: PersonalizedSuggestions) => void;
}

interface UseAIContentSuggestionsReturn {
  // Suggestions data
  suggestions: ContentSuggestion[];
  personalizedSuggestions: PersonalizedSuggestions | null;
  trendingSuggestions: ContentSuggestion[];
  contentAnalysis: ContentAnalysisResult | null;
  isLoading: boolean;
  error: string | null;

  // Suggestion operations
  generateSuggestions: (contentPath?: string) => Promise<ContentSuggestion[]>;
  generatePersonalizedSuggestions: (userId?: string) => Promise<PersonalizedSuggestions | null>;
  analyzecontent: (contentPath: string, content?: string) => Promise<ContentAnalysisResult | null>;
  implementSuggestion: (suggestionId: string) => Promise<boolean>;
  provideFeedback: (suggestionId: string, feedback: any) => Promise<boolean>;

  // Content management
  refreshSuggestions: () => Promise<void>;
  clearSuggestions: () => void;
  filterSuggestions: (filters: SuggestionFilters) => ContentSuggestion[];

  // Analytics and insights
  getSuggestionAnalytics: () => any;
  getPersonalizationInsights: () => any;
  getContentHealth: () => ContentHealthMetrics;
  trackSuggestionInteraction: (suggestionId: string, action: string) => void;

  // User profile management
  userProfile: UserLearningProfile | null;
  updateUserProfile: (updates: Partial<UserLearningProfile>) => Promise<boolean>;
  getUserInsights: () => UserInsights;

  // Real-time features
  enableRealTimeUpdates: () => void;
  disableRealTimeUpdates: () => void;
  isRealTimeEnabled: boolean;
}

interface SuggestionFilters {
  types?: SuggestionType[];
  priorities?: SuggestionPriority[];
  categories?: string[];
  minConfidence?: number;
  minRelevance?: number;
  implemented?: boolean;
}

interface ContentHealthMetrics {
  overallScore: number;
  completenessScore: number;
  qualityScore: number;
  engagementPotential: number;
  improvementOpportunities: number;
  criticalIssues: number;
  trends: {
    improving: string[];
    declining: string[];
    stable: string[];
  };
}

interface UserInsights {
  learningVelocity: number;
  strongestAreas: string[];
  improvementAreas: string[];
  engagementPatterns: any;
  recommendationAccuracy: number;
  goalProgress: any;
}

export const useAIContentSuggestions = (
  options: UseAIContentSuggestionsOptions
): UseAIContentSuggestionsReturn => {
  const {
    contentPath,
    userId,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
    enablePersonalization = true,
    enableTrending = true,
    maxSuggestions = 10,
    categories = [],
    onSuggestionGenerated,
    onAnalysisComplete,
    onPersonalizationUpdate
  } = options;

  // State
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState<PersonalizedSuggestions | null>(null);
  const [trendingSuggestions, setTrendingSuggestions] = useState<ContentSuggestion[]>([]);
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysisResult | null>(null);
  const [userProfile, setUserProfile] = useState<UserLearningProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);

  // Refs
  const refreshIntervalRef = useRef<number | null>(null);
  const interactionHistory = useRef<any[]>([]);

  // Load initial data
  useEffect(() => {
    if (contentPath || userId) {
      refreshSuggestions();
    }
  }, [contentPath, userId]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = window.setInterval(() => {
        refreshSuggestions();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval]);

  // Generate content suggestions
  const generateSuggestions = useCallback(async (targetContentPath?: string): Promise<ContentSuggestion[]> => {
    const path = targetContentPath || contentPath;
    if (!path) return [];

    try {
      setIsLoading(true);
      setError(null);

      const newSuggestions = await aiContentSuggestionsService.generateContentSuggestions(path);
      
      // Filter by categories if specified
      const filteredSuggestions = categories.length > 0 
        ? newSuggestions.filter(s => categories.includes(s.category))
        : newSuggestions;

      // Limit suggestions
      const limitedSuggestions = filteredSuggestions.slice(0, maxSuggestions);

      setSuggestions(limitedSuggestions);

      // Trigger callbacks
      limitedSuggestions.forEach(suggestion => {
        if (onSuggestionGenerated) {
          onSuggestionGenerated(suggestion);
        }
      });

      return limitedSuggestions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [contentPath, categories, maxSuggestions, onSuggestionGenerated]);

  // Generate personalized suggestions
  const generatePersonalizedSuggestions = useCallback(async (targetUserId?: string): Promise<PersonalizedSuggestions | null> => {
    if (!enablePersonalization) return null;
    
    const id = targetUserId || userId;
    if (!id) return null;

    try {
      const personalized = await aiContentSuggestionsService.generatePersonalizedSuggestions(id);
      setPersonalizedSuggestions(personalized);
      setUserProfile(personalized.userProfile);

      if (onPersonalizationUpdate) {
        onPersonalizationUpdate(personalized);
      }

      return personalized;
    } catch (err) {
      console.error('Failed to generate personalized suggestions:', err);
      return null;
    }
  }, [enablePersonalization, userId, onPersonalizationUpdate]);

  // Analyze content
  const analyzecontent = useCallback(async (targetContentPath: string, content?: string): Promise<ContentAnalysisResult | null> => {
    try {
      const analysis = await aiContentSuggestionsService.analyzeContent(targetContentPath, content);
      setContentAnalysis(analysis);

      if (onAnalysisComplete) {
        onAnalysisComplete(analysis);
      }

      return analysis;
    } catch (err) {
      console.error('Failed to analyze content:', err);
      return null;
    }
  }, [onAnalysisComplete]);

  // Implement suggestion
  const implementSuggestion = useCallback(async (suggestionId: string): Promise<boolean> => {
    if (!contentPath) return false;

    try {
      const success = await aiContentSuggestionsService.implementSuggestion(suggestionId, contentPath);
      
      if (success) {
        // Update suggestion status locally
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId ? { ...s, status: 'implemented' as const } : s
        ));

        // Track interaction
        trackSuggestionInteraction(suggestionId, 'implement');
      }

      return success;
    } catch (err) {
      console.error('Failed to implement suggestion:', err);
      return false;
    }
  }, [contentPath]);

  // Provide feedback
  const provideFeedback = useCallback(async (suggestionId: string, feedback: any): Promise<boolean> => {
    if (!contentPath) return false;

    try {
      const success = await aiContentSuggestionsService.provideSuggestionFeedback(
        suggestionId,
        contentPath,
        feedback
      );

      if (success) {
        // Update suggestion with feedback locally
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId ? { ...s, userFeedback: feedback } : s
        ));

        // Track interaction
        trackSuggestionInteraction(suggestionId, 'feedback');
      }

      return success;
    } catch (err) {
      console.error('Failed to provide feedback:', err);
      return false;
    }
  }, [contentPath]);

  // Refresh all suggestions
  const refreshSuggestions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate content suggestions
      if (contentPath) {
        await generateSuggestions(contentPath);
      }

      // Generate personalized suggestions
      if (enablePersonalization && userId) {
        await generatePersonalizedSuggestions(userId);
      }

      // Load trending suggestions
      if (enableTrending) {
        const trending = await aiContentSuggestionsService.getTrendingSuggestions();
        setTrendingSuggestions(trending);
      }

      // Analyze content if path provided
      if (contentPath) {
        await analyzecontent(contentPath);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh suggestions';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [contentPath, userId, enablePersonalization, enableTrending, generateSuggestions, generatePersonalizedSuggestions, analyzecontent]);

  // Clear suggestions
  const clearSuggestions = useCallback((): void => {
    setSuggestions([]);
    setPersonalizedSuggestions(null);
    setTrendingSuggestions([]);
    setContentAnalysis(null);
    setError(null);
  }, []);

  // Filter suggestions
  const filterSuggestions = useCallback((filters: SuggestionFilters): ContentSuggestion[] => {
    return suggestions.filter(suggestion => {
      if (filters.types && !filters.types.includes(suggestion.type)) return false;
      if (filters.priorities && !filters.priorities.includes(suggestion.priority)) return false;
      if (filters.categories && !filters.categories.includes(suggestion.category)) return false;
      if (filters.minConfidence && suggestion.confidence < filters.minConfidence) return false;
      if (filters.minRelevance && suggestion.relevanceScore < filters.minRelevance) return false;
      if (filters.implemented !== undefined) {
        const isImplemented = suggestion.status === 'implemented';
        if (filters.implemented !== isImplemented) return false;
      }
      return true;
    });
  }, [suggestions]);

  // Get suggestion analytics
  const getSuggestionAnalytics = useCallback(() => {
    return aiContentSuggestionsService.getSuggestionAnalytics();
  }, []);

  // Get personalization insights
  const getPersonalizationInsights = useCallback((): any => {
    if (!personalizedSuggestions) return null;

    return {
      learningStyleMatch: personalizedSuggestions.userProfile.learningStyle,
      goalAlignment: personalizedSuggestions.userProfile.goals.reduce((sum, goal) => sum + goal.progress, 0) / personalizedSuggestions.userProfile.goals.length,
      skillProgression: personalizedSuggestions.userProfile.skillAreas,
      recommendationAccuracy: personalizedSuggestions.suggestions.reduce((sum, s) => sum + s.relevanceScore, 0) / personalizedSuggestions.suggestions.length,
      engagementTrends: personalizedSuggestions.userProfile.progress
    };
  }, [personalizedSuggestions]);

  // Get content health metrics
  const getContentHealth = useCallback((): ContentHealthMetrics => {
    if (!contentAnalysis) {
      return {
        overallScore: 0,
        completenessScore: 0,
        qualityScore: 0,
        engagementPotential: 0,
        improvementOpportunities: 0,
        criticalIssues: 0,
        trends: { improving: [], declining: [], stable: [] }
      };
    }

    const criticalIssues = suggestions.filter(s => s.priority === 'critical').length;
    const improvementOpportunities = suggestions.filter(s => s.type === 'content_improvement').length;

    return {
      overallScore: (contentAnalysis.qualityScore + contentAnalysis.completenessScore + contentAnalysis.engagementPotential) / 3,
      completenessScore: contentAnalysis.completenessScore,
      qualityScore: contentAnalysis.qualityScore,
      engagementPotential: contentAnalysis.engagementPotential,
      improvementOpportunities,
      criticalIssues,
      trends: {
        improving: suggestions.filter(s => s.type === 'content_enhancement').map(s => s.title),
        declining: suggestions.filter(s => s.priority === 'high' && s.type === 'content_update').map(s => s.title),
        stable: suggestions.filter(s => s.priority === 'low').map(s => s.title)
      }
    };
  }, [contentAnalysis, suggestions]);

  // Track suggestion interaction
  const trackSuggestionInteraction = useCallback((suggestionId: string, action: string): void => {
    const interaction = {
      suggestionId,
      action,
      timestamp: new Date(),
      contentPath,
      userId
    };

    interactionHistory.current.push(interaction);

    // Keep only last 1000 interactions
    if (interactionHistory.current.length > 1000) {
      interactionHistory.current = interactionHistory.current.slice(-1000);
    }
  }, [contentPath, userId]);

  // Update user profile
  const updateUserProfile = useCallback(async (updates: Partial<UserLearningProfile>): Promise<boolean> => {
    if (!userProfile) return false;

    try {
      const updatedProfile = { ...userProfile, ...updates };
      setUserProfile(updatedProfile);
      
      // Re-generate personalized suggestions with updated profile
      if (enablePersonalization && userId) {
        await generatePersonalizedSuggestions(userId);
      }

      return true;
    } catch (err) {
      console.error('Failed to update user profile:', err);
      return false;
    }
  }, [userProfile, enablePersonalization, userId, generatePersonalizedSuggestions]);

  // Get user insights
  const getUserInsights = useCallback((): UserInsights => {
    if (!userProfile) {
      return {
        learningVelocity: 0,
        strongestAreas: [],
        improvementAreas: [],
        engagementPatterns: {},
        recommendationAccuracy: 0,
        goalProgress: {}
      };
    }

    const interactions = interactionHistory.current;
    const recentInteractions = interactions.filter(i => 
      new Date().getTime() - i.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    return {
      learningVelocity: recentInteractions.length / 7, // interactions per day
      strongestAreas: userProfile.progress.strongestAreas,
      improvementAreas: userProfile.progress.weakestAreas,
      engagementPatterns: {
        totalInteractions: interactions.length,
        recentActivity: recentInteractions.length,
        averageSessionLength: userProfile.preferences.sessionDuration
      },
      recommendationAccuracy: personalizedSuggestions?.suggestions 
        ? personalizedSuggestions.suggestions.reduce((sum, s) => sum + s.relevanceScore, 0) / personalizedSuggestions.suggestions.length 
        : 0,
      goalProgress: userProfile.goals.reduce((acc, goal) => {
        acc[goal.title] = goal.progress;
        return acc;
      }, {} as any)
    };
  }, [userProfile, personalizedSuggestions]);

  // Real-time updates
  const enableRealTimeUpdates = useCallback((): void => {
    setIsRealTimeEnabled(true);
    // In a real implementation, this would establish WebSocket connection
  }, []);

  const disableRealTimeUpdates = useCallback((): void => {
    setIsRealTimeEnabled(false);
    // In a real implementation, this would close WebSocket connection
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    // Suggestions data
    suggestions,
    personalizedSuggestions,
    trendingSuggestions,
    contentAnalysis,
    isLoading,
    error,

    // Suggestion operations
    generateSuggestions,
    generatePersonalizedSuggestions,
    analyzecontent,
    implementSuggestion,
    provideFeedback,

    // Content management
    refreshSuggestions,
    clearSuggestions,
    filterSuggestions,

    // Analytics and insights
    getSuggestionAnalytics,
    getPersonalizationInsights,
    getContentHealth,
    trackSuggestionInteraction,

    // User profile management
    userProfile,
    updateUserProfile,
    getUserInsights,

    // Real-time features
    enableRealTimeUpdates,
    disableRealTimeUpdates,
    isRealTimeEnabled
  };
};
