# Wanderlust Knowledge Base

A comprehensive, interactive knowledge base for Chromium development built with React, TypeScript, and modern web technologies.

## 🚀 Features

- **📚 Comprehensive Content**: Structured learning paths for Chromium development
- **🔍 Advanced Search**: Fuzzy search with content preview and highlighting
- **📱 Progressive Web App**: Offline support and installable app
- **🎯 Progress Tracking**: Reading analytics, streaks, and learning paths
- **🌙 Dark/Light Theme**: System-aware theme switching
- **📊 Interactive Diagrams**: Clickable architecture visualizations
- **💻 Code Playground**: Live code execution with Monaco Editor
- **📱 Responsive Design**: Mobile-optimized navigation and layout
- **🔖 Bookmarking**: Save favorite articles and code snippets

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router (Hash-based for static hosting)
- **Content**: Markdown with react-markdown
- **Search**: Fuzzy search with Fuse.js
- **Icons**: Custom PWA icons with Canvas API
- **Deployment**: FTP deployment + GitHub Actions CI/CD

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/WanderLust-Tech/wanderlust-knowledgebase.git
cd wanderlust-knowledgebase

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview built application
npm run build-index      # Generate search index
npm run generate-icons   # Generate PWA icons
npm run deploy           # Build and deploy via FTP
npm run deploy:test      # Test FTP connection
npm run deploy:backup    # Backup current remote files
```

### Project Structure

```
├── public/
│   ├── content/         # Markdown content files
│   └── img/            # Images and diagrams
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   └── routes.tsx      # Route definitions
├── scripts/            # Build and deployment scripts
└── .github/workflows/  # GitHub Actions
```

## 🚀 Deployment

We support multiple deployment methods:

### Quick Deployment (FTP)

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your FTP credentials
   ```

2. **Deploy**:
   ```bash
   npm run deploy
   ```

### GitHub Actions CI/CD

1. **Configure GitHub Secrets** in your repository settings
2. **Push to main/master** for automatic production deployment
3. **Push to develop** for staging deployment

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 📖 Content Structure

Content is organized in `/public/content/` with the following structure:

```
introduction/           # Project overview and introduction
getting-started/        # Setup and build instructions
architecture/           # Browser architecture and design
modules/               # Core Chromium modules
security/              # Security model and practices
debugging/             # Debugging tools and techniques
contributing/          # Contribution guidelines
```

## 🔍 Search System

The knowledge base includes a powerful search system with full-text search, smart suggestions, content preview, and category filtering.

## 📊 Progress Tracking

Track your learning journey with reading progress, learning streaks, completion analytics, and bookmark management.

## 🎮 Interactive Features

### Code Playground
Live code execution with Monaco Editor, multi-language support, and syntax highlighting.

### Interactive Diagrams
Clickable architecture components with tooltip explanations and mobile-responsive controls.

## 🌙 Theming

Automatic theme detection with manual override, persistent user choice, and smooth transitions.

## 📱 PWA Features

Offline access, installable app, background updates, and intelligent caching for fast loading.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./public/content/contributing/contributing.md) for details.

## 📄 License

This project is licensed under the ISC License.

## 🆕 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes and version history.

---

Built with ❤️ by the WanderLust Tech team for the Chromium development community.

’ve sketched out a React+TypeScript starter that:

Reads a simple contentIndex tree to drive a collapsible sidebar.

Fetches static Markdown files from /public/content/... and renders with react-markdown.

Uses React Router’s “catch-all” route to map any /some/path to /public/content/some/path.md.

On the content side, I’ve suggested a directory structure under public/content/:

pgsql
Copy
Edit
introduction/
  overview.md
getting-started/
  setup-build.md
  project-layout.md
architecture/
  process-model.md
  render-pipeline.md
  browser-components.md
modules/
  networking-http.md
  javascript-v8.md
  storage-cache.md
security/
  security-model.md
debugging/
  debugging-tools.md
contributing/
  contributing.md
Each folder and file corresponds to an entry in the sidebar tree. You can expand this by:

Adding metadata (e.g., front-matter in your markdown) and switching to a loader like MDX when you’re ready for interactive examples.

Switching the static files for a headless CMS or database: you’d replace the fetch calls in ArticleView.tsx with an API client.

Styling using Tailwind (as in the example classes) or any design system you prefer.

Feel free to iterate on the contentIndex to reorder sections or add sub-topics. This skeleton should give you a clear path for both the code and the information architecture of your Chromium KB. Let me know if you’d like more detail on any part—e.g. integrating a database, customizing the tree view, or adding search.