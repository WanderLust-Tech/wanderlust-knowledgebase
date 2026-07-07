# Claude Instructions — wanderlust-knowledgebase

## What This Repo Is

A React SPA learning platform for Chromium browser development. Contains 342 markdown content files covering Chromium architecture, APIs, debugging, accessibility, and development practices. Features fuzzy search (Fuse.js), Monaco code playground, interactive diagrams (@xyflow/react + Mermaid), SignalR real-time community features, progress tracking, bookmarks, and full PWA/offline support.

Backend: `wanderlust-api` (.NET 8). Production: `https://kb.wander-lust.tech`.

## Tech Stack

- **React 18** + **TypeScript 5** (strict mode)
- **Vite 7** (dev server on :5173, build tool)
- **React Router v6** — hash-based routing (`/#/subject/path`) required for static hosting
- **Tailwind CSS 3** + custom CSS
- **Fuse.js** — client-side fuzzy search against a pre-built index
- **Monaco Editor** — code playground
- **@xyflow/react** + **Mermaid** — interactive and generated diagrams
- **@microsoft/signalr** — real-time community features
- **React Context** (9 providers) — no Redux

## Key Commands

```bash
npm run dev          # Vite dev server on :5173
npm run build        # Build search index → Vite build → dist/
npm run build-index  # Rebuild search index only (public/search-index.json)
npm run preview      # Serve dist/ locally
npm run lint         # TypeScript type check
npm run deploy       # Build + FTP deploy to production
npm run deploy:staging
```

## Directory Structure

```
public/
├── content/            # 342 markdown content files
│   ├── chromium/       # Primary content (300+ files)
│   ├── frontend/
│   └── minecraft/
└── search-index.json   # Pre-built Fuse.js index (generated at build time)
src/
├── contentIndex.ts     # Sidebar navigation tree — single source of truth for all content paths
├── components/         # 61 React components
│   ├── auth/           # Login, Register, UserProfile
│   ├── renderers/      # Custom markdown renderers (CodeBlock, InteractiveDiagram)
│   ├── EnhancedArticleView.tsx  # Main article display
│   ├── AdvancedSearchComponent.tsx
│   ├── ProgressDashboard.tsx
│   └── CommunityPage.tsx
├── contexts/           # 9 Context providers (AuthContext, ThemeContext, ProgressContext, etc.)
├── services/           # AuthService, ContentService, CommunityService, SearchService, etc.
├── hooks/              # useRealTimeNotifications, useAnalytics, useCodeExamples
└── routes.tsx          # App routing + provider nesting order
```

## Content System

- **`contentIndex.ts`** (45 KB) is the sidebar source of truth. Every article must have an entry here.
- **Path format**: `subject/category/subcategory/filename` — **no `.md` extension**, forward slashes only.
- **File location**: `public/content/<path>.md` — must match the path in `contentIndex.ts` exactly.
- **Title**: extracted from the first `# Heading` in the markdown file — no frontmatter required.
- **Adding content**: add the markdown file to `public/content/`, add a `ContentNode` entry to `contentIndex.ts`, then run `npm run build-index` to update the search index.

## Document Conventions

**Naming:** kebab-case only — `process-model.md`, `setup-build.md`. No numbered prefixes; ordering is controlled by `contentIndex.ts`, not the filesystem.

**Frontmatter** (add to all new documents):
```yaml
---
title: "Short, descriptive title"
description: "One or two sentences for search preview and SEO."
category: "Architecture"   # Architecture | Security | APIs | Development | Debugging | Accessibility | Performance
tags: ["ipc", "security"]  # lowercase, relevant keywords
difficulty: "beginner"     # beginner | intermediate | advanced
date: "2026-07-02"
author: "Wanderlust Team"
estimated_reading_time: "5 minutes"
---
```

Note: ~35% of existing docs predate this schema and omit frontmatter. New docs should always include it.

