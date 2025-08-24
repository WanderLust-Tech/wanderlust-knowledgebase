// Video Progress Manager
// Handles video tutorial progress tracking and persistence

import { VideoProgress, VideoNote, VideoTutorial } from '../types/VideoTypes';

export class VideoProgressManager {
  private static readonly STORAGE_KEY = 'wanderlust-video-progress';
  private static readonly NOTES_STORAGE_KEY = 'wanderlust-video-notes';

  // Progress tracking
  static async getProgress(tutorialId: string): Promise<VideoProgress | null> {
    try {
      const allProgress = this.getAllProgress();
      return allProgress[tutorialId] || null;
    } catch (error) {
      console.error('Failed to get video progress:', error);
      return null;
    }
  }

  static async saveProgress(progress: VideoProgress): Promise<void> {
    try {
      const allProgress = this.getAllProgress();
      allProgress[progress.tutorialId] = {
        ...progress,
        lastWatched: new Date()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Failed to save video progress:', error);
    }
  }

  static async updateWatchTime(tutorialId: string, currentTime: number, totalWatchTime: number): Promise<void> {
    const progress = await this.getProgress(tutorialId) || this.createInitialProgress(tutorialId);
    
    progress.currentTime = currentTime;
    progress.watchTime = totalWatchTime;
    progress.lastWatched = new Date();
    
    await this.saveProgress(progress);
  }

  static async markChapterComplete(tutorialId: string, chapterId: string): Promise<void> {
    const progress = await this.getProgress(tutorialId) || this.createInitialProgress(tutorialId);
    
    if (!progress.completedChapters.includes(chapterId)) {
      progress.completedChapters.push(chapterId);
    }
    
    await this.saveProgress(progress);
  }

  static async markTutorialComplete(tutorialId: string): Promise<void> {
    const progress = await this.getProgress(tutorialId) || this.createInitialProgress(tutorialId);
    
    progress.completed = true;
    progress.lastWatched = new Date();
    
    await this.saveProgress(progress);
  }

  // Quiz scoring
  static async saveQuizScore(tutorialId: string, chapterId: string, score: number): Promise<void> {
    const progress = await this.getProgress(tutorialId) || this.createInitialProgress(tutorialId);
    
    progress.quizScores[chapterId] = score;
    
    await this.saveProgress(progress);
  }

  // Notes management
  static async addNote(tutorialId: string, note: Omit<VideoNote, 'id' | 'createdAt'>): Promise<string> {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullNote: VideoNote = {
      ...note,
      id: noteId,
      createdAt: new Date()
    };

    const progress = await this.getProgress(tutorialId) || this.createInitialProgress(tutorialId);
    progress.notes.push(fullNote);
    
    await this.saveProgress(progress);
    return noteId;
  }

  static async updateNote(tutorialId: string, noteId: string, content: string): Promise<void> {
    const progress = await this.getProgress(tutorialId);
    if (!progress) return;

    const note = progress.notes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      await this.saveProgress(progress);
    }
  }

  static async deleteNote(tutorialId: string, noteId: string): Promise<void> {
    const progress = await this.getProgress(tutorialId);
    if (!progress) return;

    progress.notes = progress.notes.filter(n => n.id !== noteId);
    await this.saveProgress(progress);
  }

  static async getNotesForTimestamp(tutorialId: string, timestamp: number, tolerance: number = 5): Promise<VideoNote[]> {
    const progress = await this.getProgress(tutorialId);
    if (!progress) return [];

    return progress.notes.filter(note => 
      Math.abs(note.timestamp - timestamp) <= tolerance
    );
  }

  // Analytics and insights
  static getWatchHistory(): VideoProgress[] {
    const allProgress = this.getAllProgress();
    return Object.values(allProgress)
      .sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime());
  }

  static getCompletedTutorials(): VideoProgress[] {
    return this.getWatchHistory().filter(progress => progress.completed);
  }

  static getTotalWatchTime(): number {
    return this.getWatchHistory().reduce((total, progress) => total + progress.watchTime, 0);
  }

  static getAverageCompletionRate(): number {
    const history = this.getWatchHistory();
    if (history.length === 0) return 0;
    
    const completedCount = history.filter(p => p.completed).length;
    return (completedCount / history.length) * 100;
  }

  // Recommendations
  static getRecommendedTutorials(allTutorials: VideoTutorial[]): VideoTutorial[] {
    const watchHistory = this.getWatchHistory();
    const completedTutorialIds = new Set(
      watchHistory.filter(p => p.completed).map(p => p.tutorialId)
    );

    // Get categories from completed tutorials
    const completedTutorials = allTutorials.filter(t => completedTutorialIds.has(t.id));
    const preferredCategories = [...new Set(completedTutorials.map(t => t.category))];

    // Find unstarted tutorials in preferred categories
    const unstarted = allTutorials.filter(tutorial => 
      !watchHistory.some(p => p.tutorialId === tutorial.id) &&
      preferredCategories.includes(tutorial.category)
    );

    // Sort by difficulty progression
    return unstarted.sort((a, b) => {
      const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
  }

  // Data management
  static exportProgress(): string {
    const allProgress = this.getAllProgress();
    return JSON.stringify(allProgress, null, 2);
  }

  static async importProgress(progressData: string): Promise<void> {
    try {
      const parsed = JSON.parse(progressData);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
    } catch (error) {
      throw new Error('Invalid progress data format');
    }
  }

  static clearAllProgress(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Private helpers
  private static getAllProgress(): { [tutorialId: string]: VideoProgress } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to parse video progress data:', error);
      return {};
    }
  }

  private static createInitialProgress(tutorialId: string): VideoProgress {
    return {
      tutorialId,
      currentTime: 0,
      completed: false,
      watchTime: 0,
      completedChapters: [],
      quizScores: {},
      lastWatched: new Date(),
      notes: []
    };
  }

  // Quality of life features
  static async skipToChapter(tutorialId: string, chapterId: string, chapters: any[]): Promise<number> {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return 0;

    const progress = await this.getProgress(tutorialId) || this.createInitialProgress(tutorialId);
    progress.currentTime = chapter.startTime;
    await this.saveProgress(progress);

    return chapter.startTime;
  }

  static async resumeFromLastPosition(tutorialId: string): Promise<number> {
    const progress = await this.getProgress(tutorialId);
    return progress?.currentTime || 0;
  }
}
