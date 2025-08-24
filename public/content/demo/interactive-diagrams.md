# Interactive Architecture Diagrams

Explore Chromium's architecture through interactive diagrams. Click on components to learn more about their roles and responsibilities.

## Chromium Multi-Process Architecture

This diagram shows the high-level process architecture of Chromium. Each process runs in its own sandbox for security and stability.

```interactive-diagram
{
  "title": "Chromium Multi-Process Architecture",
  "description": "Click on processes to learn about their responsibilities and security boundaries",
  "height": 500,
  "interactive": true,
  "controls": true,
  "miniMap": true,
  "background": true,
  "nodes": [
    {
      "id": "browser-process",
      "type": "chromium-process",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Browser Process",
        "description": "Main process that manages the UI, network, and coordinates other processes",
        "details": "The browser process is the main process in Chromium. It handles the browser UI, manages tabs, bookmarks, history, and coordinates communication between other processes.",
        "icon": "",
        "processType": "browser",
        "links": [
          { "title": "Browser Process Documentation", "url": "#/architecture/process-model" },
          { "title": "Process Model Overview", "url": "#/architecture/overview" }
        ]
      }
    },
    {
      "id": "renderer-process-1",
      "type": "chromium-process",
      "position": { "x": 400, "y": 50 },
      "data": {
        "label": "Renderer Process",
        "description": "Renders web content, executes JavaScript, handles DOM manipulation",
        "details": "Each tab typically runs in its own renderer process. This provides isolation between tabs and websites for security and stability.",
        "icon": "",
        "processType": "renderer",
        "links": [
          { "title": "Render Pipeline", "url": "#/architecture/render-pipeline" },
          { "title": "Blink Architecture", "url": "#/modules/javascript-v8" }
        ]
      }
    },
    {
      "id": "renderer-process-2",
      "type": "chromium-process",
      "position": { "x": 400, "y": 150 },
      "data": {
        "label": "Renderer Process",
        "description": "Another tab's renderer process (isolated)",
        "icon": "",
        "processType": "renderer"
      }
    },
    {
      "id": "gpu-process",
      "type": "chromium-process",
      "position": { "x": 100, "y": 250 },
      "data": {
        "label": "GPU Process",
        "description": "Handles graphics acceleration and compositing",
        "details": "The GPU process manages hardware acceleration for graphics rendering, video decoding, and UI compositing.",
        "icon": "",
        "processType": "gpu",
        "links": [
          { "title": "GPU Architecture", "url": "#/architecture/browser-components" }
        ]
      }
    },
    {
      "id": "network-process",
      "type": "chromium-process",
      "position": { "x": 100, "y": 350 },
      "data": {
        "label": "Network Process",
        "description": "Manages network requests, caching, and security",
        "details": "Handles all network communication, HTTP/HTTPS requests, caching, and network security policies.",
        "icon": "",
        "processType": "network",
        "links": [
          { "title": "Network Stack", "url": "#/modules/networking-http" },
          { "title": "Storage & Cache", "url": "#/modules/storage-cache" }
        ]
      }
    },
    {
      "id": "utility-process",
      "type": "chromium-process",
      "position": { "x": 400, "y": 300 },
      "data": {
        "label": "Utility Process",
        "description": "Handles various utility tasks like audio, device access",
        "details": "Runs services that need sandboxing but don't fit into other process types. Examples include audio service, device service, and storage service.",
        "icon": "",
        "processType": "utility",
        "links": [
          { "title": "Process Model", "url": "#/architecture/process-model" }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "browser-renderer1",
      "source": "browser-process",
      "target": "renderer-process-1",
      "label": "IPC",
      "description": "Inter-process communication for tab management",
      "type": "smoothstep",
      "animated": true,
      "markerEnd": { "type": "arrowclosed", "color": "#374151" }
    },
    {
      "id": "browser-renderer2",
      "source": "browser-process",
      "target": "renderer-process-2",
      "label": "IPC",
      "type": "smoothstep",
      "animated": true,
      "markerEnd": { "type": "arrowclosed", "color": "#374151" }
    },
    {
      "id": "browser-gpu",
      "source": "browser-process",
      "target": "gpu-process",
      "label": "Graphics Commands",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed", "color": "#374151" }
    },
    {
      "id": "browser-network",
      "source": "browser-process",
      "target": "network-process",
      "label": "Network Requests",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed", "color": "#374151" }
    },
    {
      "id": "renderer1-gpu",
      "source": "renderer-process-1",
      "target": "gpu-process",
      "label": "Rendering",
      "type": "smoothstep",
      "style": { "stroke": "#dc2626", "strokeDasharray": "5,5" },
      "markerEnd": { "type": "arrowclosed", "color": "#dc2626" }
    },
    {
      "id": "renderer2-gpu",
      "source": "renderer-process-2",
      "target": "gpu-process",
      "label": "Rendering",
      "type": "smoothstep",
      "style": { "stroke": "#dc2626", "strokeDasharray": "5,5" },
      "markerEnd": { "type": "arrowclosed", "color": "#dc2626" }
    },
    {
      "id": "browser-utility",
      "source": "browser-process",
      "target": "utility-process",
      "label": "Services",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed", "color": "#374151" }
    }
  ]
}
```

