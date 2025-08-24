/**
 * Code Examples Repository Types
 * Comprehensive type definitions for searchable, runnable code samples
 * with categorization, difficulty levels, and integration capabilities
 */

export type ProgrammingLanguage = 
  | 'javascript' 
  | 'typescript' 
  | 'cpp' 
  | 'python' 
  | 'html' 
  | 'css' 
  | 'json' 
  | 'bash' 
  | 'sql' 
  | 'yaml' 
  | 'markdown'
  | 'gn'      // GN build files for Chromium
  | 'mojom';  // Mojo interface definition language

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type CodeExampleCategory = 
  | 'architecture'
  | 'getting-started'
  | 'debugging'
  | 'performance'
  | 'security'
  | 'networking'
  | 'rendering'
  | 'javascript-engine'
  | 'build-system'
  | 'testing'
  | 'apis'
  | 'utilities';

export type ExecutionEnvironment = 
  | 'browser' 
  | 'node' 
  | 'chromium-devtools' 
  | 'build-system' 
  | 'static' 
  | 'interactive';

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  code: string;
  language: ProgrammingLanguage;
  category: CodeExampleCategory;
  subcategory?: string;
  tags: string[];
  difficulty: DifficultyLevel;
  
  // Execution and interaction
  runnable: boolean;
  environment: ExecutionEnvironment;
  dependencies?: string[];
  setupInstructions?: string;
  expectedOutput?: string;
  
  // Learning and navigation
  relatedArticles: string[];
  relatedExamples: string[];
  learningObjectives: string[];
  prerequisites?: string[];
  
  // Metadata
  author: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  verified: boolean;
  popularity: number;
  ratings: {
    average: number;
    count: number;
  };
  
  // Advanced features
  variations?: CodeExampleVariation[];
  explanations?: CodeExplanation[];
  interactiveElements?: InteractiveElement[];
}

export interface CodeExampleVariation {
  id: string;
  name: string;
  description: string;
  code: string;
  differences: string[];
  useCase: string;
}

export interface CodeExplanation {
  id: string;
  lineStart: number;
  lineEnd: number;
  explanation: string;
  concepts: string[];
  links?: {
    text: string;
    url: string;
  }[];
}

