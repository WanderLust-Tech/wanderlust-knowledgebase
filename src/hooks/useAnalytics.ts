/**
 * Analytics Integration Hook
 * React hook for integrating analytics tracking throughout the application
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/AdvancedAnalyticsService';

export const useAnalytics = () => {
  const location = useLocation();
  const pageStartTime = useRef<number>(Date.now());
  const scrollDepth = useRef<number>(0);
  const maxScrollDepth = useRef<number>(0);

  // Track page views automatically
  useEffect(() => {
    const pathWithoutHash = location.pathname;
    const pageTitle = document.title;
    
    // Track page view
    analyticsService.trackPageView(pathWithoutHash, pageTitle);
    
    // Reset page metrics
    pageStartTime.current = Date.now();
    maxScrollDepth.current = 0;
    
    // Track scroll depth
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      const currentScrollDepth = Math.round(((scrollTop + windowHeight) / documentHeight) * 100);
      scrollDepth.current = currentScrollDepth;
      
      if (currentScrollDepth > maxScrollDepth.current) {
        maxScrollDepth.current = currentScrollDepth;
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    // Cleanup on page change
    return () => {
      window.removeEventListener('scroll', handleScroll);
      
      // Track time spent on page when leaving
      const timeSpent = Date.now() - pageStartTime.current;
      if (timeSpent > 1000) { // Only track if user spent more than 1 second
        analyticsService.trackEvent('page_view', {
          path: pathWithoutHash,
          timeSpent,
          scrollDepth: maxScrollDepth.current,
          completed: maxScrollDepth.current > 80
        });
      }
    };
  }, [location]);

  // Analytics tracking functions
  const trackArticleRead = useCallback((articlePath: string, completed: boolean = false) => {
    const timeSpent = Date.now() - pageStartTime.current;
    analyticsService.trackArticleRead(
      articlePath,
      timeSpent,
      maxScrollDepth.current,
      completed
    );
  }, []);

  const trackTutorialProgress = useCallback((tutorialId: string, stepId: string, completed: boolean, hints: number = 0) => {
    const timeSpent = Date.now() - pageStartTime.current;
    analyticsService.trackTutorialProgress(tutorialId, stepId, completed, timeSpent, hints);
  }, []);

  const trackVideoInteraction = useCallback((videoId: string, action: 'played' | 'paused' | 'completed' | 'seeked', position: number, duration: number) => {
    analyticsService.trackVideoInteraction(videoId, action, position, duration);
  }, []);

  const trackSearch = useCallback((query: string, resultsCount: number, clickedResult?: string) => {
    analyticsService.trackSearchBehavior(query, resultsCount, clickedResult);
  }, []);

  const trackCodeCopy = useCallback((codeId: string, language: string) => {
    analyticsService.trackCodeInteraction(codeId, 'copy', language);
  }, []);

  const trackBookmark = useCallback((action: 'add' | 'remove', contentId: string) => {
    analyticsService.trackEvent(action === 'add' ? 'bookmark_added' : 'bookmark_removed', {
      contentId,
      timestamp: Date.now()
    });
  }, []);

  const trackDiagramInteraction = useCallback((diagramId: string, nodeId: string, action: 'click' | 'hover' | 'zoom') => {
    analyticsService.trackDiagramInteraction(diagramId, nodeId, action);
  }, []);

  const trackCommunityActivity = useCallback((activityType: 'discussion_created' | 'comment_posted' | 'reaction_added', targetId: string, details: Record<string, any> = {}) => {
    analyticsService.trackCommunityActivity(activityType, targetId, details);
  }, []);

  const trackFeatureUsage = useCallback((feature: string, action: string, context: Record<string, any> = {}) => {
    analyticsService.trackFeatureUsage(feature, action, context);
  }, []);

  const trackError = useCallback((error: Error, context: Record<string, any> = {}) => {
    analyticsService.trackError(error, {
      ...context,
      path: location.pathname,
      userAgent: navigator.userAgent
    });
  }, [location.pathname]);

  const trackMilestone = useCallback((milestone: string, details: Record<string, any> = {}) => {
    analyticsService.trackEvent('progress_milestone', {
      milestone,
      ...details,
      timestamp: Date.now()
    });
  }, []);

  return {
    // Tracking functions
    trackArticleRead,
    trackTutorialProgress,
    trackVideoInteraction,
    trackSearch,
    trackCodeCopy,
    trackBookmark,
    trackDiagramInteraction,
    trackCommunityActivity,
    trackFeatureUsage,
    trackError,
    trackMilestone,
    
    // Current session info
    getCurrentScrollDepth: () => scrollDepth.current,
    getTimeOnPage: () => Date.now() - pageStartTime.current,
    
    // Analytics service access
    analyticsService
  };
};

/**
 * Higher-order component for automatic analytics tracking
 */
export const withAnalytics = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> => {
  const AnalyticsWrappedComponent = (props: P) => {
    const analytics = useAnalytics();
    
    useEffect(() => {
      analytics.trackFeatureUsage('component', 'rendered', { componentName });
    }, [analytics]);

    return React.createElement(WrappedComponent, props);
  };
  
  AnalyticsWrappedComponent.displayName = `withAnalytics(${componentName})`;
  return AnalyticsWrappedComponent;
};

/**
 * Hook for tracking component-specific analytics
 */
export const useComponentAnalytics = (componentName: string) => {
  const analytics = useAnalytics();
  const renderTime = useRef<number>(Date.now());

  useEffect(() => {
    analytics.trackFeatureUsage('component', 'mounted', { 
      componentName,
      timestamp: Date.now()
    });

    return () => {
      const timeActive = Date.now() - renderTime.current;
      analytics.trackFeatureUsage('component', 'unmounted', { 
        componentName,
        timeActive,
        timestamp: Date.now()
      });
    };
  }, [analytics, componentName]);

  const trackComponentAction = useCallback((action: string, details: Record<string, any> = {}) => {
    analytics.trackFeatureUsage('component', action, {
      componentName,
      ...details
    });
  }, [analytics, componentName]);

  return {
    ...analytics,
    trackComponentAction
  };
};

/**
 * Hook for tracking learning-specific analytics
 */
export const useLearningAnalytics = () => {
  const analytics = useAnalytics();

  const trackLearningStart = useCallback((contentType: 'article' | 'tutorial' | 'video', contentId: string) => {
    analytics.trackFeatureUsage('learning', 'started', {
      contentType,
      contentId,
      timestamp: Date.now()
    });
  }, [analytics]);

  const trackLearningComplete = useCallback((contentType: 'article' | 'tutorial' | 'video', contentId: string, timeSpent: number) => {
    analytics.trackFeatureUsage('learning', 'completed', {
      contentType,
      contentId,
      timeSpent,
      timestamp: Date.now()
    });
    
    // Track milestone for learning completion
    analytics.trackMilestone(`${contentType}_completed`, {
      contentId,
      timeSpent
    });
  }, [analytics]);

  const trackLearningProgress = useCallback((contentId: string, progress: number, details: Record<string, any> = {}) => {
    analytics.trackFeatureUsage('learning', 'progress', {
      contentId,
      progress,
      ...details,
      timestamp: Date.now()
    });
  }, [analytics]);

  const trackLearningStreak = useCallback((streakDays: number) => {
    analytics.trackMilestone('learning_streak', {
      streakDays,
      timestamp: Date.now()
    });
  }, [analytics]);

  return {
    ...analytics,
    trackLearningStart,
    trackLearningComplete,
    trackLearningProgress,
    trackLearningStreak
  };
};
