/**
 * Advanced Analytics Type Definitions
 * Comprehensive analytics system for learning patterns, engagement, and platform insights
 */

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  userId: string;
  timestamp: string;
  sessionId: string;
  data: Record<string, any>;
  metadata: EventMetadata;
}

export type AnalyticsEventType =
  | 'page_view'
  | 'article_read'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'tutorial_step_completed'
  | 'video_played'
  | 'video_paused'
  | 'video_completed'
  | 'search_performed'
  | 'bookmark_added'
  | 'bookmark_removed'
  | 'discussion_created'
  | 'comment_posted'
  | 'reaction_added'
  | 'code_copied'
  | 'diagram_interacted'
  | 'progress_milestone'
  | 'badge_earned'
  | 'session_started'
  | 'session_ended'
  | 'error_occurred'
  | 'feature_used';

export interface EventMetadata {
  userAgent: string;
  platform: string;
  screenResolution: string;
  viewportSize: string;
  connectionType?: string;
  referrer?: string;
  location: {
    pathname: string;
    search: string;
    hash: string;
  };
  performance?: {
    loadTime: number;
    renderTime: number;
  };
}

export interface UserBehaviorAnalytics {
  userId: string;
  sessionStats: SessionStats;
  learningProgress: LearningProgressAnalytics;
  engagementMetrics: EngagementMetrics;
  contentInteraction: ContentInteractionAnalytics;
  communityActivity: CommunityActivityAnalytics;
  preferences: UserPreferenceAnalytics;
}

export interface SessionStats {
  totalSessions: number;
  averageSessionDuration: number;
  longestSession: number;
  shortestSession: number;
  pagesPerSession: number;
  bounceRate: number;
  returningUser: boolean;
  lastActive: string;
  deviceTypes: DeviceTypeStats[];
  timeOfDayPatterns: TimePatternStats[];
}

export interface DeviceTypeStats {
  type: 'desktop' | 'mobile' | 'tablet';
  sessions: number;
  totalTime: number;
  percentage: number;
}

export interface TimePatternStats {
  hour: number;
  sessions: number;
  averageDuration: number;
  activityLevel: 'low' | 'medium' | 'high';
}

export interface LearningProgressAnalytics {
  articlesRead: number;
  tutorialsStarted: number;
  tutorialsCompleted: number;
  videosWatched: number;
  totalLearningTime: number;
  streakDays: number;
  completionRate: number;
  learningVelocity: number; // articles per day
  difficultyProgression: DifficultyProgressionAnalytics;
  topicMastery: TopicMasteryAnalytics[];
  learningPath: LearningPathAnalytics;
}

export interface DifficultyProgressionAnalytics {
  beginner: {
    completed: number;
    total: number;
    averageTime: number;
  };
  intermediate: {
    completed: number;
    total: number;
    averageTime: number;
  };
  advanced: {
    completed: number;
    total: number;
    averageTime: number;
  };
}

export interface TopicMasteryAnalytics {
  topic: string;
  category: string;
  articlesRead: number;
  tutorialsCompleted: number;
  timeSpent: number;
  masteryLevel: number; // 0-100
  lastInteraction: string;
  strongAreas: string[];
  improvementAreas: string[];
}

export interface LearningPathAnalytics {
  currentPath: string;
  pathProgress: number;
  estimatedCompletion: string;
  recommendedNext: string[];
  pathEfficiency: number;
  alternativePathsSuggested: string[];
}

