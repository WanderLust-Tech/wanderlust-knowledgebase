# Code Directory Structure

This page expands on *Project Layout* with a directory-by-directory tour of Chromium’s `src/` tree.

## Top-Level Folders

- `chrome/` – UI shell, platform glue  
- `content/` – embedder for Blink/V8  
- `third_party/` – bundled libraries (V8, Skia…)  
- `build/` & `tools/` – build scripts, codegen, lint  
- `net/` – networking stack  
- `ui/` – cross-platform toolkit  
- …

_…and so on, pulling in the detailed breakdown from the article…_

**See also:**  
- [Project Layout](project-layout.md) for high-level context  
- [Architecture → Browser Components](../architecture/browser-components.md) for how these pieces fit at runtime