// Video Tutorial System Types
// Comprehensive type definitions for video-based learning experiences

export interface VideoChapter {
  id: string;
  title: string;
  startTime: number; // seconds
  endTime: number; // seconds
  description?: string;
  keyPoints: string[];
  relatedCode?: string; // Code snippet ID
  quiz?: ChapterQuiz;
}

export interface ChapterQuiz {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number; // total duration in seconds
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  
  // Learning structure
  learningObjectives: string[];
  prerequisites: string[];
  chapters: VideoChapter[];
  
  // Related content
  relatedTutorials: string[];
  relatedArticles: string[];
  codeExamples: VideoCodeExample[];
  
  // Metadata
  author: string;
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
  transcript?: string;
}

export interface VideoCodeExample {
  id: string;
  title: string;
  language: string;
  code: string;
  description: string;
  chapterIds: string[]; // Which chapters this code relates to
  filename?: string;
  runnable: boolean;
}

export interface VideoProgress {
  tutorialId: string;
  currentTime: number;
  completed: boolean;
  watchTime: number; // total time watched
  completedChapters: string[];
  quizScores: { [chapterId: string]: number };
  lastWatched: Date;
  notes: VideoNote[];
}

export interface VideoNote {
  id: string;
  timestamp: number;
  content: string;
  isPrivate: boolean;
  createdAt: Date;
}

export interface VideoPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFullscreen: boolean;
  showControls: boolean;
  bufferedRanges: TimeRanges;
}

export interface VideoPlayerSettings {
  autoplay: boolean;
  showChapterMarkers: boolean;
  showTranscript: boolean;
  enableNotes: boolean;
  playbackRates: number[];
  defaultQuality: string;
  enableKeyboardShortcuts: boolean;
}

// Video Tutorial Collection/Series
export interface VideoSeries {
  id: string;
  title: string;
  description: string;
  tutorials: string[]; // Tutorial IDs in order
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  thumbnailUrl?: string;
}

// Analytics and tracking
export interface VideoAnalytics {
  tutorialId: string;
  totalViews: number;
  averageWatchTime: number;
  completionRate: number;
  dropOffPoints: number[]; // Timestamps where users commonly stop
  popularChapters: string[];
  quizPerformance: { [chapterId: string]: number };
}

// Search and discovery
export interface VideoSearchResult {
  tutorial: VideoTutorial;
  relevanceScore: number;
  matchedChapters: VideoChapter[];
  timecodesToHighlight: number[];
}