export interface EngagementMetrics {
  totalInteractions: number;
  bookmarksCreated: number;
  commentsPosted: number;
  discussionsCreated: number;
  reactionsGiven: number;
  sharesPerformed: number;
  feedbackProvided: number;
  helpfulnessRating: number;
  communityReputation: number;
  engagementScore: number; // 0-100
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface ContentInteractionAnalytics {
  mostViewedContent: ContentViewStats[];
  searchPatterns: SearchPatternAnalytics;
  readingBehavior: ReadingBehaviorAnalytics;
  preferredContentTypes: ContentTypePreference[];
  timeSpentByCategory: CategoryTimeStats[];
  contentDiscoveryMethods: DiscoveryMethodStats[];
}

export interface ContentViewStats {
  contentId: string;
  title: string;
  category: string;
  views: number;
  totalTime: number;
  averageTime: number;
  completionRate: number;
  returnVisits: number;
  lastViewed: string;
}

export interface SearchPatternAnalytics {
  totalSearches: number;
  successfulSearches: number;
  averageResultsClicked: number;
  commonQueries: SearchQueryStats[];
  searchTiming: SearchTimingStats;
  refinementPatterns: SearchRefinementStats[];
}

export interface SearchQueryStats {
  query: string;
  frequency: number;
  successRate: number;
  averageClickPosition: number;
  lastUsed: string;
}

export interface SearchTimingStats {
  averageSearchTime: number;
  timeToFirstClick: number;
  timeToFindAnswer: number;
  searchSessionLength: number;
}

export interface SearchRefinementStats {
  originalQuery: string;
  refinedQuery: string;
  improvementType: 'more_specific' | 'broader' | 'different_terms';
  frequency: number;
}

export interface ReadingBehaviorAnalytics {
  averageReadingSpeed: number; // words per minute
  scrollPatterns: ScrollPatternAnalytics;
  attentionSpan: AttentionSpanAnalytics;
  preferredReadingTimes: TimePreferenceStats[];
  interactionHotspots: InteractionHotspotStats[];
}

export interface ScrollPatternAnalytics {
  averageScrollDepth: number;
  fastScrollSections: string[];
  slowScrollSections: string[];
  backtrackingPatterns: BacktrackPattern[];
}

export interface BacktrackPattern {
  fromSection: string;
  toSection: string;
  frequency: number;
  averageTime: number;
}

export interface AttentionSpanAnalytics {
  averageFocusTime: number;
  distractionEvents: number;
  focusRecoveryTime: number;
  optimalContentLength: number;
  attentionDropoffPoints: AttentionDropoffPoint[];
}

export interface AttentionDropoffPoint {
  position: number; // percentage through content
  frequency: number;
  contentType: string;
  commonReasons: string[];
}

export interface TimePreferenceStats {
  timeSlot: string;
  readingEfficiency: number;
  comprehensionRate: number;
  engagement: number;
}

export interface InteractionHotspotStats {
  elementType: string;
  position: string;
  interactionRate: number;
  averageTimeToInteract: number;
}

export interface ContentTypePreference {
  type: 'article' | 'tutorial' | 'video' | 'diagram' | 'code_example';
  preference: number; // 0-100
  timeSpent: number;
  completionRate: number;
  engagementScore: number;
}

export interface CategoryTimeStats {
  category: string;
  totalTime: number;
  sessionCount: number;
  averageSessionTime: number;
  growthRate: number;
}

export interface DiscoveryMethodStats {
  method: 'search' | 'navigation' | 'recommendation' | 'bookmark' | 'link' | 'direct';
  frequency: number;
  successRate: number;
  averageEngagementTime: number;
}

export interface CommunityActivityAnalytics {
  contributionScore: number;
  helpfulnessRating: number;
  communityInfluence: number;
  responseTime: number;
  topicExpertise: TopicExpertiseStats[];
  collaborationPatterns: CollaborationPatternStats;
  mentorshipActivity: MentorshipActivityStats;
}

export interface TopicExpertiseStats {
  topic: string;
  expertiseLevel: number; // 0-100
  contributionsCount: number;
  upvotesReceived: number;
  questionsAnswered: number;
  recognitionScore: number;
}

export interface CollaborationPatternStats {
  projectsParticipated: number;
  codeReviewsGiven: number;
  codeReviewsReceived: number;
  mentoringSessions: number;
  knowledgeSharingEvents: number;
  networkSize: number;
  collaborationEffectiveness: number;
}

export interface MentorshipActivityStats {
  menteesHelped: number;
  mentorsInteractedWith: number;
  knowledgeTransferRate: number;
  feedbackQuality: number;
  learningAcceleration: number;
}

export interface UserPreferenceAnalytics {
  contentDifficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  learningStyle: 'visual' | 'textual' | 'interactive' | 'mixed';
  sessionLength: 'short' | 'medium' | 'long' | 'mixed';
  notificationPreferences: NotificationPreferenceStats;
  themePreference: 'light' | 'dark' | 'auto';
  devicePreference: 'desktop' | 'mobile' | 'tablet' | 'mixed';
}

export interface NotificationPreferenceStats {
  emailNotifications: boolean;
  pushNotifications: boolean;
  communityUpdates: boolean;
  learningReminders: boolean;
  optimalNotificationTime: string;
  notificationEngagementRate: number;
}

export interface PlatformAnalytics {
  overallStats: PlatformOverallStats;
  contentPerformance: ContentPerformanceAnalytics;
  userGrowth: UserGrowthAnalytics;
  featureUsage: FeatureUsageAnalytics;
  systemPerformance: SystemPerformanceAnalytics;
  trends: TrendAnalytics;
}

export interface PlatformOverallStats {
  totalUsers: number;
  activeUsers: UserActivityStats;
  contentMetrics: ContentMetricsStats;
  engagementMetrics: PlatformEngagementStats;
  retentionMetrics: RetentionMetricsStats;
  satisfactionMetrics: SatisfactionMetricsStats;
}

export interface UserActivityStats {
  daily: number;
  weekly: number;
  monthly: number;
  returning: number;
  newUsers: number;
  churned: number;
}

export interface ContentMetricsStats {
  totalArticles: number;
  totalTutorials: number;
  totalVideos: number;
  totalDiscussions: number;
  contentViews: number;
  contentCompletions: number;
}

export interface PlatformEngagementStats {
  averageSessionDuration: number;
  pagesPerSession: number;
  bounceRate: number;
  interactionRate: number;
  communityParticipation: number;
  learningCompletion: number;
}

export interface RetentionMetricsStats {
  day1Retention: number;
  day7Retention: number;
  day30Retention: number;
  cohortRetention: CohortRetentionStats[];
  churnRate: number;
  reactivationRate: number;
}

export interface CohortRetentionStats {
  cohort: string;
  size: number;
  retention: {
    week1: number;
    week2: number;
    week4: number;
    week8: number;
    week12: number;
  };
}

export interface SatisfactionMetricsStats {
  npsScore: number;
  satisfactionRating: number;
  featuresSatisfaction: FeatureSatisfactionStats[];
  supportSatisfaction: number;
  recommendationRate: number;
}

export interface FeatureSatisfactionStats {
  feature: string;
  satisfactionScore: number;
  usageRate: number;
  improvementRequests: number;
}

export interface ContentPerformanceAnalytics {
  topPerformingContent: ContentPerformanceStats[];
  underperformingContent: ContentPerformanceStats[];
  contentGaps: ContentGapAnalysis[];
  contentOptimizationSuggestions: ContentOptimizationSuggestion[];
}

export interface ContentPerformanceStats {
  contentId: string;
  title: string;
  category: string;
  performance: {
    views: number;
    engagement: number;
    completion: number;
    satisfaction: number;
    shareability: number;
  };
  metrics: {
    averageTimeSpent: number;
    bounceRate: number;
    returnRate: number;
    conversionRate: number;
  };
  trends: {
    viewTrend: 'increasing' | 'stable' | 'decreasing';
    engagementTrend: 'increasing' | 'stable' | 'decreasing';
  };
}

export interface ContentGapAnalysis {
  topic: string;
  demandScore: number;
  currentCoverage: number;
  gap: number;
  userRequests: number;
  searchVolume: number;
  competitorCoverage: number;
  recommendedAction: 'create' | 'expand' | 'update' | 'reorganize';
}

export interface ContentOptimizationSuggestion {
  contentId: string;
  type: 'improve_engagement' | 'reduce_bounce' | 'increase_completion' | 'enhance_clarity';
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface UserGrowthAnalytics {
  acquisitionChannels: AcquisitionChannelStats[];
  growthRate: GrowthRateStats;
  userSegments: UserSegmentStats[];
  conversionFunnels: ConversionFunnelStats[];
}

export interface AcquisitionChannelStats {
  channel: string;
  users: number;
  conversionRate: number;
  retentionRate: number;
  ltv: number; // lifetime value
  cac: number; // customer acquisition cost
}

export interface GrowthRateStats {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearOverYear: number;
  forecast: GrowthForecastStats;
}

export interface GrowthForecastStats {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
}

export interface UserSegmentStats {
  segment: string;
  size: number;
  growthRate: number;
  engagement: number;
  retention: number;
  value: number;
  characteristics: string[];
}

export interface ConversionFunnelStats {
  funnel: string;
  stages: ConversionStageStats[];
  overallConversion: number;
  dropoffPoints: DropoffPointStats[];
}

export interface ConversionStageStats {
  stage: string;
  users: number;
  conversionRate: number;
  averageTime: number;
}

export interface DropoffPointStats {
  stage: string;
  dropoffRate: number;
  commonReasons: string[];
  improvementOpportunities: string[];
}

export interface FeatureUsageAnalytics {
  featureAdoption: FeatureAdoptionStats[];
  featureEngagement: FeatureEngagementStats[];
  featurePerformance: FeaturePerformanceStats[];
  experimentResults: ExperimentResultStats[];
}

export interface FeatureAdoptionStats {
  feature: string;
  adoptionRate: number;
  timeToAdopt: number;
  userSegmentAdoption: SegmentAdoptionStats[];
  adoptionTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface SegmentAdoptionStats {
  segment: string;
  adoptionRate: number;
  engagementLevel: number;
}

export interface FeatureEngagementStats {
  feature: string;
  usageFrequency: number;
  sessionDuration: number;
  userSatisfaction: number;
  powerUsers: number;
  casualUsers: number;
}

export interface FeaturePerformanceStats {
  feature: string;
  performanceScore: number;
  loadTime: number;
  errorRate: number;
  userReports: number;
  technicalMetrics: TechnicalMetricsStats;
}

export interface TechnicalMetricsStats {
  availability: number;
  responseTime: number;
  throughput: number;
  errorLogs: ErrorLogStats[];
}

export interface ErrorLogStats {
  error: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impactedUsers: number;
  resolutionTime: number;
}

export interface ExperimentResultStats {
  experiment: string;
  status: 'planning' | 'running' | 'completed' | 'paused';
  variants: ExperimentVariantStats[];
  results: ExperimentResultData;
  insights: string[];
  recommendations: string[];
}

export interface ExperimentVariantStats {
  variant: string;
  users: number;
  conversionRate: number;
  engagement: number;
  significance: number;
}

export interface ExperimentResultData {
  winningVariant: string;
  confidenceLevel: number;
  uplift: number;
  statisticalSignificance: boolean;
  businessImpact: string;
}

export interface SystemPerformanceAnalytics {
  performanceMetrics: SystemPerformanceMetrics;
  resourceUsage: ResourceUsageStats;
  scalabilityMetrics: ScalabilityMetricsStats;
  reliabilityMetrics: ReliabilityMetricsStats;
}

export interface SystemPerformanceMetrics {
  averageLoadTime: number;
  p95LoadTime: number;
  p99LoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

export interface ResourceUsageStats {
  bandwidth: BandwidthUsageStats;
  storage: StorageUsageStats;
  processing: ProcessingUsageStats;
}

export interface BandwidthUsageStats {
  totalUsage: number;
  averagePerUser: number;
  peakUsage: number;
  contentTypeBreakdown: ContentTypeUsageStats[];
}

export interface ContentTypeUsageStats {
  type: string;
  usage: number;
  percentage: number;
}

export interface StorageUsageStats {
  totalStorage: number;
  userDataStorage: number;
  contentStorage: number;
  analyticsStorage: number;
  growthRate: number;
}

export interface ProcessingUsageStats {
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
  networkIO: number;
}

export interface ScalabilityMetricsStats {
  currentCapacity: number;
  utilizationRate: number;
  scalingEvents: ScalingEventStats[];
  bottlenecks: BottleneckStats[];
}

export interface ScalingEventStats {
  timestamp: string;
  type: 'scale_up' | 'scale_down';
  reason: string;
  impact: string;
  duration: number;
}

export interface BottleneckStats {
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impactedFeatures: string[];
  recommendedActions: string[];
}

export interface ReliabilityMetricsStats {
  uptime: number;
  availability: number;
  errorRate: number;
  mttr: number; // mean time to recovery
  mtbf: number; // mean time between failures
  incidentStats: IncidentStats[];
}

export interface IncidentStats {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  startTime: string;
  resolutionTime: string;
  duration: number;
  impactedUsers: number;
  rootCause: string;
  resolution: string;
}

export interface TrendAnalytics {
  userBehaviorTrends: UserBehaviorTrendStats[];
  contentTrends: ContentTrendStats[];
  technologyTrends: TechnologyTrendStats[];
  seasonalPatterns: SeasonalPatternStats[];
  predictiveInsights: PredictiveInsightStats[];
}

export interface UserBehaviorTrendStats {
  trend: string;
  description: string;
  timeframe: string;
  strength: number;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  recommendations: string[];
}

export interface ContentTrendStats {
  topic: string;
  interest: number;
  growth: number;
  sustainability: number;
  competitiveness: number;
  opportunity: number;
}

export interface TechnologyTrendStats {
  technology: string;
  adoptionRate: number;
  maturity: 'emerging' | 'growing' | 'mature' | 'declining';
  relevanceScore: number;
  learningDemand: number;
}

export interface SeasonalPatternStats {
  pattern: string;
  season: string;
  impact: number;
  recurrence: number;
  confidence: number;
  businessImplications: string[];
}

export interface PredictiveInsightStats {
  insight: string;
  prediction: string;
  timeframe: string;
  confidence: number;
  potentialImpact: string;
  recommendedActions: string[];
  metrics: PredictiveMetrics;
}

export interface PredictiveMetrics {
  userGrowth: number;
  engagementChange: number;
  retentionChange: number;
  contentDemand: ContentDemandPrediction[];
}

export interface ContentDemandPrediction {
  topic: string;
  currentDemand: number;
  predictedDemand: number;
  confidenceInterval: [number, number];
  factors: string[];
}

export interface AnalyticsFilter {
  dateRange: {
    start: string;
    end: string;
  };
  userSegments?: string[];
  contentCategories?: string[];
  deviceTypes?: string[];
  geographies?: string[];
  customFilters?: Record<string, any>;
}

export interface AnalyticsQuery {
  metrics: string[];
  dimensions: string[];
  filters: AnalyticsFilter;
  groupBy?: string[];
  sortBy?: {
    metric: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  description: string;
  type: 'dashboard' | 'detailed' | 'summary' | 'alert';
  frequency: 'real_time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  query: AnalyticsQuery;
  visualizations: VisualizationConfig[];
  generatedAt: string;
  nextUpdate: string;
}

export interface VisualizationConfig {
  type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'heatmap' | 'table' | 'metric_card' | 'funnel' | 'cohort';
  title: string;
  data: any;
  options: VisualizationOptions;
}

export interface VisualizationOptions {
  colors?: string[];
  responsive?: boolean;
  interactive?: boolean;
  showLegend?: boolean;
  showTooltips?: boolean;
  animations?: boolean;
  customOptions?: Record<string, any>;
}
