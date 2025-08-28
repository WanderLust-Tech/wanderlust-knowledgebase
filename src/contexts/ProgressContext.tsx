import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export interface ReadingProgress {
  path: string;
  title: string;
  category: string;
  progress: number; // 0-100 percentage
  timeSpent: number; // in minutes
  lastVisited: Date;
  completed: boolean;
  scrollPosition: number;
  estimatedReadTime?: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  articles: string[]; // array of article paths
  completedArticles: string[];
  progress: number; // 0-100 percentage
  estimatedTotalTime: number; // in minutes
  timeSpent: number;
  created: Date;
  lastAccessed: Date;
}

export interface ProgressStats {
  totalArticlesRead: number;
  totalTimeSpent: number; // in minutes
  categoriesExplored: string[];
  currentStreak: number; // days
  longestStreak: number; // days
  lastReadDate: Date;
  averageReadingSpeed: number; // words per minute
  completedPaths: number;
  totalProgress: number; // 0-100 overall platform progress
}

interface ProgressContextType {
  readingProgress: ReadingProgress[];
  learningPaths: LearningPath[];
  stats: ProgressStats;
  
  // Reading progress methods
  updateReadingProgress: (path: string, progress: number, scrollPosition?: number) => void;
  markArticleCompleted: (path: string) => void;
  getArticleProgress: (path: string) => ReadingProgress | undefined;
  
  // Learning path methods
  createLearningPath: (path: Omit<LearningPath, 'id' | 'created' | 'lastAccessed' | 'completedArticles' | 'progress' | 'timeSpent'>) => void;
  updateLearningPath: (pathId: string, updates: Partial<LearningPath>) => void;
  deleteLearningPath: (pathId: string) => void;
  addToLearningPath: (pathId: string, articlePath: string) => void;
  removeFromLearningPath: (pathId: string, articlePath: string) => void;
  
  // Analytics methods
  getWeeklyProgress: () => { date: string; articlesRead: number; timeSpent: number }[];
  getCategoryProgress: () => { category: string; progress: number; timeSpent: number }[];
  getRecommendedArticles: () => string[];
  
  // Data management
  exportProgress: () => string;
  importProgress: (data: string) => void;
  clearAllProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

const STORAGE_KEYS = {
  READING_PROGRESS: 'wanderlust-reading-progress',
  LEARNING_PATHS: 'wanderlust-learning-paths',
  PROGRESS_STATS: 'wanderlust-progress-stats',
} as const;

// Helper function to estimate reading time (words per minute)
const estimateReadingTime = (content: string): number => {
  const wordsPerMinute = 200; // Average reading speed
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

// Helper function to get category from path
const getCategoryFromPath = (path: string): string => {
  const parts = path.split('/');
  return parts[0] || 'general';
};

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [stats, setStats] = useState<ProgressStats>({
    totalArticlesRead: 0,
    totalTimeSpent: 0,
    categoriesExplored: [],
    currentStreak: 0,
    longestStreak: 0,
    lastReadDate: new Date(),
    averageReadingSpeed: 200,
    completedPaths: 0,
    totalProgress: 0,
  });

  // Session tracking
  const [sessionStart, setSessionStart] = useState<Date>(new Date());
  const [currentArticle, setCurrentArticle] = useState<string | null>(null);

  // Generate user-specific storage keys
  const getUserStorageKeys = () => {
    const userId = user?.id || 'anonymous';
    return {
      READING_PROGRESS: `wanderlust-reading-progress-${userId}`,
      LEARNING_PATHS: `wanderlust-learning-paths-${userId}`,
      PROGRESS_STATS: `wanderlust-progress-stats-${userId}`,
    };
  };

  // Load data from localStorage on mount and when authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear data when not authenticated
      setReadingProgress([]);
      setLearningPaths([]);
      setStats({
        totalArticlesRead: 0,
        totalTimeSpent: 0,
        categoriesExplored: [],
        currentStreak: 0,
        longestStreak: 0,
        lastReadDate: new Date(),
        averageReadingSpeed: 200,
        completedPaths: 0,
        totalProgress: 0,
      });
      return;
    }

