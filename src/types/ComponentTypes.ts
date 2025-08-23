export interface ComponentMetadata {
  id: string;
  title?: string;
  description?: string;
  author?: string;
  created?: Date;
  updated?: Date;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime?: number;
  prerequisites?: string[];
  relatedComponents?: string[];
}

export interface ArticleComponent {
  id: string;
  type: 'markdown' | 'interactive' | 'video' | 'diagram' | 'code-playground' | 'quiz' | 'callout';
  content: any;
  metadata: ComponentMetadata;
  props?: Record<string, any>;
  layout?: {
    width?: 'full' | 'half' | 'third' | 'two-thirds';
    alignment?: 'left' | 'center' | 'right';
    spacing?: 'compact' | 'normal' | 'spacious';
  };
}

export interface ArticleStructure {
  id: string;
  title: string;
  description?: string;
  components: ArticleComponent[];
  metadata: {
    path: string;
    category: string;
    tags: string[];
    lastUpdated: Date;
    readingTime: number;
  };
}

// Component content type definitions
export interface MarkdownContent {
  source: string;
  frontmatter?: Record<string, any>;
}

export interface InteractiveContent {
  type: 'code-editor' | 'demo' | 'simulation';
  config: Record<string, any>;
  initialCode?: string;
  language?: string;
}

export interface VideoContent {
  url: string;
  title?: string;
  duration?: number;
  transcript?: string;
  thumbnailUrl?: string;
  captions?: Array<{
    time: number;
    text: string;
  }>;
}

export interface DiagramContent {
  type: 'mermaid' | 'plantuml' | 'flowchart' | 'architecture';
  source: string;
  title?: string;
  interactive?: boolean;
  clickableNodes?: Array<{
    id: string;
    action: 'navigate' | 'tooltip' | 'modal';
    target: string;
  }>;
}

export interface CalloutContent {
  type: 'info' | 'warning' | 'error' | 'success' | 'tip';
  title?: string;
  message: string;
  icon?: string;
  dismissible?: boolean;
}

export interface QuizContent {
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple-choice' | 'true-false' | 'code-completion';
    options?: string[];
    correctAnswer: string | string[];
    explanation?: string;
  }>;
  showResults?: boolean;
  allowRetry?: boolean;
}

export interface CodePlaygroundContent {
  language: 'javascript' | 'typescript' | 'cpp' | 'python' | 'html' | 'css';
  initialCode: string;
  expectedOutput?: string;
  solution?: string;
  instructions?: string;
  files?: Array<{
    name: string;
    content: string;
    language: string;
    readOnly?: boolean;
  }>;
  runnable?: boolean;
  showOutput?: boolean;
  showConsole?: boolean;
  theme?: 'vs-dark' | 'vs-light';
  features?: {
    intellisense?: boolean;
    minimap?: boolean;
    lineNumbers?: boolean;
    wordWrap?: boolean;
  };
}
