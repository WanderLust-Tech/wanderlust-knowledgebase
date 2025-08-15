export interface ContentNode {
    title: string;
    path?: string;     // corresponds to public/content/<path>.md
    children?: ContentNode[];
}

export const contentIndex: ContentNode[] = [
    {
        title: "Introduction", children: [
            { title: "Overview", path: "introduction/overview" }
        ]
    },
    {
        title: "Getting Started", children: [
            { title: "Setup & Build", path: "getting-started/setup-build" },
            { title: "Project Layout", path: "getting-started/project-layout" },
            { title: "Code Directory Structure", path: "getting-started/code-directory-structure" }
        ]
    },
    {
        title: "Architecture", children: [
            { title: "Overview", path: "architecture/overview" },
            { title: "Module Layering", path: "architecture/module-layering" },
            { title: "Process Model", path: "architecture/process-model" },
            { title: "IPC Internals", path: "architecture/ipc-internals" },
            { title: "Render Pipeline", path: "architecture/render-pipeline" },
            {
                title: "Design Patterns", children: [
                    { title: "Delegate Pattern", path: "architecture/design-patterns/delegate-pattern" },
                    { title: "Factory Pattern", path: "architecture/design-patterns/factory-pattern" },
                    { title: "Observer Pattern", path: "architecture/design-patterns/observer-pattern" },
                    { title: "Pre/Post Contract Programming", path: "architecture/design-patterns/pre-post-contract" },
                    { title: "State Pattern", path: "architecture/design-patterns/state-pattern" }
                ]
            },
            { title: "Security", children: [
                { title: "Sandbox Architecture", path: "architecture/security/sandbox-architecture" },
            ]},
            { title: "Browser Components", path: "architecture/browser-components" }
        ]
    },
    {
        title: "Modules", children: [
            { title: "Networking (HTTP)", path: "modules/networking-http" },
            { title: "JavaScript (V8)", path: "modules/javascript-v8" },
            {
                title: "Storage & Cache", children: [
                    { title: "Storage & Cache Overview", path: "modules/storage-cache" },
                    { title: "Disk Cache Design Principles", path: "modules/storage-cache/disk-cache-design-principles" }
                ]
            }
        ]
    },
    {
        title: "Security", children: [
            { title: "Security Model", path: "security/security-model" }
        ]
    },
    {
        title: "Debugging", children: [
            { title: "Debugging Tools", path: "debugging/debugging-tools" },
            { title: "Crash Reports", path: "debugging/crash-reports" },
            { title: "Chrome Internals URLs", path: "debugging/chrome-internals-urls" }
        ]
    },
    {
        title: "Contributing", children: [
            { title: "Contributing Guide", path: "contributing/contributing" }
        ]
    }
];