export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  description?: string;
  code?: string;
  language?: string;
  expectedOutput?: string;
  validation?: {
    type: 'exact' | 'contains' | 'regex' | 'function';
    value: string | ((code: string, output?: string) => boolean);
  };
  hints: string[];
  nextAction: 'continue' | 'validate' | 'explore' | 'run';
  resources?: { title: string; url: string }[];
}

export interface InteractiveTutorial {
  id: string;
  title: string;
  description: string;
  category: 'getting-started' | 'architecture' | 'debugging' | 'modules' | 'contributing';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  prerequisites: string[];
  learningObjectives: string[];
  steps: TutorialStep[];
  completionCriteria?: string;
  nextTutorials?: string[]; // IDs of follow-up tutorials
}

export interface TutorialProgress {
  tutorialId: string;
  currentStep: number;
  completedSteps: string[];
  startedAt: Date;
  lastAccessed: Date;
  completed: boolean;
  completedAt?: Date;
  notes?: string[];
  timeSpent: number; // minutes
}

export interface TutorialState {
  currentCode: string;
  output: string;
  isRunning: boolean;
  hasError: boolean;
  errorMessage?: string;
  showHints: boolean;
  hintsUsed: number;
  stepStartTime: Date;
}

export interface TutorialValidationResult {
  isValid: boolean;
  message: string;
  feedback?: string;
  nextStepUnlocked?: boolean;
}

export interface TutorialContent {
  tutorial: InteractiveTutorial;
  progress?: TutorialProgress;
}
