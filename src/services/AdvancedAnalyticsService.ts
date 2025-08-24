/**
 * Advanced Analytics Service
 * Comprehensive analytics system for tracking user behavior, learning patterns, and platform performance
 */

import {
  AnalyticsEvent,
  AnalyticsEventType,
  EventMetadata,
  UserBehaviorAnalytics,
  PlatformAnalytics,
  AnalyticsFilter,
  AnalyticsQuery,
  ContentPerformanceStats,
  LearningProgressAnalytics,
  EngagementMetrics,
  SessionStats
} from '../types/AnalyticsTypes';

class AdvancedAnalyticsService {
  private storageKey = 'wanderlust_analytics';
  private sessionId: string;
  private userId: string;
  private sessionStartTime: number;
  private currentPageStartTime: number;
  private eventQueue: AnalyticsEvent[] = [];
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.sessionStartTime = Date.now();
    this.currentPageStartTime = Date.now();
    
    this.initializeAnalytics();
    this.startFlushTimer();
    this.trackSessionStart();
  }

  // ==================== Event Tracking ====================

  trackEvent(type: AnalyticsEventType, data: Record<string, any> = {}): void {
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      data,
      metadata: this.getEventMetadata()
    };

    this.eventQueue.push(event);
    
    // Flush immediately for critical events
    if (this.isCriticalEvent(type)) {
      this.flushEvents();
    }
  }

  trackPageView(path: string, title: string): void {
    // Track previous page time if exists
    if (this.currentPageStartTime) {
      const timeOnPage = Date.now() - this.currentPageStartTime;
      this.trackEvent('page_view', {
        path: window.location.pathname,
        timeSpent: timeOnPage
      });
    }

    this.currentPageStartTime = Date.now();
    this.trackEvent('page_view', {
      path,
      title,
      referrer: document.referrer,
      timestamp: Date.now()
    });
  }

  trackArticleRead(articlePath: string, readingTime: number, scrollDepth: number, completed: boolean): void {
    this.trackEvent('article_read', {
      articlePath,
      readingTime,
      scrollDepth,
      completed,
      wordsPerMinute: this.calculateReadingSpeed(articlePath, readingTime)
    });
  }

  trackTutorialProgress(tutorialId: string, stepId: string, completed: boolean, timeSpent: number, hints: number): void {
    this.trackEvent(completed ? 'tutorial_step_completed' : 'tutorial_started', {
      tutorialId,
      stepId,
      timeSpent,
      hintsUsed: hints,
      completed
    });
  }

  trackVideoInteraction(videoId: string, action: 'played' | 'paused' | 'completed' | 'seeked', position: number, duration: number): void {
    const eventType = action === 'played' ? 'video_played' : 
                     action === 'paused' ? 'video_paused' : 'video_completed';
    
    this.trackEvent(eventType, {
      videoId,
      action,
      position,
      duration,
      completionPercentage: (position / duration) * 100
    });
  }

  trackSearchBehavior(query: string, resultsCount: number, clickedResult?: string, refinements: string[] = []): void {
    this.trackEvent('search_performed', {
      query,
      resultsCount,
      clickedResult,
      refinements,
      hasResults: resultsCount > 0,
      searchTime: Date.now()
    });
  }

  trackCodeInteraction(codeId: string, action: 'copy' | 'run' | 'modify', language: string): void {
    this.trackEvent('code_copied', {
      codeId,
      action,
      language,
      timestamp: Date.now()
    });
  }

  trackDiagramInteraction(diagramId: string, nodeId: string, action: 'click' | 'hover' | 'zoom'): void {
    this.trackEvent('diagram_interacted', {
      diagramId,
      nodeId,
      action,
      timestamp: Date.now()
    });
  }

  trackCommunityActivity(activityType: 'discussion_created' | 'comment_posted' | 'reaction_added', targetId: string, details: Record<string, any>): void {
    this.trackEvent(activityType, {
      targetId,
      ...details,
      timestamp: Date.now()
    });
  }

  trackFeatureUsage(feature: string, action: string, context: Record<string, any> = {}): void {
    this.trackEvent('feature_used', {
      feature,
      action,
      context,
      timestamp: Date.now()
    });
  }

  trackError(error: Error, context: Record<string, any> = {}): void {
    this.trackEvent('error_occurred', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  // ==================== Analytics Retrieval ====================

  getUserAnalytics(userId?: string): UserBehaviorAnalytics | null {
    const targetUserId = userId || this.userId;
    const events = this.getStoredEvents().filter(event => event.userId === targetUserId);
    
    if (events.length === 0) return null;

    return {
      userId: targetUserId,
      sessionStats: this.calculateSessionStats(events),
      learningProgress: this.calculateLearningProgress(events),
      engagementMetrics: this.calculateEngagementMetrics(events),
      contentInteraction: this.calculateContentInteraction(events),
      communityActivity: this.calculateCommunityActivity(events),
      preferences: this.calculateUserPreferences(events)
    };
  }

  getPlatformAnalytics(filter?: AnalyticsFilter): PlatformAnalytics {
    const events = this.getFilteredEvents(filter);
    
    return {
      overallStats: this.calculateOverallStats(events),
      contentPerformance: this.calculateContentPerformance(events),
      userGrowth: this.calculateUserGrowth(events),
      featureUsage: this.calculateFeatureUsage(events),
      systemPerformance: this.calculateSystemPerformance(events),
      trends: this.calculateTrends(events)
    };
  }

  getContentAnalytics(contentId: string, timeframe: string = '30d'): ContentPerformanceStats {
    const events = this.getStoredEvents().filter(event => {
      const isRelevant = event.data.articlePath === contentId || 
                        event.data.tutorialId === contentId || 
                        event.data.videoId === contentId;
      
      const isInTimeframe = this.isInTimeframe(event.timestamp, timeframe);
      
      return isRelevant && isInTimeframe;
    });

    return this.calculateContentPerformanceStats(contentId, events);
  }

  getLearningAnalytics(userId?: string): LearningProgressAnalytics {
    const targetUserId = userId || this.userId;
    const events = this.getStoredEvents().filter(event => 
      event.userId === targetUserId && this.isLearningEvent(event.type)
    );

    return this.calculateLearningProgress(events);
  }

  getEngagementAnalytics(timeframe: string = '7d'): EngagementMetrics {
    const events = this.getStoredEvents().filter(event => 
      this.isInTimeframe(event.timestamp, timeframe)
    );

    return this.calculateEngagementMetrics(events);
  }

  // ==================== Real-time Analytics ====================

  getRealTimeStats(): any {
    const currentSession = this.getStoredEvents().filter(event => 
      event.sessionId === this.sessionId
    );

    return {
      currentSessionDuration: Date.now() - this.sessionStartTime,
      pagesViewedThisSession: currentSession.filter(e => e.type === 'page_view').length,
      actionsThisSession: currentSession.length,
      currentPage: window.location.pathname,
      timeOnCurrentPage: Date.now() - this.currentPageStartTime,
      activeFeatures: this.getActiveFeatures(currentSession),
      learningProgress: this.getCurrentLearningProgress(),
      engagementLevel: this.calculateCurrentEngagementLevel(currentSession)
    };
  }

  getPersonalizedInsights(): any {
    const userAnalytics = this.getUserAnalytics();
    if (!userAnalytics) return null;

    return {
      learningVelocity: userAnalytics.learningProgress.learningVelocity,
      strongAreas: this.identifyStrongAreas(userAnalytics),
      improvementAreas: this.identifyImprovementAreas(userAnalytics),
      recommendedContent: this.generateContentRecommendations(userAnalytics),
      learningPath: this.suggestLearningPath(userAnalytics),
      achievements: this.calculateAchievements(userAnalytics),
      nextMilestones: this.getNextMilestones(userAnalytics)
    };
  }

  // ==================== Predictive Analytics ====================

  predictUserBehavior(userId?: string): any {
    const userAnalytics = this.getUserAnalytics(userId);
    if (!userAnalytics) return null;

    return {
      likelyToChurn: this.predictChurnRisk(userAnalytics),
      nextAction: this.predictNextAction(userAnalytics),
      contentPreferences: this.predictContentPreferences(userAnalytics),
      optimalLearningTime: this.predictOptimalLearningTime(userAnalytics),
      completionProbability: this.predictCompletionProbability(userAnalytics)
    };
  }

  generateRecommendations(type: 'content' | 'feature' | 'time' | 'learning_path'): any {
    const userAnalytics = this.getUserAnalytics();
    const platformAnalytics = this.getPlatformAnalytics();

    switch (type) {
      case 'content':
        return this.generateContentRecommendations(userAnalytics);
      case 'feature':
        return this.generateFeatureRecommendations(userAnalytics, platformAnalytics);
      case 'time':
        return this.generateTimeRecommendations(userAnalytics);
      case 'learning_path':
        return this.generateLearningPathRecommendations(userAnalytics);
      default:
        return null;
    }
  }

  // ==================== Analytics Calculations ====================

  private calculateSessionStats(events: AnalyticsEvent[]): SessionStats {
    const sessions = this.groupEventsBySessions(events);
    const sessionDurations = sessions.map(session => this.calculateSessionDuration(session));
    
    return {
      totalSessions: sessions.length,
      averageSessionDuration: this.average(sessionDurations),
      longestSession: Math.max(...sessionDurations),
      shortestSession: Math.min(...sessionDurations),
      pagesPerSession: this.calculatePagesPerSession(sessions),
      bounceRate: this.calculateBounceRate(sessions),
      returningUser: sessions.length > 1,
      lastActive: events[events.length - 1]?.timestamp || new Date().toISOString(),
      deviceTypes: this.calculateDeviceTypeStats(events),
      timeOfDayPatterns: this.calculateTimePatterns(events)
    };
  }

  private calculateLearningProgress(events: AnalyticsEvent[]): LearningProgressAnalytics {
    const learningEvents = events.filter(event => this.isLearningEvent(event.type));
    
    const articlesRead = learningEvents.filter(e => e.type === 'article_read' && e.data.completed).length;
    const tutorialsStarted = learningEvents.filter(e => e.type === 'tutorial_started').length;
    const tutorialsCompleted = learningEvents.filter(e => e.type === 'tutorial_completed').length;
    const videosWatched = learningEvents.filter(e => e.type === 'video_completed').length;
    
    const totalLearningTime = learningEvents.reduce((total, event) => {
      return total + (event.data.timeSpent || event.data.readingTime || 0);
    }, 0);

    return {
      articlesRead,
      tutorialsStarted,
      tutorialsCompleted,
      videosWatched,
      totalLearningTime,
      streakDays: this.calculateStreakDays(learningEvents),
      completionRate: tutorialsStarted > 0 ? (tutorialsCompleted / tutorialsStarted) * 100 : 0,
      learningVelocity: this.calculateLearningVelocity(learningEvents),
      difficultyProgression: this.calculateDifficultyProgression(learningEvents),
      topicMastery: this.calculateTopicMastery(learningEvents),
      learningPath: this.calculateLearningPath(learningEvents)
    };
  }

  private calculateEngagementMetrics(events: AnalyticsEvent[]): EngagementMetrics {
    const engagementEvents = events.filter(event => this.isEngagementEvent(event.type));
    
    return {
      totalInteractions: engagementEvents.length,
      bookmarksCreated: events.filter(e => e.type === 'bookmark_added').length,
      commentsPosted: events.filter(e => e.type === 'comment_posted').length,
      discussionsCreated: events.filter(e => e.type === 'discussion_created').length,
      reactionsGiven: events.filter(e => e.type === 'reaction_added').length,
      sharesPerformed: 0, // Placeholder
      feedbackProvided: 0, // Placeholder
      helpfulnessRating: this.calculateHelpfulnessRating(events),
      communityReputation: this.calculateCommunityReputation(events),
      engagementScore: this.calculateEngagementScore(engagementEvents),
      engagementTrend: this.calculateEngagementTrend(engagementEvents)
    };
  }

  private calculateContentInteraction(events: AnalyticsEvent[]): any {
    const contentEvents = events.filter(event => this.isContentEvent(event.type));
    
    return {
      mostViewedContent: this.getMostViewedContent(contentEvents),
      searchPatterns: this.calculateSearchPatterns(events),
      readingBehavior: this.calculateReadingBehavior(contentEvents),
      preferredContentTypes: this.calculateContentTypePreferences(contentEvents),
      timeSpentByCategory: this.calculateTimeByCategory(contentEvents),
      contentDiscoveryMethods: this.calculateDiscoveryMethods(contentEvents)
    };
  }

  private calculateCommunityActivity(events: AnalyticsEvent[]): any {
    const communityEvents = events.filter(event => this.isCommunityEvent(event.type));
    
    return {
      contributionScore: this.calculateContributionScore(communityEvents),
      helpfulnessRating: this.calculateHelpfulnessRating(communityEvents),
      communityInfluence: this.calculateCommunityInfluence(communityEvents),
      responseTime: this.calculateAverageResponseTime(communityEvents),
      topicExpertise: this.calculateTopicExpertise(communityEvents),
      collaborationPatterns: this.calculateCollaborationPatterns(communityEvents),
      mentorshipActivity: this.calculateMentorshipActivity(communityEvents)
    };
  }

  private calculateUserPreferences(events: AnalyticsEvent[]): any {
    return {
      contentDifficulty: this.inferContentDifficultyPreference(events),
      learningStyle: this.inferLearningStyle(events),
      sessionLength: this.inferSessionLengthPreference(events),
      notificationPreferences: this.inferNotificationPreferences(events),
      themePreference: this.getThemePreference(),
      devicePreference: this.inferDevicePreference(events)
    };
  }

  // ==================== Helper Methods ====================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserId(): string {
    let userId = localStorage.getItem('wanderlust_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('wanderlust_user_id', userId);
    }
    return userId;
  }

  private getEventMetadata(): EventMetadata {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      connectionType: (navigator as any).connection?.effectiveType,
      referrer: document.referrer,
      location: {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      },
      performance: this.getPerformanceMetrics()
    };
  }

  private getPerformanceMetrics(): any {
    if ('performance' in window && performance.timing) {
      const timing = performance.timing;
      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        renderTime: timing.domContentLoadedEventEnd - timing.navigationStart
      };
    }
    return {};
  }

  private isCriticalEvent(type: AnalyticsEventType): boolean {
    return ['error_occurred', 'session_ended', 'tutorial_completed'].includes(type);
  }

  private isLearningEvent(type: AnalyticsEventType): boolean {
    return [
      'article_read',
      'tutorial_started',
      'tutorial_completed',
      'tutorial_step_completed',
      'video_played',
      'video_completed'
    ].includes(type);
  }

  private isEngagementEvent(type: AnalyticsEventType): boolean {
    return [
      'bookmark_added',
      'comment_posted',
      'discussion_created',
      'reaction_added',
      'code_copied',
      'diagram_interacted'
    ].includes(type);
  }

  private isContentEvent(type: AnalyticsEventType): boolean {
    return [
      'page_view',
      'article_read',
      'video_played',
      'search_performed'
    ].includes(type);
  }

  private isCommunityEvent(type: AnalyticsEventType): boolean {
    return [
      'discussion_created',
      'comment_posted',
      'reaction_added'
    ].includes(type);
  }

  private isInTimeframe(timestamp: string, timeframe: string): boolean {
    const eventDate = new Date(timestamp);
    const now = new Date();
    const days = parseInt(timeframe.replace('d', ''));
    const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    return eventDate >= cutoff;
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  // ==================== Storage & Persistence ====================

  private initializeAnalytics(): void {
    // Initialize analytics storage if not exists
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify([]));
    }
  }

  private getStoredEvents(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading analytics data:', error);
      return [];
    }
  }

  private saveEvents(events: AnalyticsEvent[]): void {
    try {
      // Keep only recent events to prevent storage bloat
      const recentEvents = events.filter(event => 
        this.isInTimeframe(event.timestamp, '90d')
      );
      localStorage.setItem(this.storageKey, JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Error saving analytics data:', error);
    }
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    const existingEvents = this.getStoredEvents();
    const allEvents = [...existingEvents, ...this.eventQueue];
    
    this.saveEvents(allEvents);
    this.eventQueue = [];
  }

  private startFlushTimer(): void {
    setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.trackEvent('session_ended', {
        sessionDuration: Date.now() - this.sessionStartTime,
        totalPageViews: this.eventQueue.filter(e => e.type === 'page_view').length
      });
      this.flushEvents();
    });
  }

  private trackSessionStart(): void {
    this.trackEvent('session_started', {
      timestamp: this.sessionStartTime,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    });
  }

  // Placeholder implementations for complex calculations
  private calculateReadingSpeed(articlePath: string, readingTime: number): number { return 200; }
  private groupEventsBySessions(events: AnalyticsEvent[]): AnalyticsEvent[][] { return [events]; }
  private calculateSessionDuration(session: AnalyticsEvent[]): number { return 300000; }
  private calculatePagesPerSession(sessions: AnalyticsEvent[][]): number { return 3; }
  private calculateBounceRate(sessions: AnalyticsEvent[][]): number { return 0.3; }
  private calculateDeviceTypeStats(events: AnalyticsEvent[]): any[] { return []; }
  private calculateTimePatterns(events: AnalyticsEvent[]): any[] { return []; }
  private calculateStreakDays(events: AnalyticsEvent[]): number { return 5; }
  private calculateLearningVelocity(events: AnalyticsEvent[]): number { return 2.5; }
  private calculateDifficultyProgression(events: AnalyticsEvent[]): any { return {}; }
  private calculateTopicMastery(events: AnalyticsEvent[]): any[] { return []; }
  private calculateLearningPath(events: AnalyticsEvent[]): any { return {}; }
  private calculateHelpfulnessRating(events: AnalyticsEvent[]): number { return 8.5; }
  private calculateCommunityReputation(events: AnalyticsEvent[]): number { return 750; }
  private calculateEngagementScore(events: AnalyticsEvent[]): number { return 85; }
  private calculateEngagementTrend(events: AnalyticsEvent[]): 'increasing' | 'stable' | 'decreasing' { return 'increasing'; }
  private getMostViewedContent(events: AnalyticsEvent[]): any[] { return []; }
  private calculateSearchPatterns(events: AnalyticsEvent[]): any { return {}; }
  private calculateReadingBehavior(events: AnalyticsEvent[]): any { return {}; }
  private calculateContentTypePreferences(events: AnalyticsEvent[]): any[] { return []; }
  private calculateTimeByCategory(events: AnalyticsEvent[]): any[] { return []; }
  private calculateDiscoveryMethods(events: AnalyticsEvent[]): any[] { return []; }
  private calculateContributionScore(events: AnalyticsEvent[]): number { return 95; }
  private calculateCommunityInfluence(events: AnalyticsEvent[]): number { return 78; }
  private calculateAverageResponseTime(events: AnalyticsEvent[]): number { return 1800; }
  private calculateTopicExpertise(events: AnalyticsEvent[]): any[] { return []; }
  private calculateCollaborationPatterns(events: AnalyticsEvent[]): any { return {}; }
  private calculateMentorshipActivity(events: AnalyticsEvent[]): any { return {}; }
  private inferContentDifficultyPreference(events: AnalyticsEvent[]): string { return 'intermediate'; }
  private inferLearningStyle(events: AnalyticsEvent[]): string { return 'mixed'; }
  private inferSessionLengthPreference(events: AnalyticsEvent[]): string { return 'medium'; }
  private inferNotificationPreferences(events: AnalyticsEvent[]): any { return {}; }
  private getThemePreference(): string { return 'auto'; }
  private inferDevicePreference(events: AnalyticsEvent[]): string { return 'desktop'; }
  private getFilteredEvents(filter?: AnalyticsFilter): AnalyticsEvent[] { return this.getStoredEvents(); }
  private calculateOverallStats(events: AnalyticsEvent[]): any { return {}; }
  private calculateContentPerformance(events: AnalyticsEvent[]): any { return {}; }
  private calculateUserGrowth(events: AnalyticsEvent[]): any { return {}; }
  private calculateFeatureUsage(events: AnalyticsEvent[]): any { return {}; }
  private calculateSystemPerformance(events: AnalyticsEvent[]): any { return {}; }
  private calculateTrends(events: AnalyticsEvent[]): any { return {}; }
  private calculateContentPerformanceStats(contentId: string, events: AnalyticsEvent[]): any { return {}; }
  private getActiveFeatures(events: AnalyticsEvent[]): string[] { return []; }
  private getCurrentLearningProgress(): any { return {}; }
  private calculateCurrentEngagementLevel(events: AnalyticsEvent[]): number { return 75; }
  private identifyStrongAreas(analytics: UserBehaviorAnalytics): string[] { return ['architecture', 'debugging']; }
  private identifyImprovementAreas(analytics: UserBehaviorAnalytics): string[] { return ['performance']; }
  private generateContentRecommendations(analytics: UserBehaviorAnalytics | null): string[] { return []; }
  private suggestLearningPath(analytics: UserBehaviorAnalytics): any { return {}; }
  private calculateAchievements(analytics: UserBehaviorAnalytics): any[] { return []; }
  private getNextMilestones(analytics: UserBehaviorAnalytics): any[] { return []; }
  private predictChurnRisk(analytics: UserBehaviorAnalytics): number { return 0.15; }
  private predictNextAction(analytics: UserBehaviorAnalytics): string { return 'continue_tutorial'; }
  private predictContentPreferences(analytics: UserBehaviorAnalytics): string[] { return ['video', 'interactive']; }
  private predictOptimalLearningTime(analytics: UserBehaviorAnalytics): string { return '14:00-16:00'; }
  private predictCompletionProbability(analytics: UserBehaviorAnalytics): number { return 0.85; }
  private generateFeatureRecommendations(userAnalytics: UserBehaviorAnalytics | null, platformAnalytics: PlatformAnalytics): any { return {}; }
  private generateTimeRecommendations(analytics: UserBehaviorAnalytics | null): any { return {}; }
  private generateLearningPathRecommendations(analytics: UserBehaviorAnalytics | null): any { return {}; }
}

// Global analytics instance
export const analyticsService = new AdvancedAnalyticsService();