## Blink Rendering Engine Components

This diagram shows the internal structure of Blink, the rendering engine used in Chromium's renderer processes.

```interactive-diagram
{
  "title": "Blink Rendering Engine Architecture",
  "description": "Explore the components that transform HTML, CSS, and JavaScript into rendered web pages",
  "height": 600,
  "interactive": true,
  "controls": true,
  "background": true,
  "nodes": [
    {
      "id": "html-parser",
      "type": "chromium-component",
      "position": { "x": 50, "y": 50 },
      "data": {
        "label": "HTML Parser",
        "description": "Parses HTML markup into DOM tree",
        "details": "Converts HTML text into a Document Object Model (DOM) tree structure that represents the document's structure and content.",
        "icon": "📄",
        "componentType": "content",
        "links": [
          { "title": "Render Pipeline", "url": "#/architecture/render-pipeline" }
        ]
      }
    },
    {
      "id": "css-parser",
      "type": "chromium-component",
      "position": { "x": 50, "y": 150 },
      "data": {
        "label": "CSS Parser",
        "description": "Parses CSS stylesheets and computes styles",
        "details": "Parses CSS stylesheets and creates CSSOM (CSS Object Model). Handles selector matching and style computation.",
        "icon": "",
        "componentType": "content"
      }
    },
    {
      "id": "layout-engine",
      "type": "chromium-component",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Layout Engine",
        "description": "Calculates element positions and sizes",
        "details": "Performs layout calculations to determine the position and size of each element based on CSS rules and content.",
        "icon": "",
        "componentType": "blink",
        "links": [
          { "title": "Render Pipeline", "url": "#/architecture/render-pipeline" }
        ]
      }
    },
    {
      "id": "paint-engine",
      "type": "chromium-component",
      "position": { "x": 300, "y": 200 },
      "data": {
        "label": "Paint Engine",
        "description": "Converts layout tree to paint instructions",
        "details": "Generates paint operations (draw commands) that describe how to render each element visually.",
        "icon": "",
        "componentType": "blink"
      }
    },
    {
      "id": "v8-engine",
      "type": "chromium-component",
      "position": { "x": 50, "y": 300 },
      "data": {
        "label": "V8 JavaScript Engine",
        "description": "Executes JavaScript code and manages DOM APIs",
        "details": "High-performance JavaScript engine that compiles and executes JavaScript, manages memory, and provides DOM/Web APIs.",
        "icon": "",
        "componentType": "v8",
        "links": [
          { "title": "JavaScript Integration", "url": "#/modules/javascript-v8" }
        ]
      }
    },
    {
      "id": "compositor",
      "type": "chromium-component",
      "position": { "x": 550, "y": 150 },
      "data": {
        "label": "Compositor",
        "description": "Composites layers for GPU acceleration",
        "details": "Manages compositing layers and coordinates with the GPU process for hardware-accelerated rendering.",
        "icon": "🔧",
        "componentType": "blink",
        "links": [
          { "title": "GPU Architecture", "url": "#/architecture/browser-components" }
        ]
      }
    },
    {
      "id": "dom",
      "type": "default",
      "position": { "x": 300, "y": 50 },
      "data": {
        "label": "DOM Tree",
        "description": "Document Object Model representation",
        "icon": ""
      }
    },
    {
      "id": "render-tree",
      "type": "default",
      "position": { "x": 550, "y": 100 },
      "data": {
        "label": "Render Tree",
        "description": "Combined DOM + Style tree for rendering",
        "icon": ""
      }
    }
  ],
  "edges": [
    {
      "id": "html-dom",
      "source": "html-parser",
      "target": "dom",
      "label": "creates",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "css-layout",
      "source": "css-parser",
      "target": "layout-engine",
      "label": "styles",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "dom-layout",
      "source": "dom",
      "target": "layout-engine",
      "label": "structure",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "layout-render",
      "source": "layout-engine",
      "target": "render-tree",
      "label": "generates",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "layout-paint",
      "source": "layout-engine",
      "target": "paint-engine",
      "label": "layout info",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "paint-compositor",
      "source": "paint-engine",
      "target": "compositor",
      "label": "paint ops",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "render-compositor",
      "source": "render-tree",
      "target": "compositor",
      "label": "layers",
      "type": "smoothstep",
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "v8-dom",
      "source": "v8-engine",
      "target": "dom",
      "label": "DOM API",
      "type": "smoothstep",
      "style": { "stroke": "#f59e0b", "strokeDasharray": "3,3" },
      "markerEnd": { "type": "arrowclosed", "color": "#f59e0b" }
    },
    {
      "id": "v8-layout",
      "source": "v8-engine",
      "target": "layout-engine",
      "label": "style changes",
      "type": "smoothstep",
      "style": { "stroke": "#f59e0b", "strokeDasharray": "3,3" },
      "markerEnd": { "type": "arrowclosed", "color": "#f59e0b" }
    }
  ]
}
```