    try {
      const userStorageKeys = getUserStorageKeys();
      const savedProgress = localStorage.getItem(userStorageKeys.READING_PROGRESS);
      const savedPaths = localStorage.getItem(userStorageKeys.LEARNING_PATHS);
      const savedStats = localStorage.getItem(userStorageKeys.PROGRESS_STATS);

      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        // Convert date strings back to Date objects
        const processedProgress = progress.map((p: any) => ({
          ...p,
          lastVisited: new Date(p.lastVisited),
        }));
        setReadingProgress(processedProgress);
      }

      if (savedPaths) {
        const paths = JSON.parse(savedPaths);
        const processedPaths = paths.map((p: any) => ({
          ...p,
          created: new Date(p.created),
          lastAccessed: new Date(p.lastAccessed),
        }));
        setLearningPaths(processedPaths);
      }

      if (savedStats) {
        const statsData = JSON.parse(savedStats);
        setStats({
          ...statsData,
          lastReadDate: new Date(statsData.lastReadDate),
          // Ensure totalProgress is never NaN
          totalProgress: isNaN(statsData.totalProgress) ? 0 : statsData.totalProgress,
        });
      }
    } catch (error) {
      console.error('Error loading progress data:', error);
    }
  }, [isAuthenticated, user]);

  // Save data to localStorage when state changes (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    try {
      const userStorageKeys = getUserStorageKeys();
      localStorage.setItem(userStorageKeys.READING_PROGRESS, JSON.stringify(readingProgress));
    } catch (error) {
      console.error('Error saving reading progress:', error);
    }
  }, [readingProgress, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    try {
      const userStorageKeys = getUserStorageKeys();
      localStorage.setItem(userStorageKeys.LEARNING_PATHS, JSON.stringify(learningPaths));
    } catch (error) {
      console.error('Error saving learning paths:', error);
    }
  }, [learningPaths, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    try {
      const userStorageKeys = getUserStorageKeys();
      localStorage.setItem(userStorageKeys.PROGRESS_STATS, JSON.stringify(stats));
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }, [stats, isAuthenticated, user]);

  // Track time spent on current article
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentArticle) {
        const timeSpent = Math.floor((new Date().getTime() - sessionStart.getTime()) / (1000 * 60));
        if (timeSpent > 0) {
          updateReadingProgress(currentArticle, -1, -1, timeSpent);
        }
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [currentArticle, sessionStart]);

  const updateReadingProgress = (
    path: string, 
    progress: number, 
    scrollPosition: number = -1,
    additionalTime: number = 0
  ) => {
    // Only track progress for authenticated users
    if (!isAuthenticated) return;
    
    setReadingProgress(prev => {
      const existing = prev.find(p => p.path === path);
      const now = new Date();
      
      if (existing) {
        return prev.map(p => 
          p.path === path 
            ? {
                ...p,
                progress: progress >= 0 ? Math.max(p.progress, progress) : p.progress,
                scrollPosition: scrollPosition >= 0 ? scrollPosition : p.scrollPosition,
                timeSpent: p.timeSpent + additionalTime,
                lastVisited: now,
                completed: progress >= 95 ? true : p.completed,
              }
            : p
        );
      } else {
        // Create new progress entry
        const category = getCategoryFromPath(path);
        const newProgress: ReadingProgress = {
          path,
          title: path.split('/').pop()?.replace(/-/g, ' ') || 'Unknown',
          category,
          progress: Math.max(0, progress),
          timeSpent: additionalTime,
          lastVisited: now,
          completed: progress >= 95,
          scrollPosition: Math.max(0, scrollPosition),
        };
        
        return [...prev, newProgress];
      }
    });

    // Update current article tracking
    if (path !== currentArticle) {
      setCurrentArticle(path);
      setSessionStart(new Date());
    }

    // Update stats
    updateStats(path);
  };

  const markArticleCompleted = (path: string) => {
    if (!isAuthenticated) return;
    
    updateReadingProgress(path, 100);
    
    // Update learning paths
    setLearningPaths(prev => 
      prev.map(lp => {
        if (lp.articles.includes(path) && !lp.completedArticles.includes(path)) {
          const newCompleted = [...lp.completedArticles, path];
          const newProgress = (newCompleted.length / lp.articles.length) * 100;
          
          return {
            ...lp,
            completedArticles: newCompleted,
            progress: newProgress,
            lastAccessed: new Date(),
          };
        }
        return lp;
      })
    );
  };

  const getArticleProgress = (path: string): ReadingProgress | undefined => {
    if (!isAuthenticated) return undefined;
    return readingProgress.find(p => p.path === path);
  };

  const createLearningPath = (pathData: Omit<LearningPath, 'id' | 'created' | 'lastAccessed' | 'completedArticles' | 'progress' | 'timeSpent'>) => {
    if (!isAuthenticated) return;
    
    const newPath: LearningPath = {
      ...pathData,
      id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      completedArticles: [],
      progress: 0,
      timeSpent: 0,
      created: new Date(),
      lastAccessed: new Date(),
    };
    
    setLearningPaths(prev => [...prev, newPath]);
  };

  const updateLearningPath = (pathId: string, updates: Partial<LearningPath>) => {
    setLearningPaths(prev => 
      prev.map(p => 
        p.id === pathId 
          ? { ...p, ...updates, lastAccessed: new Date() }
          : p
      )
    );
  };

  const deleteLearningPath = (pathId: string) => {
    setLearningPaths(prev => prev.filter(p => p.id !== pathId));
  };

  const addToLearningPath = (pathId: string, articlePath: string) => {
    updateLearningPath(pathId, {
      articles: learningPaths.find(p => p.id === pathId)?.articles.concat(articlePath) || [articlePath],
    });
  };

  const removeFromLearningPath = (pathId: string, articlePath: string) => {
    const path = learningPaths.find(p => p.id === pathId);
    if (path) {
      updateLearningPath(pathId, {
        articles: path.articles.filter(a => a !== articlePath),
        completedArticles: path.completedArticles.filter(a => a !== articlePath),
      });
    }
  };

  const updateStats = (currentPath: string) => {
    setStats(prev => {
      const category = getCategoryFromPath(currentPath);
      const categoriesExplored = Array.from(new Set([...prev.categoriesExplored, category]));
      const totalArticlesRead = readingProgress.filter(p => p.completed).length;
      const totalTimeSpent = readingProgress.reduce((sum, p) => sum + p.timeSpent, 0);
      
      // Calculate streak
      const today = new Date();
      const lastRead = prev.lastReadDate;
      const daysDiff = Math.floor((today.getTime() - lastRead.getTime()) / (1000 * 60 * 60 * 24));
      
      let currentStreak = prev.currentStreak;
      if (daysDiff === 0) {
        // Same day, maintain streak
      } else if (daysDiff === 1) {
        // Next day, increment streak
        currentStreak += 1;
      } else {
        // Gap in reading, reset streak
        currentStreak = 1;
      }

      const longestStreak = Math.max(prev.longestStreak, currentStreak);
      const completedPaths = learningPaths.filter(p => p.progress >= 100).length;
      const overallProgress = calculateOverallProgress();

      return {
        ...prev,
        totalArticlesRead: isNaN(totalArticlesRead) ? 0 : totalArticlesRead,
        totalTimeSpent: isNaN(totalTimeSpent) ? 0 : totalTimeSpent,
        categoriesExplored,
        currentStreak: isNaN(currentStreak) ? 0 : currentStreak,
        longestStreak: isNaN(longestStreak) ? 0 : longestStreak,
        lastReadDate: today,
        completedPaths: isNaN(completedPaths) ? 0 : completedPaths,
        totalProgress: isNaN(overallProgress) ? 0 : overallProgress,
      };
    });
  };

  const calculateOverallProgress = (): number => {
    // This would ideally be based on total available content
    // For now, we'll estimate based on categories explored and articles read
    const totalEstimatedArticles = 50; // Estimate based on your content
    const completedArticles = readingProgress.filter(p => p.completed).length;
    const progress = Math.min(100, (completedArticles / totalEstimatedArticles) * 100);
    
    // Ensure we never return NaN
    return isNaN(progress) ? 0 : progress;
  };

  const getWeeklyProgress = () => {
    const weeks = 7;
    const result = [];
    const today = new Date();
    
    for (let i = weeks - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayProgress = readingProgress.filter(p => {
        const progressDate = new Date(p.lastVisited);
        return progressDate.toISOString().split('T')[0] === dateStr;
      });
      
      result.push({
        date: dateStr,
        articlesRead: dayProgress.length,
        timeSpent: dayProgress.reduce((sum, p) => sum + p.timeSpent, 0),
      });
    }
    
    return result;
  };

  const getCategoryProgress = () => {
    const categories = stats.categoriesExplored;
    return categories.map(category => {
      const categoryProgress = readingProgress.filter(p => p.category === category);
      const completed = categoryProgress.filter(p => p.completed).length;
      const total = categoryProgress.length;
      const timeSpent = categoryProgress.reduce((sum, p) => sum + p.timeSpent, 0);
      
      return {
        category,
        progress: total > 0 ? (completed / total) * 100 : 0,
        timeSpent,
      };
    });
  };

  const getRecommendedArticles = (): string[] => {
    // Simple recommendation based on categories explored and incomplete articles
    const exploredCategories = stats.categoriesExplored;
    const incompleteArticles = readingProgress
      .filter(p => !p.completed && p.progress > 10)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3)
      .map(p => p.path);
    
    return incompleteArticles;
  };

  const exportProgress = (): string => {
    if (!isAuthenticated) return JSON.stringify({}, null, 2);
    
    return JSON.stringify({
      readingProgress,
      learningPaths,
      stats,
      exportDate: new Date().toISOString(),
      userId: user?.id,
    }, null, 2);
  };

  const importProgress = (data: string) => {
    if (!isAuthenticated) return;
    
    try {
      const imported = JSON.parse(data);
      
      if (imported.readingProgress) {
        setReadingProgress(imported.readingProgress.map((p: any) => ({
          ...p,
          lastVisited: new Date(p.lastVisited),
        })));
      }
      
      if (imported.learningPaths) {
        setLearningPaths(imported.learningPaths.map((p: any) => ({
          ...p,
          created: new Date(p.created),
          lastAccessed: new Date(p.lastAccessed),
        })));
      }
      
      if (imported.stats) {
        setStats({
          ...imported.stats,
          lastReadDate: new Date(imported.stats.lastReadDate),
        });
      }
    } catch (error) {
      console.error('Error importing progress data:', error);
      throw new Error('Invalid progress data format');
    }
  };

  const clearAllProgress = () => {
    if (!isAuthenticated) return;
    
    setReadingProgress([]);
    setLearningPaths([]);
    setStats({
      totalArticlesRead: 0,
      totalTimeSpent: 0,
      categoriesExplored: [],
      currentStreak: 0,
      longestStreak: 0,
      lastReadDate: new Date(),
      averageReadingSpeed: 200,
      completedPaths: 0,
      totalProgress: 0,
    });
    
    // Clear user-specific localStorage
    const userStorageKeys = getUserStorageKeys();
    Object.values(userStorageKeys).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  // Function to repair any corrupt data
  const repairCorruptData = () => {
    setStats(prev => ({
      ...prev,
      totalArticlesRead: isNaN(prev.totalArticlesRead) ? 0 : prev.totalArticlesRead,
      totalTimeSpent: isNaN(prev.totalTimeSpent) ? 0 : prev.totalTimeSpent,
      currentStreak: isNaN(prev.currentStreak) ? 0 : prev.currentStreak,
      longestStreak: isNaN(prev.longestStreak) ? 0 : prev.longestStreak,
      averageReadingSpeed: isNaN(prev.averageReadingSpeed) ? 200 : prev.averageReadingSpeed,
      completedPaths: isNaN(prev.completedPaths) ? 0 : prev.completedPaths,
      totalProgress: isNaN(prev.totalProgress) ? 0 : prev.totalProgress,
    }));
  };

  // Auto-repair corrupt data on load
  useEffect(() => {
    repairCorruptData();
  }, [readingProgress, learningPaths]);

  const value: ProgressContextType = {
    readingProgress,
    learningPaths,
    stats,
    updateReadingProgress,
    markArticleCompleted,
    getArticleProgress,
    createLearningPath,
    updateLearningPath,
    deleteLearningPath,
    addToLearningPath,
    removeFromLearningPath,
    getWeeklyProgress,
    getCategoryProgress,
    getRecommendedArticles,
    exportProgress,
    importProgress,
    clearAllProgress,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};