**Heading hierarchy:**
- `# H1` — document title (matches frontmatter `title`)
- `## H2` — major sections
- `### H3` — subsections
- `#### H4` — code examples / deep dives

**Section patterns by document type:**

| Type | Typical sections |
|------|-----------------|
| Overview | What You'll Find Here, Quick Start Guide, Key Concepts |
| Architecture | Architectural Philosophy, Design Principles, Implementation Details |
| Getting Started | Prerequisites, Setup, Quick Start |
| Feature | Overview, API Interfaces, Configuration, Performance Considerations |
| Tutorial | Prerequisites, Step-by-Step Instructions, Code Examples, Troubleshooting |

**Internal links in markdown files:** use relative paths *with* the `.md` extension (unlike `contentIndex.ts` paths which have no extension):
```markdown
[Process Model](../architecture/process-model.md)
[Setup Build](../getting-started/setup-build.md)
```

**Code blocks:** always include a language specifier (` ```cpp `, ` ```bash `, ` ```typescript `).

---

## Routing

- Hash-based: `/#/chromium/architecture/process-model` → loads `public/content/chromium/architecture/process-model.md`
- Required for static hosting (no server-side routing).
- Subjects: `chromium`, `frontend`, `minecraft` — routes are subject-prefixed.

## State Management

- **React Context only** — no Redux.
- **9 Context providers** — order in `routes.tsx` matters: `AuthProvider` must be outermost; `SubjectProvider` must be inside Router.
- **localStorage** — used for bookmarks, progress, theme, and offline caching.
- **SignalR hub**: `${VITE_API_URL}/hubs/community` — gracefully degrades if API unavailable.

## Environment Variables (Build-Time)

```
VITE_API_URL=http://localhost:5070   # Backend API URL — embedded at build time, NOT runtime
VITE_APP_TITLE=Wanderlust Knowledge Base
VITE_APP_VERSION=4.3.9
```

`VITE_API_URL` is baked in at `npm run build` — changing it requires a full rebuild. For local dev, set in `.env.development`.

## Critical Rules

- **Search index must be current**: `npm run build` regenerates it automatically, but if you add content without building, run `npm run build-index` manually. A stale index means new content is unsearchable.
- **Strict TypeScript**: no `any` types without explicit casts; path aliases `@/` → `src/`.
- **`VITE_API_URL` is build-time**: changes require a full rebuild; not hot-reloadable.
- **Context provider order**: adding a new context requires updating both `routes.tsx` and `index.tsx`; wrong order causes null-context crashes.
- **Content paths**: no `.md` extension, forward slashes — even on Windows.
- **Version in `package.json`**: this is the single source of truth for app version and triggers GitHub Actions CI/CD deploys.

## Deployment

GitHub Actions triggers on version change in `package.json` (or manual dispatch):
- `develop` branch → staging
- `main`/`master` → production (with automatic backup)

FTP credentials and `VITE_API_URL` are injected via GitHub Secrets at build time.

## Ecosystem Role

**This is the documentation home for all WanderLust repos.** All feature docs, architecture guides, how-tos, and migration notes for the entire ecosystem live here — not in individual repos.

Content locations by source:

| Source | Location in this repo |
|--------|-----------------------|
| custom-browser features | `chromium/features/custom-browser/` |
| Branding guides | `chromium/features/custom-browser/branding/` |
| Bloomberg/Helium ports | `chromium/features/custom-browser/bloomberg/` · `chromium/features/custom-browser/helium/` |
| NTP / remote_ntp | `chromium/features/custom-browser/ntp/` |
| Chromium version migrations | `chromium/development/` |
| Build & infra | `chromium/infra/` |
| Troubleshooting | `chromium/debugging/` |
| Architecture analysis | `chromium/architecture/` |

Calls `wanderlust-api` for auth, community features, and enriched content. Standalone — no dependency on `custom-browser` Chromium code at runtime.
