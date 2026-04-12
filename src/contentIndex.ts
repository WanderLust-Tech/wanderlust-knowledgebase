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
            { title: "Custom Browser Overview", path: "introduction/custom-browser-overview" },
            { title: "Chromium Documentation Index", path: "chromium-docs-index" }
        ]
    },

    // PHASE 2: GETTING STARTED & SETUP
    {
        title: "Getting Started",
        description: "Essential setup and orientation for new developers",
        children: [
            { title: "Getting Started Overview", path: "getting-started/overview" },
            { title: 'Setup & Build System', path: 'getting-started/setup-build' },
            { title: "Build Performance & Optimization", path: "getting-started/build-performance-optimization" },
            { title: "Project Layout", path: "getting-started/project-layout" },
            { title: "Code Directory Structure", path: "getting-started/code-directory-structure" },
            {
                title: "Platform-Specific Build Instructions", 
                children: [
                    { title: "Windows Build", path: "platforms/windows/windows_build_instructions" },
                    { title: "Mac Build", path: "platforms/mac/mac_build_instructions" },
                    { title: "Android Build", path: "platforms/android/android_build_instructions" },
                    { title: "Chrome OS Build", path: "platforms/chromeos/chromeos_build_instructions" },
                    { title: "iOS Build", path: "platforms/ios/ios_build_instructions" },
                    { title: "Android Cast Build", path: "platforms/android/android_cast_build_instructions" }
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
            { title: "Process Model and Site Isolation", path: "architecture/process_model_and_site_isolation" },
            { title: "Module Layering", path: "architecture/module-layering" },
            { title: "Browser Components", path: "architecture/browser-components" },
            { title: "IPC Internals", path: "architecture/ipc-internals" },
            { title: "Navigation Architecture", path: "architecture/navigation" },
            { title: "Navigation Concepts", path: "architecture/navigation_concepts" },
            { title: "Frame Trees", path: "architecture/frame_trees" },
            { title: "Life of a Frame", path: "architecture/life_of_a_frame" },
            { title: "Threading & Tasks", path: "architecture/threading" },
            { title: "Startup Architecture", path: "architecture/startup" },
            { title: "Sandbox Overview", path: "architecture/sandbox" },
            { title: "Sandbox FAQ", path: "architecture/sandbox_faq" },
            { title: "iOS Sandbox Forcefield", path: "architecture/ios_sandbox_forcefield" },
            { title: "UI Design Principles", path: "architecture/ui-design-principles" },
            { title: "UI Library Fundamentals", path: "architecture/ui-library-fundamentals" },
            { title: "UI Framework & Aura Architecture", path: "architecture/ui-framework-aura" },
            { title: "Custom Browser Architecture", path: "architecture/custom-browser-architecture" },
            {
                title: "Rendering System",
                children: [
                    { title: "Rendering Architecture Fundamentals", path: "architecture/rendering-architecture-fundamentals" },
                    { title: "Render Pipeline (Modern)", path: "architecture/render-pipeline" },
                    { title: "Chromium Compositor (CC)", path: "architecture/chromium-compositor-cc" },
                    { title: "Direct Rendering Display Compositor (DrDc)", path: "architecture/drdc-architecture" },
                    { title: "Graphics Layer Tree Creation", path: "architecture/graphics-layer-tree-creation" },
                    { title: "CC Layer Tree Creation", path: "architecture/cc-layer-tree-creation" },
                    { title: "GPU Synchronization", path: "architecture/gpu_synchronization" }
                ]
            },
            {
                title: "Threading & Concurrency",
                description: "Comprehensive analysis of Chromium's task-based threading model and asynchronous communication patterns",
                children: [
                    { title: "Threading and Tasks in Chrome", path: "architecture/threading_and_tasks" },
                    { title: "Task Posting Patterns", path: "architecture/task-posting-patterns" },
                    { 
                        title: "Threading Model Implementation Analysis", 
                        path: "architecture/threading-implementation",
                        description: "Deep dive into MessageLoop, RunLoop, WaitableEvent, and platform-specific threading implementations with detailed source code analysis"
                    }
                ]
            }
        ]
    },

    // PHASE 4: DESIGN PATTERNS & BEST PRACTICES
    {
        title: "Design Patterns",
        description: "Common patterns and practices used throughout Chromium",
        children: [
            { title: "Design Patterns Overview", path: "architecture/design-patterns/overview" },
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
        children: [            { title: "Security Overview", path: "security/overview" },
            { title: "Architecture Security Overview", path: "architecture/security/overview" },            { title: "Security Model Overview", path: "security/security-model" },
            { title: "Advanced Mojo IPC & Security Research", path: "security/advanced-mojo-ipc-security" },
            { title: "Sandbox Architecture", path: "architecture/security/sandbox-architecture" },
            { title: "Security Checklist", path: "security/checklist" },
            { title: "Browser Protocol Schemes", path: "security/browser-protocol-schemes" },
            {
                title: "Security Research",
                children: [
                    { title: "Security Research README", path: "security/research/README" },
                    { title: "Graphics Research Overview", path: "security/research/graphics/overview" },
                    { title: "Graphics Research README", path: "security/research/graphics/README" },
                    { title: "Graphics Vulnerabilities README", path: "security/research/graphics/vulnerabilities/README" },
                    { title: "RenderFrameHost UAF Vulnerability Analysis", path: "security/research/renderframehost-uaf-analysis" },
                    { title: "V8 SuperIC Type Confusion Vulnerability Analysis", path: "security/research/v8-superic-type-confusion-analysis" }
                ]
            },
            {
                title: "Platform Security",
                children: [
                    { title: "Android IPC Security", path: "security/android-ipc" },
                    { title: "Android Sandbox", path: "security/android-sandbox" },
                    { title: "AppArmor User Namespace Restrictions", path: "security/apparmor-userns-restrictions" }
                ]
            },
            {
                title: "Web Security",
                children: [
                    { title: "Autofill Across iframes", path: "security/autofill-across-iframes" },
                    { title: "Mixed Content Autoupgrade", path: "security/autoupgrade-mixed" },
                    { title: "Behavior Over Internet", path: "security/behavior-over-the-internet" },
                    { title: "CSP (Content Security Policy)", path: "security/csp" },
                    { title: "CORS and Fetch", path: "security/cors-rfc1918" }
                ]
            },
            {
                title: "Security Tools & Testing",
                children: [
                    { title: "ClusterFuzz for Shepherds", path: "security/clusterfuzz-for-shepherds" },
                    { title: "Fuzzing in Chrome", path: "security/fuzzing" },
                    { title: "Security FAQ", path: "security/faq" },
                    { title: "Security Severity Guidelines", path: "security/severity-guidelines" },
                    { title: "Security Tips for Developers", path: "security/security-tips" }
                ]
            }
        ]
    },

    // PHASE 6: CORE MODULES & SYSTEMS
    {
        title: "Core Modules",
        description: "Deep dive into key Chromium subsystems",
        children: [
            { title: "Modules Overview", path: "modules/overview" },
            { title: "JavaScript Engine (V8)", path: "modules/javascript-v8" },
            { title: "V8 Compiler Internals", path: "modules/v8-compiler-internals" },
            { title: "Plugin Architecture & Process Management", path: "modules/plugin-architecture" },
            { title: "Plugin 3D Rendering Architecture", path: "modules/plugin-3d-rendering" },
            { title: "Networking & HTTP", path: "modules/networking-http" },
            {
                title: "Storage & Caching System",
                children: [
                    { title: "Storage & Caching Overview", path: "modules/storage-cache/overview" },
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
            { title: "APIs & Services README", path: "apis/README" },
            { title: "APIs & Services Overview", path: "apis/overview" },
            { title: "API Reference", path: "apis/api-reference" },
            { title: "Scripts Reference", path: "apis/scripts-reference" },
            { title: "Mojo & Services", path: "apis/mojo_and_services" },
            { title: "Mojo IPC Conversion", path: "apis/mojo_ipc_conversion" },
            { title: "Servicification", path: "apis/servicification" },
            { title: "Mojo Testing", path: "apis/mojo_testing" }
        ]
    },

    // PHASE 7.5: CUSTOM BROWSER FEATURES
    {
        title: "Custom Browser Features",
        description: "Wanderlust Custom Browser specific features and implementations",
        children: [
            { title: "Features README", path: "features/README" },
            { title: "Features Overview", path: "features/custom-browser/README" },
            {
                title: "Core Features",
                children: [
                    { title: "Custom Cache Feature", path: "features/custom-browser/custom-cache-feature" },
                    { title: "Remote New Tab Page System", path: "features/custom-browser/remote-ntp-documentation" },
                    { title: "RSS Feed Support", path: "features/custom-browser/rss-feed-support" },
                    { title: "RSS User Guide", path: "features/custom-browser/rss-user-guide" },
                    { title: "Privacy Guard", path: "features/custom-browser/privacy-guard" },
                    { title: "Vertical Tabs UI", path: "features/custom-browser/vertical-tabs-ui" },
                    { title: "Custom Settings UI", path: "features/custom-browser/custom-settings-ui" },
                    { title: "Custom Download Shelf", path: "features/custom-browser/custom-download-shelf" },
                    { title: "Tab Shapes Feature", path: "features/custom-browser/tab-shapes-feature" }
                ]
            },
            {
                title: "Modernized Browser Features (v1.1.0)",
                children: [
                    { title: "Feature Flag Management", path: "features/custom-browser/feature-flag-management" },
                    { title: "Enhanced Scroll Animations", path: "features/custom-browser/enhanced-scroll-animations" },
                    { title: "JavaScript Content Controls", path: "features/custom-browser/javascript-content-controls" },
                    { title: "Advanced Download Management", path: "features/custom-browser/advanced-download-management" },
                    { title: "Reader Mode Integration", path: "features/custom-browser/reader-mode-integration" }
                ]
            },
            {
                title: "System Features",
                children: [
                    { title: "Multi-Brand System", path: "features/custom-browser/multi-brand-system" },
                    { title: "Google API Suppression", path: "features/custom-browser/google-api-suppression" },
                    { title: "Enhanced Omnibox", path: "features/custom-browser/enhanced-omnibox" },
                    { title: "Build System Integration", path: "features/custom-browser/build-system-integration" }
                ]
            },
            {
                title: "Legacy Documentation",
                children: [
                    { title: "Custom Features Implementation", path: "features/custom-browser/custom-features-implementation" },
                    { title: "RSS Restoration Summary", path: "features/custom-browser/rss-feature-restoration-summary" }
                ]
            }
        ]
    },

    // PHASE 7.6: FEATURES & IMPLEMENTATIONS
    {
        title: "Features & Implementations",
        description: "Chrome feature implementations and development case studies",
        children: [
            {
                title: "Extension & API Features",
                children: [
                    { title: "Extension API System Architecture", path: "features/extension-api-system" },
                    { title: "Native Messaging API: Web-to-App Communication", path: "features/native-messaging-api" }
                ]
            },
            {
                title: "Platform Integration Features",
                children: [
                    {
                        title: "Native OS Notifications Integration",
                        path: "features/native-os-notifications",
                        description: "Cross-platform integration with native OS notification systems including Windows Action Center and macOS Notification Center"
                    }
                ]
            },
            {
                title: "Performance & Web Acceleration Features",
                children: [
                    {
                        title: "Web Prerendering: Predictive Page Loading",
                        path: "features/web-prerendering",
                        description: "Comprehensive technical analysis of Chromium's prerendering technology for instant page loads"
                    }
                ]
            },
            {
                title: "Privacy & Security Features",
                children: [
                    { 
                        title: "Privacy Budget: Anti-Fingerprinting Technology", 
                        path: "features/privacy-budget",
                        description: "Comprehensive analysis of Google's Privacy Budget proposal for combating browser fingerprinting"
                    },
                    {
                        title: "Application Isolation and Storage Partitioning",
                        path: "features/application-isolation",
                        description: "Evolution from experimental isolated apps to modern storage partitioning and application security architecture"
                    },
                    { title: "DNS-over-HTTPS UI Implementation", path: "features/dns-over-https-ui" }
                ]
            }
        ]
    },

    // PHASE 8: DEVELOPMENT WORKFLOW
    {
        title: "Development Workflow",
        description: "Tools, processes, and best practices for Chromium development",
        children: [            { title: "Development README", path: "development/README" },            { title: "Development Overview", path: "development/overview" },
            { title: "Browser Industry Economics", path: "development/browser-industry-economics" },
            {
                title: "Custom Browser Development",
                children: [
                    { title: "Custom Browser Development Guide", path: "development/custom-browser-development" },
                    { title: "Custom Browser Build System", path: "development/custom-browser-build-system" }
                ]
            },
            {
                title: "Infrastructure & CI/CD",
                children: [
                    { title: "Commit Queue (CQ)", path: "infra/cq" },
                    { title: "New Builder Setup", path: "infra/new_builder" },
                    { title: "Trybot Usage", path: "infra/trybot_usage" },
                    { title: "Using LED (Chromium Test Tool)", path: "infra/using_led" },
                    { title: "Watchlists", path: "infra/watchlists" }
                ]
            },
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
                    { title: "Modern C++ Features in Chromium", path: "development/modern-cpp-features" },
                    { title: "Rust in Chromium", path: "development/rust" },
                    { title: "Rust Unsafe Guidelines", path: "development/rust-unsafe" },
                    { title: "Rust Community Perspectives", path: "development/rust-community-perspectives" },
                    { title: "Smart Pointer Implementation", path: "development/smart-pointer-implementation" }
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
                title: "Chrome OS Integration Testing",
                children: [
                    { title: "Chrome OS Integration README", path: "development/testing/chromeos_integration/README" },
                    { title: "Chrome OS Development Guide", path: "development/testing/chromeos_integration/development_guide" },
                    { title: "Crosier Metadata", path: "development/testing/chromeos_integration/crosier_metadata" },
                    { title: "Navbar Testing", path: "development/testing/navbar" }
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
        children: [            { title: "Performance README", path: "performance/README" },            { title: "Performance Overview", path: "performance/overview" },
            { title: "Profiling Techniques", path: "performance/profiling" },
            { title: "Profile Guided Optimization (PGO)", path: "performance/pgo" },
            { title: "Order File Optimization", path: "performance/orderfile" },
            { title: "Profiling Content Shell on Android", path: "performance/profiling_content_shell_on_android" }
        ]
    },

    // PHASE 11: ACCESSIBILITY
    {
        title: "Accessibility",
        description: "Making Chromium accessible to users with disabilities",
        children: [
            { title: "Accessibility Overview", path: "accessibility/overview" },
            { title: "Accessibility Guidelines", path: "accessibility/README" },
            {
                title: "Assistive Technologies",
                children: [
                    { title: "ChromeVox Screen Reader", path: "accessibility/assistive-technologies/chromevox" },
                    { title: "ChromeVox Desktop Linux", path: "accessibility/assistive-technologies/chromevox-desktop-linux" },
                    { title: "Select to Speak", path: "accessibility/assistive-technologies/select-to-speak" },
                    { title: "AutoClick", path: "accessibility/assistive-technologies/autoclick" },
                    { title: "Text-to-Speech (TTS)", path: "accessibility/assistive-technologies/tts" },
                    { title: "BRLTTY (Braille Display)", path: "accessibility/assistive-technologies/brltty" },
                    { title: "eSpeak Speech Synthesis", path: "accessibility/assistive-technologies/espeak" },
                    { title: "PATTS Speech Engine", path: "accessibility/assistive-technologies/patts" }
                ]
            },
            {
                title: "Platform-Specific Features",
                children: [
                    { title: "Android Accessibility", path: "accessibility/features/android" },
                    { title: "Offscreen Accessibility", path: "accessibility/features/offscreen" },
                    { title: "Reader Mode Accessibility", path: "accessibility/features/reader-mode" }
                ]
            },
            {
                title: "Development & Testing",
                children: [
                    { title: "Accessibility Performance", path: "accessibility/development/performance" },
                    { title: "Accessibility Testing", path: "accessibility/development/testing" }
                ]
            },
            {
                title: "Release Notes",
                children: [
                    { title: "Accessibility Release Notes", path: "accessibility/release-notes/relnotes" }
                ]
            }
        ]
    },

    // PHASE 12: GPU & GRAPHICS
    {
        title: "GPU & Graphics",
        description: "Graphics processing, GPU testing, and rendering pipeline",
        children: [
            { title: "GPU Testing Overview", path: "gpu/gpu_testing" },
            { title: "GPU Testing Bot Details", path: "gpu/gpu_testing_bot_details" },
            { title: "GPU Pixel Testing with Gold", path: "gpu/gpu_pixel_testing_with_gold" },
            { title: "Debugging GPU Related Code", path: "gpu/debugging_gpu_related_code" },
            { title: "WebGL Bug Triage", path: "gpu/webgl_bug_triage" },
            { title: "Pixel Wrangling", path: "gpu/pixel_wrangling" },
            { title: "Sync Token Internals", path: "gpu/sync_token_internals" },
            { title: "VA-API (Video Acceleration API)", path: "gpu/vaapi" }
        ]
    },

    // PHASE 13: PLATFORM-SPECIFIC DEVELOPMENT
    {
        title: "Platform-Specific Development",
        description: "Platform-specific considerations and implementations",
        children: [
            { title: "Platforms README", path: "platforms/README" },
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
            { title: "Debugging Overview", path: "debugging/overview" },
            { title: "Debugging Guide", path: "debugging/debugging-guide" },
            { title: "Debugging Tools Overview", path: "debugging/debugging-tools", description: "Comprehensive guide to Chrome DevTools for web content and UI DevTools for desktop interface debugging, plus additional debugging tools and techniques" },
            { title: "Chrome Internals URLs", path: "debugging/chrome-internals-urls" },
            { title: "Command Line Switches", path: "debugging/command-line-switches" },
            { title: "Crash Reports Analysis", path: "debugging/crash-reports" },
            { title: "Troubleshooting", path: "debugging/troubleshooting" },
            {
                title: "Advanced Debugging",
                children: [
                    { title: "Android Debugging Instructions", path: "debugging/android_debugging_instructions" },
                    { title: "Debugging with Crash Keys", path: "debugging/debugging_with_crash_keys" },
                    { title: "GDB Init", path: "debugging/gdbinit" },
                    { title: "LLDB Init", path: "debugging/lldbinit" },
                    { title: "Graphical Debugging Aid for Views", path: "debugging/graphical_debugging_aid_chromium_views" }
                ]
            }
        ]
    },

    // PHASE 13: CONTRIBUTING TO CHROMIUM
    {
        title: "Contributing to Chromium",
        description: "Guidelines and processes for contributing to the Chromium project",
        children: [            { title: "Contributing Overview", path: "contributing/overview" },            { title: "Contributing Guide", path: "contributing/contributing" },
            { title: "Web Standards Participation", path: "contributing/standards-participation" }
        ]
    },

    // PHASE 14: INTERACTIVE TUTORIALS
    {
        title: "Interactive Tutorials",
        description: "Hands-on, guided learning experiences for mastering Chromium development",
        children: [
            { title: "Learning Hub", path: "tutorials/overview" },
            { title: "Tutorial System Demo", path: "tutorials/tutorial-system-demo" },
            { title: "Chromium Development Tutorials", path: "tutorials/interactive-chromium-tutorials" },
            { 
                title: "Browser Customization Guide", 
                path: "tutorials/browser-customization-guide",
                description: "Complete guide to creating custom Chromium-based browsers with real-world examples"
            }
        ]
    },

    // PHASE 15: VIDEO TUTORIALS
    {
        title: "Video Tutorials",
        description: "Interactive video-based learning experiences with synchronized code examples",
        children: [
            { title: "Video Learning Hub", path: "video-tutorials/overview" },
            {
                title: "Getting Started Videos",
                description: "Video tutorials for beginners",
                children: [
                    { title: "Setting Up Chromium Build Environment", path: "video-tutorials/chromium-build-system" }
                ]
            },
            {
                title: "Architecture Deep Dives",
                description: "Advanced architectural concepts with visual explanations",
                children: [
                    { title: "Chromium Architecture Deep Dive", path: "video-tutorials/chromium-architecture-overview" }
                ]
            },
            {
                title: "Development Tools",
                description: "Debugging, profiling, and development workflows",
                children: [
                    { title: "Debugging Chromium: Tools and Techniques", path: "video-tutorials/debugging-chromium" }
                ]
            },
            {
                title: "Learning Series",
                description: "Structured learning paths with multiple videos",
                children: [
                    { title: "Chromium Development Fundamentals", path: "video-series/chromium-fundamentals" }
                ]
            }
        ]
    },

    // PHASE 18: CODE EXAMPLES & REFERENCES
    {
        title: "Code Examples & References",
        description: "Practical code examples and reference implementations",
        children: [
            { title: "Code Examples README", path: "code-examples/README" },
            { title: "Mermaid Examples", path: "examples/mermaid-examples" },
            { title: "Mermaid Guide", path: "guides/mermaid-guide" }
        ]
    },

    // PHASE 18: INTERACTIVE DEMOS & EXAMPLES
    {
        title: "Interactive Demos & Examples",
        description: "Hands-on examples and interactive learning tools",
        children: [
            { title: "Bookmark Features Demo", path: "demo/bookmark-features" },
            { title: "Syntax Highlighting Demo", path: "demo/syntax-highlighting" },
            { title: "Enhanced Component Architecture", path: "demo/enhanced-component-architecture" },
            { title: "Code Playground", path: "demo/code-playground" },
            { title: "C++ & Chromium Development", path: "demo/cpp-chromium-playground" },
            { title: "Interactive Diagrams", path: "demo/interactive-diagrams" },
            { title: "Progress Tracking", path: "demo/progress-tracking" }
        ]
    }
];