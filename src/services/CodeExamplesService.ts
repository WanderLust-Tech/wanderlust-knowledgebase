/**
 * Code Examples Repository Service
 * Comprehensive service for managing searchable, runnable code samples
 * with categorization, execution, analytics, and recommendation features
 */

import {
  CodeExample,
  CodeExampleCollection,
  CodeExampleSearchFilters,
  CodeExampleSearchResult,
  CodeExecutionResult,
  CodeExampleRating,
  CodeExampleUsageStats,
  CodeExampleRecommendation,
  ProgrammingLanguage,
  DifficultyLevel,
  CodeExampleCategory,
  ExecutionEnvironment,
  CodeExecutionService
} from '../types/CodeExampleTypes';

class CodeExamplesService {
  private examples: Map<string, CodeExample> = new Map();
  private collections: Map<string, CodeExampleCollection> = new Map();
  private usageStats: Map<string, CodeExampleUsageStats> = new Map();
  private ratings: Map<string, CodeExampleRating[]> = new Map();
  public executionService: CodeExecutionService;

  constructor() {
    this.initializeSampleData();
    this.executionService = new MockCodeExecutionService();
  }

  // Initialize with comprehensive Chromium-focused code examples
  private initializeSampleData(): void {
    const examples: CodeExample[] = [
      // Getting Started Examples
      {
        id: 'chromium-hello-world',
        title: 'Hello World - Chromium Extension',
        description: 'Basic Chrome extension that displays "Hello World"',
        longDescription: 'A simple Chrome extension that demonstrates the basic structure and manifest requirements for Chromium extensions.',
        code: `// manifest.json
{
  "manifest_version": 3,
  "name": "Hello World Extension",
  "version": "1.0",
  "description": "A simple hello world extension",
  "action": {
    "default_popup": "popup.html"
  }
}

// popup.html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { width: 200px; padding: 10px; }
    h1 { font-size: 16px; margin: 0; }
  </style>
</head>
<body>
  <h1>Hello, Chromium World!</h1>
  <p>This is your first extension.</p>
</body>
</html>`,
        language: 'json',
        category: 'getting-started',
        subcategory: 'extensions',
        tags: ['extension', 'manifest', 'popup', 'beginner'],
        difficulty: 'beginner',
        runnable: false,
        environment: 'static',
        dependencies: [],
        setupInstructions: 'Load as unpacked extension in chrome://extensions/',
        relatedArticles: ['/getting-started/setup-build', '/getting-started/project-layout'],
        relatedExamples: ['extension-content-script', 'extension-background-script'],
        learningObjectives: ['Understand extension manifest structure', 'Create basic popup interface', 'Learn extension loading process'],
        author: 'Chromium Team',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-08-20'),
        version: '1.0',
        verified: true,
        popularity: 95,
        ratings: { average: 4.8, count: 124 }
      },

      // Architecture Examples
      {
        id: 'ipc-message-passing',
        title: 'IPC Message Passing Example',
        description: 'Inter-process communication between browser and renderer processes',
        longDescription: 'Demonstrates how Chromium uses IPC for secure communication between different processes in the multi-process architecture.',
        code: `// browser_process.cc
#include "content/public/browser/render_process_host.h"
#include "content/public/browser/render_view_host.h"

// Send message from browser to renderer
void SendMessageToRenderer(content::RenderViewHost* rvh, 
                          const std::string& message) {
  rvh->Send(new CustomMessage(message));
}

// Handle message from renderer
bool OnMessageReceived(const IPC::Message& message) {
  bool handled = true;
  IPC_BEGIN_MESSAGE_MAP(BrowserHandler, message)
    IPC_MESSAGE_HANDLER(CustomMessage, OnCustomMessage)
    IPC_MESSAGE_UNHANDLED(handled = false)
  IPC_END_MESSAGE_MAP()
  return handled;
}

void OnCustomMessage(const std::string& data) {
  // Process message from renderer
  LOG(INFO) << "Received from renderer: " << data;
}

// renderer_process.cc
#include "content/public/renderer/render_view.h"

// Send message from renderer to browser
void SendMessageToBrowser(const std::string& message) {
  Send(new CustomMessage(message));
}

// Handle message from browser
bool OnMessageReceived(const IPC::Message& message) {
  bool handled = true;
  IPC_BEGIN_MESSAGE_MAP(RendererHandler, message)
    IPC_MESSAGE_HANDLER(CustomMessage, OnCustomMessage)
    IPC_MESSAGE_UNHANDLED(handled = false)
  IPC_END_MESSAGE_MAP()
  return handled;
}`,
        language: 'cpp',
        category: 'architecture',
        subcategory: 'ipc',
        tags: ['ipc', 'multi-process', 'browser-process', 'renderer-process', 'communication'],
        difficulty: 'intermediate',
        runnable: false,
        environment: 'build-system',
        dependencies: ['chromium-source', 'build-tools'],
        setupInstructions: 'Requires full Chromium build environment',
        expectedOutput: 'Successful IPC message exchange between processes',
        relatedArticles: ['/architecture/ipc-internals', '/architecture/process-model'],
        relatedExamples: ['multi-process-example', 'security-sandbox'],
        learningObjectives: ['Understand IPC message flow', 'Learn process isolation', 'Master inter-process security'],
        prerequisites: ['C++ knowledge', 'Chromium build setup'],
        author: 'Architecture Team',
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-08-22'),
        version: '2.1',
        verified: true,
        popularity: 78,
        ratings: { average: 4.6, count: 67 }
      },

      // JavaScript Engine Examples
      {
        id: 'v8-heap-snapshot',
        title: 'V8 Heap Snapshot Analysis',
        description: 'Analyze memory usage with V8 heap snapshots',
        longDescription: 'Learn how to capture and analyze V8 heap snapshots to identify memory leaks and optimize JavaScript performance.',
        code: `// Memory leak detection script
class MemoryAnalyzer {
  constructor() {
    this.snapshots = [];
    this.leakDetector = new LeakDetector();
  }
  
  async captureSnapshot(label = 'snapshot') {
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    const snapshot = await this.createHeapSnapshot();
    this.snapshots.push({
      label,
      timestamp: Date.now(),
      snapshot
    });
    
    console.log(\`Captured snapshot: \${label}\`);
    return snapshot;
  }
  
  async createHeapSnapshot() {
    // Use DevTools Protocol to capture heap snapshot
    if ('memory' in performance) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    
    // Fallback for environments without memory info
    return this.estimateMemoryUsage();
  }
  
  estimateMemoryUsage() {
    const objectCount = this.countObjects();
    const estimatedSize = objectCount * 100; // Rough estimate
    
    return {
      objectCount,
      estimatedSize,
      timestamp: Date.now()
    };
  }
  
  countObjects() {
    let count = 0;
    const visited = new WeakSet();
    
    const traverse = (obj) => {
      if (obj === null || typeof obj !== 'object' || visited.has(obj)) {
        return;
      }
      
      visited.add(obj);
      count++;
      
      Object.values(obj).forEach(traverse);
    };
    
    // Count global objects (simplified)
    traverse(window);
    return count;
  }
  
  compareSnapshots(snapshot1, snapshot2) {
    const diff = {
      heapGrowth: snapshot2.usedJSHeapSize - snapshot1.usedJSHeapSize,
      objectGrowth: snapshot2.objectCount - snapshot1.objectCount,
      timeElapsed: snapshot2.timestamp - snapshot1.timestamp
    };
    
    return {
      ...diff,
      isLikeLeak: diff.heapGrowth > 1024 * 1024, // > 1MB growth
      growthRate: diff.heapGrowth / diff.timeElapsed
    };
  }
  
  detectLeaks() {
    if (this.snapshots.length < 2) {
      return { status: 'insufficient_data' };
    }
    
    const recent = this.snapshots.slice(-2);
    const comparison = this.compareSnapshots(recent[0].snapshot, recent[1].snapshot);
    
    return {
      status: comparison.isLikeLeak ? 'potential_leak' : 'normal',
      details: comparison,
      recommendations: this.getRecommendations(comparison)
    };
  }
  
  getRecommendations(comparison) {
    const recommendations = [];
    
    if (comparison.isLikeLeak) {
      recommendations.push('Check for detached DOM nodes');
      recommendations.push('Review event listener cleanup');
      recommendations.push('Analyze closure retention');
    }
    
    if (comparison.objectGrowth > 1000) {
      recommendations.push('Monitor object creation patterns');
      recommendations.push('Consider object pooling');
    }
    
    return recommendations;
  }
}

// Usage example
const analyzer = new MemoryAnalyzer();

// Capture initial snapshot
analyzer.captureSnapshot('initial');

// Simulate some operations
setTimeout(async () => {
  // Create potential memory leak
  const largeArray = new Array(100000).fill('data');
  window.potentialLeak = largeArray;
  
  // Capture second snapshot
  await analyzer.captureSnapshot('after_operations');
  
  // Analyze for leaks
  const analysis = analyzer.detectLeaks();
  console.log('Memory Analysis:', analysis);
}, 5000);`,
        language: 'javascript',
        category: 'javascript-engine',
        subcategory: 'memory',
        tags: ['v8', 'memory', 'heap', 'performance', 'debugging', 'leaks'],
        difficulty: 'advanced',
        runnable: true,
        environment: 'browser',
        dependencies: [],
        setupInstructions: 'Run in browser with DevTools open',
        expectedOutput: 'Memory analysis report with leak detection',
        relatedArticles: ['/modules/javascript-v8', '/debugging/debugging-tools'],
        relatedExamples: ['performance-profiling', 'devtools-integration'],
        learningObjectives: ['Understand V8 memory management', 'Learn leak detection techniques', 'Master performance profiling'],
        prerequisites: ['JavaScript proficiency', 'DevTools knowledge'],
        author: 'Performance Team',
        createdAt: new Date('2024-03-05'),
        updatedAt: new Date('2024-08-18'),
        version: '1.5',
        verified: true,
        popularity: 89,
        ratings: { average: 4.7, count: 156 },
        variations: [
          {
            id: 'automated-leak-detection',
            name: 'Automated Leak Detection',
            description: 'Automated version that runs continuously',
            code: '// Automated monitoring version...',
            differences: ['Continuous monitoring', 'Automated alerts', 'Background execution'],
            useCase: 'Production monitoring'
          }
        ],
        explanations: [
          {
            id: 'gc-explanation',
            lineStart: 7,
            lineEnd: 10,
            explanation: 'Force garbage collection to get accurate memory measurements. Only available in development builds.',
            concepts: ['garbage collection', 'memory measurement'],
            links: [{ text: 'V8 Garbage Collection', url: '/modules/javascript-v8#garbage-collection' }]
          }
        ]
      },

      // Debugging Examples
      {
        id: 'devtools-protocol',
        title: 'Chrome DevTools Protocol Usage',
        description: 'Interact with Chrome DevTools Protocol for debugging',
        longDescription: 'Learn how to use the Chrome DevTools Protocol to programmatically debug and inspect web pages.',
        code: `// DevTools Protocol Client
class DevToolsClient {
  constructor(port = 9222) {
    this.port = port;
    this.ws = null;
    this.messageId = 0;
    this.pendingCommands = new Map();
  }
  
  async connect() {
    // Get available targets
    const response = await fetch(\`http://localhost:\${this.port}/json\`);
    const targets = await response.json();
    
    // Find the first page target
    const pageTarget = targets.find(target => target.type === 'page');
    if (!pageTarget) {
      throw new Error('No page target found');
    }
    
    // Connect to WebSocket
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
      
      this.ws.onopen = () => {
        console.log('Connected to DevTools Protocol');
        resolve(this);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onerror = reject;
    });
  }
  
  handleMessage(message) {
    if (message.id && this.pendingCommands.has(message.id)) {
      const { resolve, reject } = this.pendingCommands.get(message.id);
      this.pendingCommands.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // Handle events
      this.handleEvent(message.method, message.params);
    }
  }
  
  handleEvent(method, params) {
    console.log(\`Event: \${method}\`, params);
    
    // Handle specific events
    switch (method) {
      case 'Runtime.consoleAPICalled':
        console.log('Console API called:', params);
        break;
      case 'Runtime.exceptionThrown':
        console.error('Exception thrown:', params.exceptionDetails);
        break;
      case 'Network.requestWillBeSent':
        console.log('Network request:', params.request.url);
        break;
    }
  }
  
  async sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingCommands.set(id, { resolve, reject });
      
      this.ws.send(JSON.stringify({
        id,
        method,
        params
      }));
    });
  }
  
  // Enable domains
  async enableRuntime() {
    await this.sendCommand('Runtime.enable');
  }
  
  async enableNetwork() {
    await this.sendCommand('Network.enable');
  }
  
  async enablePage() {
    await this.sendCommand('Page.enable');
  }
  
  // Runtime methods
  async evaluate(expression) {
    return await this.sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true
    });
  }
  
  async getProperties(objectId) {
    return await this.sendCommand('Runtime.getProperties', {
      objectId,
      ownProperties: true
    });
  }
  
  // Network methods
  async clearBrowserCache() {
    await this.sendCommand('Network.clearBrowserCache');
  }
  
  async setCacheDisabled(disabled = true) {
    await this.sendCommand('Network.setCacheDisabled', { disabled });
  }
  
  // Page methods
  async reload(ignoreCache = false) {
    await this.sendCommand('Page.reload', { ignoreCache });
  }
  
  async navigate(url) {
    return await this.sendCommand('Page.navigate', { url });
  }
  
  async captureScreenshot() {
    return await this.sendCommand('Page.captureScreenshot', {
      format: 'png',
      quality: 80
    });
  }
  
  // Performance methods
  async startProfiling() {
    await this.sendCommand('Profiler.enable');
    await this.sendCommand('Profiler.start');
  }
  
  async stopProfiling() {
    const profile = await this.sendCommand('Profiler.stop');
    await this.sendCommand('Profiler.disable');
    return profile;
  }
  
  // Memory methods
  async collectGarbage() {
    await this.sendCommand('HeapProfiler.collectGarbage');
  }
  
  async takeHeapSnapshot() {
    await this.sendCommand('HeapProfiler.enable');
    await this.sendCommand('HeapProfiler.takeHeapSnapshot');
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Usage example
async function debugExample() {
  const client = new DevToolsClient();
  
  try {
    await client.connect();
    
    // Enable required domains
    await client.enableRuntime();
    await client.enableNetwork();
    await client.enablePage();
    
    // Evaluate JavaScript
    const result = await client.evaluate('document.title');
    console.log('Page title:', result.result.value);
    
    // Take screenshot
    const screenshot = await client.captureScreenshot();
    console.log('Screenshot captured:', screenshot.data.length, 'bytes');
    
    // Start performance profiling
    await client.startProfiling();
    
    // Wait for some activity
    setTimeout(async () => {
      const profile = await client.stopProfiling();
      console.log('Performance profile:', profile);
      
      client.disconnect();
    }, 5000);
    
  } catch (error) {
    console.error('DevTools Protocol error:', error);
  }
}

// Auto-run if in appropriate environment
if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
  debugExample();
}`,
        language: 'javascript',
        category: 'debugging',
        subcategory: 'devtools',
        tags: ['devtools', 'protocol', 'debugging', 'automation', 'profiling'],
        difficulty: 'advanced',
        runnable: true,
        environment: 'browser',
        dependencies: ['chrome-devtools-protocol'],
        setupInstructions: 'Start Chrome with --remote-debugging-port=9222',
        expectedOutput: 'DevTools Protocol interactions and debugging data',
        relatedArticles: ['/debugging/debugging-tools', '/debugging/chrome-internals-urls'],
        relatedExamples: ['performance-profiling', 'automated-testing'],
        learningObjectives: ['Master DevTools Protocol', 'Learn remote debugging', 'Understand Chrome automation'],
        prerequisites: ['JavaScript knowledge', 'Chrome DevTools familiarity'],
        author: 'DevTools Team',
        createdAt: new Date('2024-03-20'),
        updatedAt: new Date('2024-08-15'),
        version: '2.0',
        verified: true,
        popularity: 73,
        ratings: { average: 4.5, count: 89 }
      },

      // Build System Examples
      {
        id: 'gn-build-example',
        title: 'GN Build Configuration',
        description: 'Configure Chromium build with GN (Generate Ninja)',
        longDescription: 'Learn how to configure and customize Chromium builds using GN build configuration files.',
        code: `# BUILD.gn - Example build configuration
# This file demonstrates common GN patterns used in Chromium

import("//build/config/features.gni")
import("//build/config/ui.gni")

# Define a component (shared library in component builds)
component("my_chromium_component") {
  sources = [
    "component.cc",
    "component.h",
    "component_impl.cc",
    "component_impl.h",
  ]
  
  # Public headers that other targets can include
  public = [
    "component.h",
  ]
  
  # Dependencies on other targets
  deps = [
    "//base",
    "//content/public/browser",
    "//net",
  ]
  
  # Public dependencies (exposed to dependents)
  public_deps = [
    "//url",
  ]
  
  # Conditional compilation
  if (is_win) {
    sources += [
      "component_win.cc",
      "component_win.h",
    ]
    libs = [ "user32.lib" ]
  }
  
  if (is_linux) {
    sources += [
      "component_linux.cc",
      "component_linux.h",
    ]
    configs += [ "//build/config/linux:gtk" ]
  }
  
  # Define preprocessor macros
  defines = [
    "MY_COMPONENT_IMPLEMENTATION",
  ]
  
  # Include directories
  include_dirs = [
    "//third_party/custom_library/include",
  ]
}

# Static library target
static_library("utility_lib") {
  sources = [
    "utility.cc",
    "utility.h",
  ]
  
  # This library is only used internally
  visibility = [ ":*" ]
  
  deps = [
    "//base",
  ]
}

# Executable target
executable("my_chromium_tool") {
  sources = [
    "tool_main.cc",
  ]
  
  deps = [
    ":my_chromium_component",
    ":utility_lib",
    "//base",
  ]
  
  # Tool-specific configuration
  if (is_debug) {
    defines += [ "ENABLE_DEBUG_FEATURES" ]
  }
}

# Test target
test("my_component_unittests") {
  sources = [
    "component_unittest.cc",
    "utility_unittest.cc",
  ]
  
  deps = [
    ":my_chromium_component",
    ":utility_lib",
    "//base/test:test_support",
    "//testing/gtest",
  ]
  
  # Test data files
  data = [
    "test_data/sample.json",
    "test_data/config.xml",
  ]
}

# Custom configuration
config("my_component_config") {
  include_dirs = [ "include" ]
  defines = [ "MY_COMPONENT_ENABLED" ]
  
  if (is_component_build) {
    defines += [ "MY_COMPONENT_SHARED" ]
  }
}

# Apply custom config to component
my_chromium_component.public_configs += [ ":my_component_config" ]

# Group target for convenience
group("all_my_targets") {
  deps = [
    ":my_chromium_component",
    ":my_chromium_tool",
    ":my_component_unittests",
  ]
}

# Action to generate code
action("generate_version_info") {
  script = "//tools/generate_version.py"
  
  inputs = [
    "version_template.h.in",
  ]
  
  outputs = [
    "\$target_gen_dir/version_info.h",
  ]
  
  args = [
    "--template", rebase_path("version_template.h.in", root_build_dir),
    "--output", rebase_path("\$target_gen_dir/version_info.h", root_build_dir),
    "--version", "1.0.0",
  ]
  
  # This action depends on the version template
  deps = []
}

# Include generated files in component
my_chromium_component.sources += get_target_outputs(":generate_version_info")
my_chromium_component.deps += [ ":generate_version_info" ]`,
        language: 'gn',
        category: 'build-system',
        subcategory: 'gn',
        tags: ['gn', 'build', 'ninja', 'configuration', 'chromium-build'],
        difficulty: 'intermediate',
        runnable: false,
        environment: 'build-system',
        dependencies: ['gn', 'ninja', 'chromium-source'],
        setupInstructions: 'Place in Chromium source tree and run: gn gen out/Default',
        expectedOutput: 'Generated ninja build files',
        relatedArticles: ['/getting-started/setup-build'],
        relatedExamples: ['ninja-build', 'cross-compilation'],
        learningObjectives: ['Understand GN syntax', 'Learn Chromium build patterns', 'Master dependency management'],
        prerequisites: ['Build system knowledge', 'Chromium source access'],
        author: 'Build Team',
        createdAt: new Date('2024-04-01'),
        updatedAt: new Date('2024-08-10'),
        version: '1.3',
        verified: true,
        popularity: 65,
        ratings: { average: 4.4, count: 45 }
      }
    ];

    // Initialize collections
    const collections: CodeExampleCollection[] = [
      {
        id: 'getting-started-collection',
        name: 'Getting Started with Chromium',
        description: 'Essential examples for new Chromium developers',
        examples: ['chromium-hello-world'],
        learningPath: ['chromium-hello-world', 'extension-content-script', 'extension-background-script'],
        estimatedTime: 45,
        difficulty: 'beginner',
        category: 'getting-started'
      },
      {
        id: 'architecture-deep-dive',
        name: 'Chromium Architecture Deep Dive',
        description: 'Advanced examples exploring Chromium\'s internal architecture',
        examples: ['ipc-message-passing'],
        learningPath: ['ipc-message-passing', 'multi-process-example', 'security-sandbox'],
        estimatedTime: 120,
        difficulty: 'advanced',
        category: 'architecture'
      },
      {
        id: 'javascript-engine-mastery',
        name: 'V8 JavaScript Engine Mastery',
        description: 'Master V8 performance and debugging techniques',
        examples: ['v8-heap-snapshot'],
        learningPath: ['v8-heap-snapshot', 'performance-profiling', 'garbage-collection'],
        estimatedTime: 90,
        difficulty: 'advanced',
        category: 'javascript-engine'
      }
    ];

    // Store examples and collections
    examples.forEach(example => {
      this.examples.set(example.id, example);
      
      // Initialize usage stats
      this.usageStats.set(example.id, {
        exampleId: example.id,
        views: Math.floor(Math.random() * 1000),
        executions: Math.floor(Math.random() * 200),
        copies: Math.floor(Math.random() * 150),
        bookmarks: Math.floor(Math.random() * 80),
        shares: Math.floor(Math.random() * 30),
        ratings: {
          average: example.ratings.average,
          distribution: {
            1: Math.floor(Math.random() * 5),
            2: Math.floor(Math.random() * 10),
            3: Math.floor(Math.random() * 20),
            4: Math.floor(Math.random() * 40),
            5: Math.floor(Math.random() * 60)
          }
        },
        popularityTrend: {
          period: 'week',
          data: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
            count: Math.floor(Math.random() * 50)
          }))
        }
      });
    });

    collections.forEach(collection => {
      this.collections.set(collection.id, collection);
    });
  }

  // Basic CRUD operations
  async getExample(id: string): Promise<CodeExample | null> {
    return this.examples.get(id) || null;
  }

  async getExamples(ids: string[]): Promise<CodeExample[]> {
    return ids.map(id => this.examples.get(id)).filter(Boolean) as CodeExample[];
  }

  async searchExamples(filters: CodeExampleSearchFilters): Promise<CodeExampleSearchResult> {
    let examples = Array.from(this.examples.values());

    // Apply filters
    if (filters.query) {
      const query = filters.query.toLowerCase();
      examples = examples.filter(example =>
        example.title.toLowerCase().includes(query) ||
        example.description.toLowerCase().includes(query) ||
        example.tags.some(tag => tag.toLowerCase().includes(query)) ||
        example.code.toLowerCase().includes(query)
      );
    }

    if (filters.languages?.length) {
      examples = examples.filter(example => filters.languages!.includes(example.language));
    }

    if (filters.categories?.length) {
      examples = examples.filter(example => filters.categories!.includes(example.category));
    }

    if (filters.difficulties?.length) {
      examples = examples.filter(example => filters.difficulties!.includes(example.difficulty));
    }

    if (filters.tags?.length) {
      examples = examples.filter(example =>
        filters.tags!.some(tag => example.tags.includes(tag))
      );
    }

    if (filters.runnable !== undefined) {
      examples = examples.filter(example => example.runnable === filters.runnable);
    }

    if (filters.verified !== undefined) {
      examples = examples.filter(example => example.verified === filters.verified);
    }

    if (filters.minRating) {
      examples = examples.filter(example => example.ratings.average >= filters.minRating!);
    }

    if (filters.author) {
      examples = examples.filter(example => 
        example.author.toLowerCase().includes(filters.author!.toLowerCase())
      );
    }

    // Calculate filter statistics
    const allExamples = Array.from(this.examples.values());
    const filterStats = {
      languages: {} as { [key in ProgrammingLanguage]?: number },
      categories: {} as { [key in CodeExampleCategory]?: number },
      difficulties: {} as { [key in DifficultyLevel]?: number },
      tags: {} as { [key: string]: number }
    };

    allExamples.forEach(example => {
      filterStats.languages[example.language] = (filterStats.languages[example.language] || 0) + 1;
      filterStats.categories[example.category] = (filterStats.categories[example.category] || 0) + 1;
      filterStats.difficulties[example.difficulty] = (filterStats.difficulties[example.difficulty] || 0) + 1;
      
      example.tags.forEach(tag => {
        filterStats.tags[tag] = (filterStats.tags[tag] || 0) + 1;
      });
    });

    // Generate suggestions
    const suggestions = this.generateSearchSuggestions(filters.query || '');

    // Get related collections
    const relatedCollections = Array.from(this.collections.values()).filter(collection =>
      examples.some(example => collection.examples.includes(example.id))
    );

    return {
      examples,
      totalCount: examples.length,
      filters: filterStats,
      suggestions,
      relatedCollections
    };
  }

  private generateSearchSuggestions(query: string): string[] {
    const commonSearches = [
      'ipc message passing',
      'v8 memory management',
      'chrome extension',
      'devtools protocol',
      'build configuration',
      'performance profiling',
      'security sandbox',
      'multi-process architecture'
    ];

    if (!query) {
      return commonSearches.slice(0, 5);
    }

    return commonSearches.filter(search => 
      search.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 3);
  }

  async getCollection(id: string): Promise<CodeExampleCollection | null> {
    return this.collections.get(id) || null;
  }

  async getCollections(category?: CodeExampleCategory): Promise<CodeExampleCollection[]> {
    const collections = Array.from(this.collections.values());
    return category ? collections.filter(c => c.category === category) : collections;
  }

  async getUsageStats(exampleId: string): Promise<CodeExampleUsageStats> {
    return this.usageStats.get(exampleId) || {
      exampleId,
      views: 0,
      executions: 0,
      copies: 0,
      bookmarks: 0,
      shares: 0,
      ratings: { average: 0, distribution: {} },
      popularityTrend: { period: 'week', data: [] }
    };
  }

  async getPopularExamples(limit = 10): Promise<CodeExample[]> {
    const examples = Array.from(this.examples.values());
    return examples
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  async getRecentExamples(limit = 10): Promise<CodeExample[]> {
    const examples = Array.from(this.examples.values());
    return examples
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async getRecommendations(userId: string, context?: string): Promise<CodeExampleRecommendation[]> {
    // Simple recommendation algorithm
    const examples = Array.from(this.examples.values());
    const recommendations: CodeExampleRecommendation[] = [];

    // Popular examples
    const popular = examples
      .filter(e => e.popularity > 70)
      .slice(0, 3)
      .map(example => ({
        example,
        reason: 'popular' as const,
        score: example.popularity / 100,
        explanation: `This example is highly rated by the community (${example.ratings.average}⭐)`
      }));

    // Recent examples
    const recent = examples
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 2)
      .map(example => ({
        example,
        reason: 'recent' as const,
        score: 0.8,
        explanation: 'Recently updated with new content and improvements'
      }));

    recommendations.push(...popular, ...recent);
    
    return recommendations.slice(0, 5);
  }

  async trackUsage(exampleId: string, action: 'view' | 'execute' | 'copy' | 'share'): Promise<boolean> {
    const stats = this.usageStats.get(exampleId);
    if (stats) {
      stats[action === 'view' ? 'views' : action === 'execute' ? 'executions' : action === 'copy' ? 'copies' : 'shares']++;
      return true;
    }
    return false;
  }

  async rateExample(rating: Omit<CodeExampleRating, 'timestamp'>): Promise<boolean> {
    try {
      const fullRating: CodeExampleRating = {
        ...rating,
        timestamp: new Date()
      };
      
      if (!this.ratings.has(rating.exampleId)) {
        this.ratings.set(rating.exampleId, []);
      }
      
      const exampleRatings = this.ratings.get(rating.exampleId)!;
      exampleRatings.push(fullRating);
      
      // Update example rating statistics
      const example = this.examples.get(rating.exampleId);
      if (example) {
        const totalRatings = exampleRatings.length;
        const sum = exampleRatings.reduce((acc, r) => acc + r.rating, 0);
        example.ratings.average = sum / totalRatings;
        example.ratings.count = totalRatings;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to rate example:', error);
      return false;
    }
  }

  async bookmarkExample(userId: string, exampleId: string): Promise<boolean> {
    try {
      // In a real implementation, this would save to user's bookmarks
      console.log(`User ${userId} bookmarked example ${exampleId}`);
      
      // Update bookmark count in usage stats
      const stats = this.usageStats.get(exampleId);
      if (stats) {
        stats.bookmarks++;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to bookmark example:', error);
      return false;
    }
  }
}

// Mock Code Execution Service
class MockCodeExecutionService implements CodeExecutionService {
  async execute(code: string, language: ProgrammingLanguage, environment: ExecutionEnvironment): Promise<CodeExecutionResult> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (language === 'javascript' && environment === 'browser') {
      try {
        // Simple evaluation for demonstration
        const result = eval(code);
        return {
          success: true,
          output: JSON.stringify(result, null, 2),
          executionTime: Math.random() * 100,
          memoryUsage: Math.random() * 1024 * 1024,
          metadata: {
            environment,
            timestamp: new Date(),
            version: '1.0'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            environment,
            timestamp: new Date(),
            version: '1.0'
          }
        };
      }
    }

    return {
      success: true,
      output: 'Code execution simulated successfully',
      executionTime: Math.random() * 200,
      metadata: {
        environment,
        timestamp: new Date(),
        version: '1.0'
      }
    };
  }

  async validateCode(code: string, language: ProgrammingLanguage): Promise<{ valid: boolean; errors: string[] }> {
    // Simple validation
    if (code.trim().length === 0) {
      return { valid: false, errors: ['Code cannot be empty'] };
    }

    if (language === 'javascript') {
      try {
        new Function(code);
        return { valid: true, errors: [] };
      } catch (error) {
        return { 
          valid: false, 
          errors: [error instanceof Error ? error.message : 'Syntax error'] 
        };
      }
    }

    return { valid: true, errors: [] };
  }

  async formatCode(code: string, language: ProgrammingLanguage): Promise<string> {
    // Simple formatting simulation
    return code;
  }

  async getEnvironmentInfo(environment: ExecutionEnvironment): Promise<{ available: boolean; version: string; features: string[] }> {
    return {
      available: true,
      version: '1.0',
      features: ['execution', 'debugging', 'profiling']
    };
  }
}

export const codeExamplesService = new CodeExamplesService();