## IPC (Inter-Process Communication) Flow

Understanding how different processes communicate is crucial for Chromium development.

```interactive-diagram
{
  "title": "IPC Message Flow Example",
  "description": "Follow a typical user interaction from browser UI to web content rendering",
  "height": 400,
  "interactive": true,
  "controls": true,
  "nodes": [
    {
      "id": "user",
      "type": "default",
      "position": { "x": 50, "y": 200 },
      "data": {
        "label": "User",
        "description": "User clicks a link in the browser",
        "icon": "👤"
      }
    },
    {
      "id": "browser-ui",
      "type": "chromium-process",
      "position": { "x": 200, "y": 200 },
      "data": {
        "label": "Browser UI",
        "description": "Browser process handles UI events",
        "processType": "browser",
        "icon": "🖥️"
      }
    },
    {
      "id": "renderer",
      "type": "chromium-process",
      "position": { "x": 400, "y": 200 },
      "data": {
        "label": "Renderer",
        "description": "Renderer process handles the navigation",
        "processType": "renderer",
        "icon": ""
      }
    },
    {
      "id": "network",
      "type": "chromium-process",
      "position": { "x": 600, "y": 200 },
      "data": {
        "label": "Network",
        "description": "Network process fetches the resource",
        "processType": "network",
        "icon": ""
      }
    }
  ],
  "edges": [
    {
      "id": "user-browser",
      "source": "user",
      "target": "browser-ui",
      "label": "1. Click",
      "type": "smoothstep",
      "animated": true,
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "browser-renderer",
      "source": "browser-ui",
      "target": "renderer",
      "label": "2. Navigate IPC",
      "type": "smoothstep",
      "animated": true,
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "renderer-network",
      "source": "renderer",
      "target": "network",
      "label": "3. Fetch Request",
      "type": "smoothstep",
      "animated": true,
      "markerEnd": { "type": "arrowclosed" }
    },
    {
      "id": "network-renderer-back",
      "source": "network",
      "target": "renderer",
      "label": "4. Response",
      "type": "smoothstep",
      "style": { "stroke": "#16a34a" },
      "markerEnd": { "type": "arrowclosed", "color": "#16a34a" }
    },
    {
      "id": "renderer-browser-back",
      "source": "renderer",
      "target": "browser-ui",
      "label": "5. Update UI",
      "type": "smoothstep",
      "style": { "stroke": "#16a34a" },
      "markerEnd": { "type": "arrowclosed", "color": "#16a34a" }
    }
  ]
}
```

## Learning Notes

### Key Concepts Demonstrated:

1. **Process Isolation**: Each process runs in its own sandbox for security
2. **IPC Communication**: Processes communicate through well-defined message interfaces
3. **Component Separation**: Different responsibilities are clearly separated
4. **Security Boundaries**: Renderer processes are heavily sandboxed

### Interactive Features:

- **Click nodes** to see detailed descriptions and links to relevant documentation
- **Drag nodes** to rearrange the diagram for better understanding
- **Use mouse wheel** to zoom in/out for different levels of detail
- **Minimap** (when enabled) provides overview of large diagrams

### Next Steps:

Explore the linked documentation pages to dive deeper into each component's implementation details and design principles.