export interface InteractiveElement {
  id: string;
  type: 'input' | 'slider' | 'toggle' | 'select' | 'button';
  name: string;
  label: string;
  defaultValue: any;
  options?: any[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface CodeExampleCollection {
  id: string;
  name: string;
  description: string;
  examples: string[]; // Array of example IDs
  learningPath?: string[];
  estimatedTime: number; // in minutes
  difficulty: DifficultyLevel;
  category: CodeExampleCategory;
}

export interface CodeExampleSearchFilters {
  query?: string;
  languages?: ProgrammingLanguage[];
  categories?: CodeExampleCategory[];
  difficulties?: DifficultyLevel[];
  tags?: string[];
  runnable?: boolean;
  verified?: boolean;
  minRating?: number;
  author?: string;
  relatedToArticle?: string;
}

export interface CodeExampleSearchResult {
  examples: CodeExample[];
  totalCount: number;
  filters: {
    languages: { [key in ProgrammingLanguage]?: number };
    categories: { [key in CodeExampleCategory]?: number };
    difficulties: { [key in DifficultyLevel]?: number };
    tags: { [key: string]: number };
  };
  suggestions: string[];
  relatedCollections: CodeExampleCollection[];
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  memoryUsage?: number;
  warnings?: string[];
  metadata?: {
    environment: ExecutionEnvironment;
    timestamp: Date;
    version: string;
  };
}

export interface CodeExampleRating {
  exampleId: string;
  userId: string;
  rating: number; // 1-5
  review?: string;
  helpful: boolean;
  timestamp: Date;
  tags?: string[];
}

export interface CodeExampleUsageStats {
  exampleId: string;
  views: number;
  executions: number;
  copies: number;
  bookmarks: number;
  shares: number;
  ratings: {
    average: number;
    distribution: { [rating: number]: number };
  };
  popularityTrend: {
    period: 'day' | 'week' | 'month';
    data: { date: Date; count: number }[];
  };
}

export interface CodeExampleRecommendation {
  example: CodeExample;
  reason: 'similar-content' | 'learning-path' | 'difficulty-progression' | 'popular' | 'recent' | 'ai-suggested';
  score: number;
  explanation: string;
}

// Repository and service interfaces
export interface CodeExampleRepository {
  // Basic CRUD operations
  getExample(id: string): Promise<CodeExample | null>;
  getExamples(ids: string[]): Promise<CodeExample[]>;
  searchExamples(filters: CodeExampleSearchFilters): Promise<CodeExampleSearchResult>;
  createExample(example: Omit<CodeExample, 'id' | 'createdAt' | 'updatedAt'>): Promise<CodeExample>;
  updateExample(id: string, updates: Partial<CodeExample>): Promise<CodeExample>;
  deleteExample(id: string): Promise<boolean>;
  
  // Collections
  getCollection(id: string): Promise<CodeExampleCollection | null>;
  getCollections(category?: CodeExampleCategory): Promise<CodeExampleCollection[]>;
  createCollection(collection: Omit<CodeExampleCollection, 'id'>): Promise<CodeExampleCollection>;
  
  // Analytics and stats
  getUsageStats(exampleId: string): Promise<CodeExampleUsageStats>;
  getPopularExamples(limit?: number): Promise<CodeExample[]>;
  getRecentExamples(limit?: number): Promise<CodeExample[]>;
  
  // Recommendations
  getRecommendations(userId: string, context?: string): Promise<CodeExampleRecommendation[]>;
  getRelatedExamples(exampleId: string): Promise<CodeExample[]>;
  
  // User interactions
  rateExample(rating: Omit<CodeExampleRating, 'timestamp'>): Promise<boolean>;
  bookmarkExample(userId: string, exampleId: string): Promise<boolean>;
  trackUsage(exampleId: string, action: 'view' | 'execute' | 'copy' | 'share'): Promise<boolean>;
}

export interface CodeExecutionService {
  execute(code: string, language: ProgrammingLanguage, environment: ExecutionEnvironment): Promise<CodeExecutionResult>;
  validateCode(code: string, language: ProgrammingLanguage): Promise<{ valid: boolean; errors: string[] }>;
  formatCode(code: string, language: ProgrammingLanguage): Promise<string>;
  getEnvironmentInfo(environment: ExecutionEnvironment): Promise<{ available: boolean; version: string; features: string[] }>;
}

// Hook options and return types
export interface UseCodeExamplesOptions {
  initialFilters?: CodeExampleSearchFilters;
  autoSearch?: boolean;
  cacheResults?: boolean;
  enableRecommendations?: boolean;
  userId?: string;
  contextArticle?: string;
}

export interface UseCodeExamplesReturn {
  // Search and filtering
  examples: CodeExample[];
  searchResults: CodeExampleSearchResult | null;
  filters: CodeExampleSearchFilters;
  setFilters: (filters: CodeExampleSearchFilters) => void;
  search: (query?: string) => Promise<void>;
  clearFilters: () => void;
  
  // Collections
  collections: CodeExampleCollection[];
  featuredCollections: CodeExampleCollection[];
  
  // Individual example operations
  getExample: (id: string) => Promise<CodeExample | null>;
  executeExample: (id: string, customCode?: string) => Promise<CodeExecutionResult>;
  rateExample: (id: string, rating: number, review?: string) => Promise<boolean>;
  bookmarkExample: (id: string) => Promise<boolean>;
  shareExample: (id: string) => Promise<string>;
  
  // Recommendations
  recommendations: CodeExampleRecommendation[];
  refreshRecommendations: () => Promise<void>;
  
  // State management
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  
  // Analytics
  trackUsage: (exampleId: string, action: string) => void;
  getPopularExamples: () => Promise<CodeExample[]>;
  getUsageStats: (exampleId: string) => Promise<CodeExampleUsageStats>;
}

// Component prop types
export interface CodeExampleCardProps {
  example: CodeExample;
  compact?: boolean;
  showCode?: boolean;
  onExecute?: (result: CodeExecutionResult) => void;
  onRate?: (rating: number) => void;
  onBookmark?: () => void;
  onShare?: () => void;
  className?: string;
}

export interface CodeExampleViewerProps {
  example: CodeExample;
  showExplanations?: boolean;
  enableEditing?: boolean;
  enableExecution?: boolean;
  onCodeChange?: (code: string) => void;
  onExecute?: (result: CodeExecutionResult) => void;
  className?: string;
}

export interface CodeExampleSearchProps {
  onSearch?: (results: CodeExampleSearchResult) => void;
  onFilterChange?: (filters: CodeExampleSearchFilters) => void;
  initialFilters?: CodeExampleSearchFilters;
  placeholder?: string;
  showAdvancedFilters?: boolean;
  className?: string;
}

export interface CodeExampleCollectionProps {
  collection: CodeExampleCollection;
  examples: CodeExample[];
  onExampleSelect?: (example: CodeExample) => void;
  showProgress?: boolean;
  className?: string;
}
