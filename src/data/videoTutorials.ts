// Sample Video Tutorial Data
// Example video tutorials for Chromium development

import { VideoTutorial, VideoSeries } from '../types/VideoTypes';

export const sampleVideoTutorials: VideoTutorial[] = [
  {
    id: 'chromium-architecture-overview',
    title: 'Chromium Architecture Deep Dive',
    description: 'Comprehensive overview of Chromium\'s multi-process architecture, covering the browser process, renderer processes, and inter-process communication.',
    videoUrl: 'https://example.com/videos/chromium-architecture.mp4', // Replace with actual video URL
    duration: 1800, // 30 minutes
    difficulty: 'intermediate',
    category: 'Architecture',
    tags: ['architecture', 'multiprocess', 'IPC', 'browser-process', 'renderer-process'],
    
    learningObjectives: [
      'Understand Chromium\'s multi-process architecture',
      'Learn about the role of browser and renderer processes',
      'Explore inter-process communication mechanisms',
      'Identify security benefits of process isolation'
    ],
    
    prerequisites: [
      'Basic understanding of operating system processes',
      'Familiarity with web browsers',
      'Knowledge of C++ programming concepts'
    ],
    
    chapters: [
      {
        id: 'intro',
        title: 'Introduction to Multi-Process Architecture',
        startTime: 0,
        endTime: 300,
        description: 'Overview of why Chromium uses multiple processes',
        keyPoints: [
          'Security isolation benefits',
          'Stability improvements',
          'Performance considerations'
        ]
      },
      {
        id: 'browser-process',
        title: 'The Browser Process',
        startTime: 300,
        endTime: 600,
        description: 'Deep dive into the main browser process responsibilities',
        keyPoints: [
          'UI rendering and window management',
          'Network requests and downloads',
          'Process coordination'
        ],
        relatedCode: 'browser-process-example'
      },
      {
        id: 'renderer-process',
        title: 'Renderer Processes',
        startTime: 600,
        endTime: 900,
        description: 'How renderer processes handle web content',
        keyPoints: [
          'HTML parsing and DOM construction',
          'JavaScript execution',
          'Layout and painting'
        ],
        relatedCode: 'renderer-process-example'
      },
      {
        id: 'ipc-mechanisms',
        title: 'Inter-Process Communication',
        startTime: 900,
        endTime: 1200,
        description: 'Communication between browser and renderer processes',
        keyPoints: [
          'Mojo IPC system',
          'Message routing',
          'Synchronous vs asynchronous communication'
        ],
        relatedCode: 'ipc-example'
      },
      {
        id: 'security-model',
        title: 'Security Implications',
        startTime: 1200,
        endTime: 1500,
        description: 'How process isolation enhances security',
        keyPoints: [
          'Sandboxing renderer processes',
          'Privilege separation',
          'Attack surface reduction'
        ]
      },
      {
        id: 'practical-examples',
        title: 'Practical Examples and Debugging',
        startTime: 1500,
        endTime: 1800,
        description: 'Real-world examples and debugging techniques',
        keyPoints: [
          'Using Chrome task manager',
          'Process monitoring tools',
          'Common debugging scenarios'
        ]
      }
    ],
    
    codeExamples: [
      {
        id: 'browser-process-example',
        title: 'Browser Process Initialization',
        language: 'cpp',
        code: `// browser_main_loop.cc
void BrowserMainLoop::CreateStartupTasks() {
  // Initialize UI thread
  BrowserThread::SetCurrentThreadType(BrowserThread::UI);
  
  // Create browser context
  browser_context_ = std::make_unique<BrowserContextImpl>();
  
  // Initialize network service
  GetNetworkService();
  
  // Setup process manager
  content::GetProcessManager()->Initialize();
}`,
        description: 'Example of browser process initialization code',
        chapterIds: ['browser-process'],
        filename: 'browser_main_loop.cc',
        runnable: false
      },
      {
        id: 'renderer-process-example',
        title: 'Renderer Process Main Function',
        language: 'cpp',
        code: `// renderer_main.cc
int RendererMain(MainFunctionParams parameters) {
  // Initialize renderer process
  base::CommandLine::Init(parameters.argc, parameters.argv);
  
  // Setup message loop
  base::MessageLoop main_message_loop(base::MessageLoop::TYPE_DEFAULT);
  
  // Create and run renderer thread
  content::RendererMainDelegate delegate;
  content::RunNamedProcessTypeMain("renderer", parameters, &delegate);
  
  return 0;
}`,
        description: 'Main function for renderer process startup',
        chapterIds: ['renderer-process'],
        filename: 'renderer_main.cc',
        runnable: false
      },
      {
        id: 'ipc-example',
        title: 'IPC Message Example',
        language: 'cpp',
        code: `// Example IPC message definition
// browser_message_generator.h

// Message from browser to renderer
IPC_MESSAGE_ROUTED1(ViewMsg_Navigate,
                    GURL /* url */)

// Message from renderer to browser
IPC_MESSAGE_ROUTED2(ViewHostMsg_DidFinishLoad,
                    int /* frame_id */,
                    GURL /* validated_url */)

// Usage in browser process
void WebContentsImpl::NavigateToURL(const GURL& url) {
  Send(new ViewMsg_Navigate(GetRoutingID(), url));
}`,
        description: 'Example of IPC message definition and usage',
        chapterIds: ['ipc-mechanisms'],
        filename: 'browser_message_generator.h',
        runnable: false
      }
    ],
    
    relatedTutorials: ['chromium-build-system', 'debugging-chromium'],
    relatedArticles: ['architecture/process-model.md', 'architecture/ipc-internals.md'],
    
    author: 'Chromium Team',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-20'),
    thumbnailUrl: 'https://example.com/thumbnails/chromium-architecture.jpg',
    
    transcript: `Welcome to this comprehensive overview of Chromium's multi-process architecture.

In this tutorial, we'll explore how Chromium uses multiple processes to enhance security, stability, and performance. We'll start with an introduction to the concept of multi-process architecture and why it's crucial for modern web browsers.

First, let's understand the basic structure. Chromium consists of several types of processes: the main browser process, multiple renderer processes, and various utility processes. Each serves a specific purpose and operates in isolation from the others.

The browser process is the main coordinator. It handles the user interface, manages other processes, handles network requests, and maintains the overall application state. Think of it as the conductor of an orchestra, ensuring all parts work together harmoniously.

Renderer processes are where the magic happens for web content. Each tab or frame gets its own renderer process, which parses HTML, executes JavaScript, and renders the visual output. This isolation means that if one tab crashes, it doesn't affect others.

Communication between these processes happens through a sophisticated IPC (Inter-Process Communication) system called Mojo. This allows secure, efficient message passing while maintaining process boundaries.

The security implications are profound. By isolating web content in sandboxed renderer processes, Chromium can prevent malicious websites from accessing system resources or affecting other tabs. This architecture has become the foundation for modern browser security.

Throughout this tutorial, we'll examine real code examples, explore debugging techniques, and understand how this architecture influences Chromium development practices.`
  },
  
  {
    id: 'chromium-build-system',
    title: 'Setting Up Chromium Build Environment',
    description: 'Step-by-step guide to setting up a complete Chromium development environment, including depot_tools, source checkout, and first build.',
    videoUrl: 'https://example.com/videos/chromium-build.mp4',
    duration: 2400, // 40 minutes
    difficulty: 'beginner',
    category: 'Getting Started',
    tags: ['build-system', 'depot-tools', 'gn', 'ninja', 'setup'],
    
    learningObjectives: [
      'Install and configure depot_tools',
      'Check out Chromium source code',
      'Configure build with GN',
      'Build Chromium using Ninja',
      'Understand build system basics'
    ],
    
    prerequisites: [
      'Basic command line knowledge',
      'Git version control familiarity',
      'Development machine with sufficient resources'
    ],
    
    chapters: [
      {
        id: 'prerequisites',
        title: 'System Prerequisites',
        startTime: 0,
        endTime: 300,
        description: 'Setting up your development environment',
        keyPoints: [
          'Hardware requirements',
          'Operating system setup',
          'Required tools installation'
        ]
      },
      {
        id: 'depot-tools',
        title: 'Installing depot_tools',
        startTime: 300,
        endTime: 600,
        description: 'Getting Google\'s depot_tools suite',
        keyPoints: [
          'Downloading depot_tools',
          'PATH configuration',
          'Initial setup and authentication'
        ],
        relatedCode: 'depot-tools-setup'
      },
      {
        id: 'source-checkout',
        title: 'Checking Out Chromium Source',
        startTime: 600,
        endTime: 1200,
        description: 'Getting the Chromium source code',
        keyPoints: [
          'Using gclient to sync',
          'Understanding .gclient configuration',
          'Handling large repository size'
        ],
        relatedCode: 'source-checkout-commands'
      },
      {
        id: 'build-configuration',
        title: 'Configuring the Build',
        startTime: 1200,
        endTime: 1800,
        description: 'Using GN to configure build settings',
        keyPoints: [
          'GN build configuration',
          'Common build flags',
          'Debug vs Release builds'
        ],
        relatedCode: 'gn-configuration'
      },
      {
        id: 'building',
        title: 'Building Chromium',
        startTime: 1800,
        endTime: 2100,
        description: 'Using Ninja to build the browser',
        keyPoints: [
          'Ninja build system',
          'Parallel compilation',
          'Handling build errors'
        ],
        relatedCode: 'ninja-build'
      },
      {
        id: 'testing',
        title: 'Running and Testing',
        startTime: 2100,
        endTime: 2400,
        description: 'Running your custom Chromium build',
        keyPoints: [
          'Running the built browser',
          'Basic testing procedures',
          'Iterative development workflow'
        ]
      }
    ],
    
    codeExamples: [
      {
        id: 'depot-tools-setup',
        title: 'depot_tools Installation',
        language: 'bash',
        code: `# Download depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git

# Add to PATH (add to your shell's rc file)
export PATH="$PATH:/path/to/depot_tools"

# Verify installation
which gclient
gclient --version`,
        description: 'Commands to install and configure depot_tools',
        chapterIds: ['depot-tools'],
        filename: 'setup_depot_tools.sh',
        runnable: true
      },
      {
        id: 'source-checkout-commands',
        title: 'Chromium Source Checkout',
        language: 'bash',
        code: `# Create workspace directory
mkdir chromium && cd chromium

# Fetch Chromium source
fetch --nohooks chromium

# Navigate to source directory
cd src

# Install additional dependencies
gclient runhooks

# Update to latest
git pull origin main
gclient sync`,
        description: 'Complete source code checkout process',
        chapterIds: ['source-checkout'],
        filename: 'checkout_chromium.sh',
        runnable: true
      },
      {
        id: 'gn-configuration',
        title: 'GN Build Configuration',
        language: 'bash',
        code: `# Generate build configuration for debug build
gn gen out/Debug --args='is_debug=true is_component_build=true'

# Generate release build configuration
gn gen out/Release --args='is_debug=false is_official_build=false'

# Common useful flags
gn gen out/Custom --args='
  is_debug=true
  is_component_build=true
  symbol_level=1
  enable_nacl=false
  remove_webcore_debug_symbols=true
'

# View all available arguments
gn args out/Debug --list`,
        description: 'GN configuration examples for different build types',
        chapterIds: ['build-configuration'],
        filename: 'configure_build.sh',
        runnable: true
      },
      {
        id: 'ninja-build',
        title: 'Building with Ninja',
        language: 'bash',
        code: `# Build main chrome target
ninja -C out/Debug chrome

# Build with specific number of jobs
ninja -C out/Debug -j 8 chrome

# Build all targets
ninja -C out/Debug

# Build specific components
ninja -C out/Debug content_shell
ninja -C out/Debug unit_tests

# Show build progress
ninja -C out/Debug -v chrome`,
        description: 'Ninja build commands and options',
        chapterIds: ['building'],
        filename: 'build_chromium.sh',
        runnable: true
      }
    ],
    
    relatedTutorials: ['chromium-architecture-overview', 'debugging-chromium'],
    relatedArticles: ['getting-started/setup-build.md', 'getting-started/code-directory-structure.md'],
    
    author: 'Build Team',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-18'),
    thumbnailUrl: 'https://example.com/thumbnails/chromium-build.jpg'
  },
  
  {
    id: 'debugging-chromium',
    title: 'Debugging Chromium: Tools and Techniques',
    description: 'Comprehensive guide to debugging Chromium, covering browser debugging, renderer debugging, crash analysis, and performance profiling.',
    videoUrl: 'https://example.com/videos/debugging-chromium.mp4',
    duration: 2700, // 45 minutes
    difficulty: 'advanced',
    category: 'Development Tools',
    tags: ['debugging', 'gdb', 'chrome-devtools', 'profiling', 'crash-analysis'],
    
    learningObjectives: [
      'Master browser process debugging techniques',
      'Debug renderer processes effectively',
      'Analyze crashes and generate meaningful reports',
      'Use performance profiling tools',
      'Understand common debugging scenarios'
    ],
    
    prerequisites: [
      'Chromium build environment setup',
      'C++ debugging knowledge',
      'Understanding of Chromium architecture'
    ],
    
    chapters: [
      {
        id: 'debugging-overview',
        title: 'Debugging Overview and Setup',
        startTime: 0,
        endTime: 300,
        description: 'Introduction to Chromium debugging workflow',
        keyPoints: [
          'Debug vs Release builds',
          'Symbol information',
          'Debugging tool setup'
        ]
      },
      {
        id: 'browser-debugging',
        title: 'Browser Process Debugging',
        startTime: 300,
        endTime: 800,
        description: 'Debugging the main browser process',
        keyPoints: [
          'Attaching debugger to browser process',
          'UI thread debugging',
          'Network stack debugging'
        ],
        relatedCode: 'gdb-browser-debug'
      },
      {
        id: 'renderer-debugging',
        title: 'Renderer Process Debugging',
        startTime: 800,
        endTime: 1300,
        description: 'Debugging web content rendering',
        keyPoints: [
          'Attaching to renderer processes',
          'JavaScript debugging integration',
          'Layout and painting issues'
        ],
        relatedCode: 'renderer-debug-setup'
      },
      {
        id: 'crash-analysis',
        title: 'Crash Analysis and Reporting',
        startTime: 1300,
        endTime: 1800,
        description: 'Analyzing crashes and generating reports',
        keyPoints: [
          'Reading crash dumps',
          'Stack trace analysis',
          'Crash reporting pipeline'
        ],
        relatedCode: 'crash-analysis-tools'
      },
      {
        id: 'performance-profiling',
        title: 'Performance Profiling',
        startTime: 1800,
        endTime: 2300,
        description: 'Profiling performance bottlenecks',
        keyPoints: [
          'CPU profiling with perf',
          'Memory profiling tools',
          'GPU debugging'
        ],
        relatedCode: 'profiling-commands'
      },
      {
        id: 'advanced-techniques',
        title: 'Advanced Debugging Techniques',
        startTime: 2300,
        endTime: 2700,
        description: 'Advanced debugging strategies and tools',
        keyPoints: [
          'Custom debugging builds',
          'Logging and tracing',
          'Automated debugging workflows'
        ]
      }
    ],
    
    codeExamples: [
      {
        id: 'gdb-browser-debug',
        title: 'GDB Browser Process Debugging',
        language: 'bash',
        code: `# Start Chromium with debugging symbols
gdb out/Debug/chrome

# Set useful breakpoints
(gdb) break BrowserMain
(gdb) break WebContentsImpl::NavigateToURL

# Run with arguments
(gdb) run --no-sandbox --disable-gpu

# Examine call stack
(gdb) bt
(gdb) frame 2

# Examine variables
(gdb) print url.spec()
(gdb) info locals`,
        description: 'GDB commands for browser process debugging',
        chapterIds: ['browser-debugging'],
        filename: 'gdb_browser_debug.sh',
        runnable: true
      },
      {
        id: 'renderer-debug-setup',
        title: 'Renderer Process Debug Setup',
        language: 'bash',
        code: `# Start Chrome with renderer debugging flags
./out/Debug/chrome \\
  --no-sandbox \\
  --disable-gpu \\
  --renderer-startup-dialog \\
  --disable-hang-monitor

# Find renderer process ID
ps aux | grep chrome

# Attach GDB to specific renderer
gdb -p <renderer_pid>

# Set renderer-specific breakpoints
(gdb) break RenderViewImpl::OnNavigate
(gdb) break WebFrameImpl::LoadRequest`,
        description: 'Setting up renderer process debugging',
        chapterIds: ['renderer-debugging'],
        filename: 'renderer_debug.sh',
        runnable: true
      },
      {
        id: 'crash-analysis-tools',
        title: 'Crash Analysis Tools',
        language: 'bash',
        code: `# Generate crash dump
ulimit -c unlimited
./out/Debug/chrome --enable-crash-reporter

# Analyze crash dump with GDB
gdb out/Debug/chrome core.12345

# Use addr2line for stack traces
addr2line -e out/Debug/chrome 0x7f8b2c4a5678

# Breakpad symbol upload
./tools/upload_symbols.py out/Debug/chrome

# Crash report parsing
./tools/parse_crash_report.py crash_report.dmp`,
        description: 'Tools and commands for crash analysis',
        chapterIds: ['crash-analysis'],
        filename: 'crash_analysis.sh',
        runnable: true
      },
      {
        id: 'profiling-commands',
        title: 'Performance Profiling Commands',
        language: 'bash',
        code: `# CPU profiling with perf
perf record -g ./out/Debug/chrome --no-sandbox
perf report

# Memory profiling with AddressSanitizer
gn gen out/ASan --args='is_asan=true'
ninja -C out/ASan chrome
./out/ASan/chrome

# Heap profiling
export HEAPPROFILE=/tmp/chrome.heap
./out/Debug/chrome --no-sandbox

# GPU debugging
./out/Debug/chrome --enable-gpu-command-logging
./out/Debug/chrome --enable-gpu-debugging`,
        description: 'Performance profiling and analysis commands',
        chapterIds: ['performance-profiling'],
        filename: 'profiling.sh',
        runnable: true
      }
    ],
    
    relatedTutorials: ['chromium-architecture-overview', 'chromium-build-system'],
    relatedArticles: ['debugging/debugging-tools.md', 'debugging/crash-reports.md'],
    
    author: 'Debug Team',
    createdAt: new Date('2025-01-12'),
    updatedAt: new Date('2025-01-22'),
    thumbnailUrl: 'https://example.com/thumbnails/debugging-chromium.jpg'
  }
];

export const sampleVideoSeries: VideoSeries[] = [
  {
    id: 'chromium-fundamentals',
    title: 'Chromium Development Fundamentals',
    description: 'Complete series covering everything from setup to advanced development techniques',
    tutorials: ['chromium-build-system', 'chromium-architecture-overview', 'debugging-chromium'],
    estimatedDuration: 6900, // Sum of all tutorial durations
    difficulty: 'beginner',
    category: 'Getting Started',
    thumbnailUrl: 'https://example.com/thumbnails/fundamentals-series.jpg'
  }
];

// Helper function to get tutorial by ID
export const getVideoTutorialById = (id: string): VideoTutorial | undefined => {
  return sampleVideoTutorials.find(tutorial => tutorial.id === id);
};

// Helper function to get tutorials by category
export const getVideoTutorialsByCategory = (category: string): VideoTutorial[] => {
  return sampleVideoTutorials.filter(tutorial => tutorial.category === category);
};

// Helper function to get tutorials by difficulty
export const getVideoTutorialsByDifficulty = (difficulty: string): VideoTutorial[] => {
  return sampleVideoTutorials.filter(tutorial => tutorial.difficulty === difficulty);
};
