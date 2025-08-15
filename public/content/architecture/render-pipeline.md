# Render Pipeline

Chromium’s render pipeline transforms HTML, CSS and JS into pixels on your screen. In this article we’ll cover each major stage, the threads involved, and how Chromium optimizes for smooth, high-performance rendering.

---

## 1. Overview & Motivation

- **Goals**  
  - **Speed**: keep 60 FPS (or higher) on modern devices  
  - **Smoothness**: avoid jank by minimizing main-thread work per frame  
  - **Efficiency**: only repaint and composite what changed  
- **Key Processes**  
  - **Browser Process**: coordinates navigation & input  
  - **Renderer Process**: does parsing, style, layout, paint  
  - **GPU Process**: handles compositing & rasterization

*(Link back to [Architecture → Process Model](../process-model.md) for IPC & sandbox context.)*

---

## 2. Stage 1 – Document Parsing & DOM Construction

1. **HTML Tokenizer**  
   - Splits raw bytes into tokens  
2. **DOM Tree Builder**  
   - Builds a tree of `Node` objects  
   - Handles `<script>` tags: may pause parsing for execution  
3. **Incremental Loading**  
   - Streaming parser allows progressive rendering  

```text
HTML → [Tokenizer] → Tokens → [Parser] → DOM Tree
3. Stage 2 – CSS Style Resolution
CSSOM Build

Parses stylesheets into a CSSOM tree

Style Matching

Matches selectors against DOM nodes

Computes ResolvedStyle for each node

Inheritance & Computed Values

Propagate font, color, etc.

Calculate final numeric values (px, em, rem)

text
Copy
Edit
CSS → [Tokenizer] → CSSOM → [Style Resolver] + DOM → Styled Tree
4. Stage 3 – Layout (Reflow)
Box Tree Construction

Wraps styled nodes into layout boxes (block, inline, etc.)

Flow & Positioning

Computes sizes & positions based on box model, floats, flex, grid

Fragmentation

Splits content across lines, pages, columns

Thread: main thread

Output: LayoutObject tree with geometry

5. Stage 4 – Paint Preparation
Paint Record Generation

Translates LayoutObject into paint commands (drawRect, drawText, etc.)

Display List Creation

Serializes paint commands into a “display list” per layer

Layerization

Decides which elements should live on separate compositing layers
(e.g. fixed position, CSS transforms, video)

Key Class: DisplayItemList

6. Stage 5 – Rasterization
Raster Threads

A thread pool converts display lists into GPU/uploadable bitmaps

Tile-Based Raster

Splits large layers into tiles for incremental updates

Caching

Retain raster results when content hasn’t changed

Artifacts: SkBitmap or Skia GPU textures

7. Stage 6 – Compositing & Presentation
GPU Process

Receives layer trees via Mojo

Builds a scene graph

Merge Passes

Combines layers, applies opacity, transforms

Frame Submission

Submits via GPU APIs (OpenGL, Vulkan, Metal) to the OS

VSync Sync

Ties frame submission to display refresh

Outcome: smooth on-screen frame

8. Threading & Pipelining

Thread	Work
Main	DOM, CSSOM, style, layout, paint commands
Compositor	Layer tree updates, IPC to GPU process
Raster	Display list → bitmaps
GPU	Texture uploads, draw calls to GPU driver
Worker	JS Web Workers (if used by page scripts)
Chromium overlaps raster & GPU work across frames to maximize throughput.

9. Optimizations & Techniques
Partial Dirty-Rect: only repaint changed tiles

Deferred Paint: skip painting layers not in viewport

Zero-Copy Video: direct GPU texture for video frames

Smooth Scrolling: compositor-only scroll without main thread

10. Debugging & Instrumentation
chrome://tracing

Visualize pipeline stages & thread timelines

Layer Borders

--show-composited-layer-borders flag

Paint Flashing

--show-paint-rects to highlight repaints

DevTools Performance Tab

Flamethrower view of scripting & rendering

11. Next Steps
Read Architecture → Browser Components for cross-process services.

Deep dive into Modules → Storage & Cache for how caching interacts with painting.

Experiment: enable --enable-gpu-rasterization and measure FPS via chrome://gpu.

End of Render Pipeline deep-dive.

pgsql
Copy
Edit

**Notes on usage:**

- Each stage can link out to more granular articles (e.g. “CSS Style Resolution” → a CSS pipeline deep-dive).  
- Diagrams (SVG/PNG) are highly recommended between sections to visualize the hand-off points.  
- Adjust flags and artifacts to reflect any upstream changes in Chromium’s codebase.