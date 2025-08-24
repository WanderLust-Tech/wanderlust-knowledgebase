import { TutorialProgress, InteractiveTutorial } from '../types/TutorialTypes';

export class TutorialProgressManager {
  private static readonly STORAGE_KEY = 'wanderlust-tutorial-progress';

  static loadProgress(): Record<string, TutorialProgress> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return {};
      
      const parsed = JSON.parse(stored);
      
      // Convert date strings back to Date objects
      Object.values(parsed).forEach((progress: any) => {
        if (progress.startedAt) progress.startedAt = new Date(progress.startedAt);
        if (progress.lastAccessed) progress.lastAccessed = new Date(progress.lastAccessed);
        if (progress.completedAt) progress.completedAt = new Date(progress.completedAt);
      });
      
      return parsed;
    } catch (error) {
      console.error('Error loading tutorial progress:', error);
      return {};
    }
  }

  static saveProgress(progress: Record<string, TutorialProgress>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving tutorial progress:', error);
    }
  }

  static getTutorialProgress(tutorialId: string): TutorialProgress | null {
    const allProgress = this.loadProgress();
    return allProgress[tutorialId] || null;
  }

  static updateTutorialProgress(
    tutorialId: string, 
    updates: Partial<TutorialProgress>
  ): TutorialProgress {
    const allProgress = this.loadProgress();
    const existingProgress = allProgress[tutorialId];
    
    const defaultProgress: TutorialProgress = {
      tutorialId,
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      lastAccessed: new Date(),
      completed: false,
      notes: [],
      timeSpent: 0
    };

    const updatedProgress: TutorialProgress = {
      ...defaultProgress,
      ...existingProgress,
      ...updates,
      lastAccessed: new Date()
    };

    allProgress[tutorialId] = updatedProgress;
    this.saveProgress(allProgress);
    
    return updatedProgress;
  }

  static markStepCompleted(tutorialId: string, stepId: string): TutorialProgress {
    const progress = this.getTutorialProgress(tutorialId);
    const completedSteps = progress?.completedSteps || [];
    
    if (!completedSteps.includes(stepId)) {
      completedSteps.push(stepId);
    }

    return this.updateTutorialProgress(tutorialId, {
      completedSteps,
      currentStep: Math.max((progress?.currentStep || 0), completedSteps.length - 1)
    });
  }

  static markTutorialCompleted(tutorialId: string): TutorialProgress {
    return this.updateTutorialProgress(tutorialId, {
      completed: true,
      completedAt: new Date()
    });
  }

  static addTimeSpent(tutorialId: string, minutes: number): void {
    const progress = this.getTutorialProgress(tutorialId);
    const currentTimeSpent = progress?.timeSpent || 0;
    
    this.updateTutorialProgress(tutorialId, {
      timeSpent: currentTimeSpent + minutes
    });
  }

  static addNote(tutorialId: string, note: string): void {
    const progress = this.getTutorialProgress(tutorialId);
    const notes = progress?.notes || [];
    
    this.updateTutorialProgress(tutorialId, {
      notes: [...notes, note]
    });
  }

  static resetTutorial(tutorialId: string): void {
    const allProgress = this.loadProgress();
    delete allProgress[tutorialId];
    this.saveProgress(allProgress);
  }

  static getCompletedTutorials(): string[] {
    const allProgress = this.loadProgress();
    return Object.values(allProgress)
      .filter(progress => progress.completed)
      .map(progress => progress.tutorialId);
  }

  static getTutorialStats(tutorial: InteractiveTutorial): {
    progressPercentage: number;
    timeSpent: number;
    stepsCompleted: number;
    totalSteps: number;
    isCompleted: boolean;
  } {
    const progress = this.getTutorialProgress(tutorial.id);
    
    return {
      progressPercentage: progress 
        ? Math.round((progress.completedSteps.length / tutorial.steps.length) * 100)
        : 0,
      timeSpent: progress?.timeSpent || 0,
      stepsCompleted: progress?.completedSteps.length || 0,
      totalSteps: tutorial.steps.length,
      isCompleted: progress?.completed || false
    };
  }

  static exportProgress(): string {
    const progress = this.loadProgress();
    return JSON.stringify(progress, null, 2);
  }

  static importProgress(data: string): boolean {
    try {
      const imported = JSON.parse(data);
      this.saveProgress(imported);
      return true;
    } catch (error) {
      console.error('Error importing tutorial progress:', error);
      return false;
    }
  }
}
