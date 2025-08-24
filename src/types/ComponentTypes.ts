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
  type: 'markdown' | 'interactive' | 'video' | 'diagram' | 'code-playground' | 'interactive-diagram' | 'quiz' | 'callout' | 'tutorial';
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
  type: 'mermaid' | 'plantuml' | 'flowchart' | 'architecture' | 'interactive';
  source: string;
  title?: string;
  interactive?: boolean;
  clickableNodes?: Array<{
    id: string;
    action: 'navigate' | 'tooltip' | 'modal';
    target: string;
  }>;
}

export interface InteractiveDiagramContent {
  title: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layout?: 'horizontal' | 'vertical' | 'radial' | 'free';
  height?: number;
  interactive?: boolean;
  miniMap?: boolean;
  controls?: boolean;
  background?: boolean;
  nodeTypes?: Record<string, any>;
  relatedDiagrams?: { title: string; url: string; description?: string }[];
  navigationHints?: string[];
}

export interface DiagramNode {
  id: string;
  type?: 'default' | 'process' | 'component' | 'decision' | 'data' | 'chromium-process' | 'chromium-component';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    details?: string;
    icon?: string;
    color?: string;
    links?: { title: string; url: string }[];
    processType?: 'browser' | 'renderer' | 'gpu' | 'network' | 'utility';
    componentType?: 'ui' | 'content' | 'blink' | 'v8' | 'network' | 'storage';
  };
  style?: Record<string, any>;
  draggable?: boolean;
  selectable?: boolean;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  description?: string;
  type?: 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';
  animated?: boolean;
  style?: Record<string, any>;
  markerEnd?: {
    type: 'arrow' | 'arrowclosed';
    color?: string;
  };
  links?: { title: string; url: string }[];
  clickable?: boolean;
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
