export interface ContentNode {
    title: string;
    path?: string;     // corresponds to public/content/<path>.md
    children?: ContentNode[];
    description?: string; // Optional description for better understanding
}

export const contentIndex: ContentNode[] = [
    // LEARNING PATH GUIDE
    {
        title: "Learning Path Guide",
        description: "Your complete roadmap to mastering Chromium development",
        path: "learning-path-guide"
    },

    // PHASE 1: INTRODUCTION & OVERVIEW
    {
        title: "Introduction",
        description: "Start here to understand what Chromium is and why it matters",
        children: [
            { title: "What is Chromium?", path: "introduction/overview" },
            { title: "Chromium Documentation Index", path: "chromium-docs-index" }
        ]
    },

    // PHASE 2: GETTING STARTED & SETUP
    {
        title: "Getting Started",
        description: "Essential setup and orientation for new developers",
        children: [
            { title: "Setup & Build Overview", path: "getting-started/setup-build" },
            { title: "Project Layout", path: "getting-started/project-layout" },
            { title: "Code Directory Structure", path: "getting-started/code-directory-structure" },
            {
                title: "Platform-Specific Build Instructions", 
                children: [
                    { title: "Windows Build", path: "development/build/windows_build_instructions" },
                    { title: "Mac Build", path: "development/build/mac_build_instructions" },
                    { title: "Android Build", path: "development/build/android_build_instructions" },
                    { title: "Chrome OS Build", path: "development/build/chromeos_build_instructions" },
                    { title: "iOS Build", path: "development/build/ios_build_instructions" },
                    { title: "Android Cast Build", path: "development/build/android_cast_build_instructions" }
                ]
            }
        ]
    },

    // PHASE 3: FUNDAMENTAL ARCHITECTURE
    {
        title: "Core Architecture",
        description: "Understanding Chromium's fundamental design and structure",
        children: [
            { title: "Architecture Overview", path: "architecture/overview" },
            { title: "Process Model", path: "architecture/process-model" },
            { title: "Module Layering", path: "architecture/module-layering" },
            { title: "Browser Components", path: "architecture/browser-components" },
            { title: "IPC Internals", path: "architecture/ipc-internals" },
            { title: "Render Pipeline", path: "architecture/render-pipeline" }
        ]
    },

    // PHASE 4: DESIGN PATTERNS & BEST PRACTICES
    {
        title: "Design Patterns",
        description: "Common patterns and practices used throughout Chromium",
        children: [
            { title: "Delegate Pattern", path: "architecture/design-patterns/delegate-pattern" },
            { title: "Factory Pattern", path: "architecture/design-patterns/factory-pattern" },
            { title: "Observer Pattern", path: "architecture/design-patterns/observer-pattern" },
            { title: "State Pattern", path: "architecture/design-patterns/state-pattern" },
            { title: "Pre/Post Contract Programming", path: "architecture/design-patterns/pre-post-contract" }
        ]
    },

    // PHASE 5: SECURITY FUNDAMENTALS
    {
        title: "Security Architecture",
        description: "Understanding Chromium's security model and sandbox architecture",
        children: [
            { title: "Security Model Overview", path: "security/security-model" },
            { title: "Sandbox Architecture", path: "architecture/security/sandbox-architecture" }
        ]
    },

    // PHASE 6: CORE MODULES & SYSTEMS
    {
        title: "Core Modules",
        description: "Deep dive into key Chromium subsystems",
        children: [
            { title: "JavaScript Engine (V8)", path: "modules/javascript-v8" },
            { title: "Networking & HTTP", path: "modules/networking-http" },
            {
                title: "Storage & Caching System",
                children: [
                    { title: "Storage Overview", path: "modules/storage-cache" },
                    { title: "Disk Cache Design", path: "modules/storage-cache/disk-cache-design-principles" }
                ]
            }
        ]
    },

    // PHASE 7: APIs & SERVICES
    {
        title: "APIs & Services",
        description: "Modern Chromium APIs and service architecture",
        children: [
            { title: "APIs & Services Overview", path: "apis/overview" },
            { title: "Mojo & Services", path: "apis/mojo_and_services" },
            { title: "Mojo IPC Conversion", path: "apis/mojo_ipc_conversion" },
            { title: "Servicification", path: "apis/servicification" },
            { title: "Mojo Testing", path: "apis/mojo_testing" }
        ]
    },

    // PHASE 8: DEVELOPMENT WORKFLOW
    {
        title: "Development Workflow",
        description: "Tools, processes, and best practices for Chromium development",
        children: [
            { title: "Development Overview", path: "development/overview" },
            { title: "Git Cookbook", path: "development/git_cookbook" },
            { title: "Git Tips", path: "development/git_tips" },
            { title: "Git Submodules", path: "development/git_submodules" },
            { title: "Code Reviews", path: "development/code_reviews" },
            {
                title: "Code Quality Tools",
                children: [
                    { title: "Clang Overview", path: "development/clang" },
                    { title: "ClangD Setup", path: "development/clangd" },
                    { title: "Clang Format", path: "development/clang_format" },
                    { title: "Clang Tidy", path: "development/clang_tidy" },
                    { title: "Clang Static Analyzer", path: "development/clang_static_analyzer" },
                    { title: "Clang Tool Refactoring", path: "development/clang_tool_refactoring" },
                    { title: "Code Coverage", path: "development/clang_code_coverage_wrapper" }
                ]
            },
            {
                title: "Language-Specific Guides",
                children: [
                    { title: "Rust in Chromium", path: "development/rust" },
                    { title: "Rust Unsafe Guidelines", path: "development/rust-unsafe" }
                ]
            },
            {
                title: "Maintenance & Gardening",
                children: [
                    { title: "Clang Gardening", path: "development/clang_gardening" },
                    { title: "Clang Sheriffing", path: "development/clang_sheriffing" }
                ]
            }
        ]
    },

    // PHASE 9: TESTING & QUALITY ASSURANCE
    {
        title: "Testing & QA",
        description: "Comprehensive testing strategies and tools",
        children: [
            { title: "Testing in Chromium", path: "development/testing/testing_in_chromium" },
            { title: "Code Coverage", path: "development/testing/code_coverage" },
            { title: "Code Coverage in Gerrit", path: "development/testing/code_coverage_in_gerrit" },
            { title: "Life of Increasing Coverage", path: "development/testing/life_of_increasing_code_coverage" },
            {
                title: "Test Infrastructure",
                children: [
                    { title: "Test Descriptions", path: "development/testing/test_descriptions" },
                    { title: "Test Executable API", path: "development/testing/test_executable_api" },
                    { title: "Test Wrapper API", path: "development/testing/test_wrapper_api" },
                    { title: "Test Browser Dialog", path: "development/testing/test_browser_dialog" },
                    { title: "ResultDB", path: "development/testing/resultdb" },
                    { title: "JSON Test Results Format", path: "development/testing/json_test_results_format" }
                ]
            },
            {
                title: "Web Platform Testing",
                children: [
                    { title: "Web Platform Tests", path: "development/testing/web_platform_tests" },
                    { title: "Running WPT", path: "development/testing/run_web_platform_tests" },
                    { title: "WPT on Android", path: "development/testing/run_web_platform_tests_on_android" },
                    { title: "WPT Flake Addressing", path: "development/testing/web_platform_tests_addressing_flake" }
                ]
            },
            {
                title: "Web Tests (Legacy)",
                children: [
                    { title: "Web Tests Overview", path: "development/testing/web_tests" },
                    { title: "Writing Web Tests", path: "development/testing/writing_web_tests" },
                    { title: "Web Tests in Content Shell", path: "development/testing/web_tests_in_content_shell" },
                    { title: "Web Tests on Linux", path: "development/testing/web_tests_linux" },
                    { title: "Web Tests Tips", path: "development/testing/web_tests_tips" },
                    { title: "Baseline Fallback", path: "development/testing/web_test_baseline_fallback" },
                    { title: "Test Expectations", path: "development/testing/web_test_expectations" },
                    { title: "Expectation Files", path: "development/testing/expectation_files" },
                    { title: "Manual Fallback", path: "development/testing/web_tests_with_manual_fallback" },
                    { title: "Addressing Flake", path: "development/testing/web_tests_addressing_flake" }
                ]
            },
            {
                title: "Android Testing",
                children: [
                    { title: "Android Test Instructions", path: "development/testing/android_test_instructions" },
                    { title: "Android GTests", path: "development/testing/android_gtests" },
                    { title: "Android Instrumentation Tests", path: "development/testing/android_instrumentation_tests" },
                    { title: "Android Robolectric Tests", path: "development/testing/android_robolectric_tests" },
                    { title: "Batching Instrumentation Tests", path: "development/testing/batching_instrumentation_tests" }
                ]
            },
            {
                title: "Debugging & Troubleshooting",
                children: [
                    { title: "Chrome OS Debugging Tips", path: "development/testing/chromeos_debugging_tips" },
                    { title: "Repro Bot Failures", path: "development/testing/how_to_repro_bot_failures" },
                    { title: "GTest Flake Tips", path: "development/testing/gtest_flake_tips" },
                    { title: "Order-Dependent Tests", path: "development/testing/identifying_tests_that_depend_on_order" },
                    { title: "Disabling Tests", path: "development/testing/on_disabling_tests" },
                    { title: "Linux ASan Tests", path: "development/testing/linux_running_asan_tests" },
                    { title: "Crashpad with Content Shell", path: "development/testing/using_crashpad_with_content_shell" }
                ]
            },
            {
                title: "Advanced Testing Tools",
                children: [
                    { title: "IPC Fuzzer", path: "development/testing/ipc_fuzzer" }
                ]
            }
        ]
    },

    // PHASE 10: PERFORMANCE & OPTIMIZATION
    {
        title: "Performance & Optimization",
        description: "Performance analysis and optimization techniques",
        children: [
            { title: "Performance Overview", path: "performance/overview" },
            { title: "Profiling Techniques", path: "performance/profiling" },
            { title: "Profile Guided Optimization (PGO)", path: "performance/pgo" },
            { title: "Order File Optimization", path: "performance/orderfile" },
            { title: "Profiling Content Shell on Android", path: "performance/profiling_content_shell_on_android" }
        ]
    },

    // PHASE 11: PLATFORM-SPECIFIC DEVELOPMENT
    {
        title: "Platform-Specific Development",
        description: "Platform-specific considerations and implementations",
        children: [
            { title: "Platforms Overview", path: "platforms/overview" },
            {
                title: "Android Development",
                children: [
                    { title: "Android Overview", path: "platforms/android/README" }
                ]
            },
            {
                title: "Chrome OS Development", 
                children: [
                    { title: "Chrome OS Overview", path: "platforms/chromeos/README" }
                ]
            },
            {
                title: "iOS Development",
                children: [
                    { title: "iOS Overview", path: "platforms/ios/README" }
                ]
            },
            {
                title: "macOS Development",
                children: [
                    { title: "macOS Overview", path: "platforms/mac/README" }
                ]
            },
            {
                title: "Windows Development",
                children: [
                    { title: "Windows Overview", path: "platforms/windows/README" }
                ]
            }
        ]
    },

    // PHASE 12: DEBUGGING & TROUBLESHOOTING
    {
        title: "Debugging & Troubleshooting",
        description: "Tools and techniques for debugging Chromium issues",
        children: [
            { title: "Debugging Tools Overview", path: "debugging/debugging-tools" },
            { title: "Chrome Internals URLs", path: "debugging/chrome-internals-urls" },
            { title: "Crash Reports Analysis", path: "debugging/crash-reports" }
        ]
    },

    // PHASE 13: CONTRIBUTING TO CHROMIUM
    {
        title: "Contributing to Chromium",
        description: "Guidelines and processes for contributing to the Chromium project",
        children: [
            { title: "Contributing Guide", path: "contributing/contributing" }
        ]
    },

    // PHASE 14: INTERACTIVE TUTORIALS
    {
        title: "Interactive Tutorials",
        description: "Hands-on, guided learning experiences for mastering Chromium development",
        children: [
            { title: "Learning Hub", path: "tutorials/overview" },
            { title: "Tutorial System Demo", path: "tutorials/tutorial-system-demo" },
            { title: "Chromium Development Tutorials", path: "tutorials/interactive-chromium-tutorials" }
        ]
    },

    // PHASE 15: INTERACTIVE DEMOS & EXAMPLES
    {
        title: "Interactive Demos & Examples",
        description: "Hands-on examples and interactive learning tools",
        children: [
            { title: "Syntax Highlighting Demo", path: "demo/syntax-highlighting" },
            { title: "Enhanced Component Architecture", path: "demo/enhanced-component-architecture" },
            { title: "Code Playground", path: "demo/code-playground" },
            { title: "C++ & Chromium Development", path: "demo/cpp-chromium-playground" },
            { title: "Interactive Diagrams", path: "demo/interactive-diagrams" },
            { title: "Progress Tracking", path: "demo/progress-tracking" }
        ]
    }
];