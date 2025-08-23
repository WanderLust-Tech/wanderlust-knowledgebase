# Code Syntax Highlighting Demo

This page demonstrates the enhanced code syntax highlighting capabilities of the Wanderlust Knowledge Base.

## Supported Languages

The knowledge base now supports syntax highlighting for multiple programming languages with copy-to-clipboard functionality and theme-aware styling.

### TypeScript/JavaScript

```typescript
interface BookmarkFeatures {
  pageBookmarks: boolean;
  sectionBookmarks: boolean;
  persistentStorage: boolean;
  searchAndFilter: boolean;
  importExport: boolean;
  categorization: boolean;
}

class BookmarkManager {
  private bookmarks: Map<string, Bookmark> = new Map();
  
  constructor(private storage: Storage) {
    this.loadBookmarks();
  }
  
  async addBookmark(bookmark: Omit<Bookmark, 'id' | 'timestamp'>): Promise<void> {
    const newBookmark: Bookmark = {
      ...bookmark,
      id: this.generateId(),
      timestamp: Date.now(),
    };
    
    this.bookmarks.set(newBookmark.id, newBookmark);
    await this.saveBookmarks();
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
```

### C++ (Chromium Code Example)

```cpp
#include "base/memory/weak_ptr.h"
#include "content/public/browser/browser_context.h"
#include "content/public/browser/render_frame_host.h"

namespace content {

class DownloadManagerDelegate {
 public:
  virtual ~DownloadManagerDelegate() = default;
  
  // Called when a download is created.
  virtual void OnDownloadCreated(DownloadManager* manager,
                                DownloadItem* item) {}
  
  // Determine the download target path.
  virtual bool DetermineDownloadTarget(
      DownloadItem* download,
      const DownloadTargetCallback& callback) {
    return false;
  }
  
  // Check if the download should proceed.
  virtual bool ShouldCompleteDownload(
      DownloadItem* item,
      const base::Closure& complete_callback) {
    return true;
  }
  
 private:
  base::WeakPtrFactory<DownloadManagerDelegate> weak_ptr_factory_{this};
};

}  // namespace content
```

### Python (Build Scripts)

```python
#!/usr/bin/env python3
"""
Chromium build script utilities for the custom browser project.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from typing import List, Optional, Dict

class ChromiumBuilder:
    """Handles building Chromium with custom modifications."""
    
    def __init__(self, source_dir: Path, build_dir: Path):
        self.source_dir = source_dir
        self.build_dir = build_dir
        self.gn_args = {
            'is_debug': False,
            'is_component_build': False,
            'symbol_level': 1,
            'enable_nacl': False,
            'target_cpu': 'x64',
        }
    
    def configure_build(self, custom_args: Optional[Dict[str, any]] = None) -> bool:
        """Configure the build with GN."""
        if custom_args:
            self.gn_args.update(custom_args)
        
        gn_command = [
            'gn', 'gen', str(self.build_dir),
            '--args=' + ' '.join(f'{k}={v}' for k, v in self.gn_args.items())
        ]
        
        try:
            result = subprocess.run(gn_command, cwd=self.source_dir, 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                print(f"GN configuration failed: {result.stderr}")
                return False
            return True
        except Exception as e:
            print(f"Error running GN: {e}")
            return False
    
    def build_target(self, target: str = 'chrome') -> bool:
        """Build the specified target."""
        ninja_command = ['ninja', '-C', str(self.build_dir), target]
        
        try:
            subprocess.run(ninja_command, cwd=self.source_dir, check=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Build failed with exit code {e.returncode}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Build Chromium')
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--build-dir', type=Path, required=True)
    parser.add_argument('--target', default='chrome')
    parser.add_argument('--debug', action='store_true')
    
    args = parser.parse_args()
    
    builder = ChromiumBuilder(args.source_dir, args.build_dir)
    
    if args.debug:
        builder.gn_args['is_debug'] = True
        builder.gn_args['symbol_level'] = 2
    
    if not builder.configure_build():
        sys.exit(1)
    
    if not builder.build_target(args.target):
        sys.exit(1)
    
    print(f"Successfully built {args.target}")

if __name__ == '__main__':
    main()
```

### Bash (Shell Scripts)

```bash
#!/bin/bash
# Chromium development environment setup script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROMIUM_DIR="${SCRIPT_DIR}/chromium"
DEPOT_TOOLS_DIR="${SCRIPT_DIR}/depot_tools"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

install_depot_tools() {
    if [[ ! -d "$DEPOT_TOOLS_DIR" ]]; then
        log_info "Installing depot_tools..."
        git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$DEPOT_TOOLS_DIR"
    else
        log_info "depot_tools already installed, updating..."
        cd "$DEPOT_TOOLS_DIR"
        git pull
    fi
    
    export PATH="$DEPOT_TOOLS_DIR:$PATH"
}

fetch_chromium() {
    if [[ ! -d "$CHROMIUM_DIR" ]]; then
        log_info "Fetching Chromium source code..."
        mkdir -p "$CHROMIUM_DIR"
        cd "$CHROMIUM_DIR"
        fetch --nohooks chromium
    else
        log_info "Chromium already fetched, syncing..."
        cd "$CHROMIUM_DIR/src"
        git pull
        gclient sync
    fi
}

setup_build_environment() {
    cd "$CHROMIUM_DIR/src"
    
    log_info "Installing build dependencies..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        ./build/install-build-deps.sh
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_warn "Please install Xcode and command line tools manually"
    fi
    
    log_info "Running hooks..."
    gclient runhooks
}

main() {
    log_info "Setting up Chromium development environment..."
    
    install_depot_tools
    fetch_chromium
    setup_build_environment
    
    log_info "Setup complete! You can now build Chromium:"
    log_info "  cd $CHROMIUM_DIR/src"
    log_info "  gn gen out/Default"
    log_info "  ninja -C out/Default chrome"
}

main "$@"
```

### JSON Configuration

```json
{
  "name": "wanderlust-knowledgebase",
  "version": "1.0.0",
  "description": "A comprehensive knowledge base for Chromium development",
  "main": "index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "generate-search-index": "node scripts/generate-search-index.js",
    "generate-icons": "node scripts/generate-icons.js"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "react-markdown": "^8.0.5",
    "react-syntax-highlighter": "^15.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.27",
    "@types/react-dom": "^18.0.10",
    "@types/react-syntax-highlighter": "^15.5.6",
    "@vitejs/plugin-react": "^3.1.0",
    "autoprefixer": "^10.4.13",
    "postcss": "^8.4.21",
    "tailwindcss": "^3.2.6",
    "typescript": "^4.9.4",
    "vite": "^4.1.0"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

### SQL Database Schema

```sql
-- User management and preferences
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content bookmarks
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    path VARCHAR(500) NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    section VARCHAR(255),
    anchor VARCHAR(255),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_bookmarks (user_id, created_at),
    INDEX idx_bookmark_path (path),
    INDEX idx_bookmark_category (category)
);

-- Search analytics
CREATE TABLE search_queries (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_search_analytics (created_at, query),
    INDEX idx_popular_searches (results_count DESC, created_at DESC)
);

-- Content feedback and ratings
CREATE TABLE content_feedback (
    id SERIAL PRIMARY KEY,
    article_path VARCHAR(500) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_type ENUM('helpful', 'outdated', 'error', 'suggestion', 'unclear'),
    content TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_content_feedback (article_path, created_at),
    INDEX idx_unresolved_feedback (is_resolved, created_at)
);
```

### CSS Styling

```css
/* Syntax highlighting custom styles */
.code-block-container {
  @apply relative my-4 rounded-lg overflow-hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.code-block-header {
  @apply flex items-center justify-between px-4 py-2 text-sm;
  @apply bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700;
}

.code-block-language {
  @apply text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide;
  font-size: 11px;
  letter-spacing: 0.05em;
}

.code-block-copy-button {
  @apply flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all duration-200;
  @apply bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400;
  @apply hover:bg-gray-300 dark:hover:bg-gray-600;
}

.code-block-copy-button.copied {
  @apply bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300;
}

/* Custom scrollbar for code blocks */
.code-block-container pre::-webkit-scrollbar {
  height: 8px;
}

.code-block-container pre::-webkit-scrollbar-track {
  @apply bg-gray-100 dark:bg-gray-800;
}

.code-block-container pre::-webkit-scrollbar-thumb {
  @apply bg-gray-300 dark:bg-gray-600 rounded;
}

.code-block-container pre::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400 dark:bg-gray-500;
}

/* Inline code styling */
.inline-code {
  @apply bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400;
  @apply px-1.5 py-0.5 rounded text-sm font-mono;
  font-size: 0.875em;
}

/* Line number styling */
.code-line-numbers {
  @apply select-none;
  border-right: 1px solid rgba(156, 163, 175, 0.3);
  margin-right: 1em;
  padding-right: 1em;
  min-width: 2.5em;
  text-align: right;
}
```

## Features

- **Theme-Aware**: Automatically switches between light and dark syntax themes
- **Copy to Clipboard**: One-click copying with visual feedback
- **Language Detection**: Automatic syntax highlighting based on language tags
- **Line Numbers**: For longer code blocks (>5 lines)
- **Responsive Design**: Optimized for all screen sizes
- **Bookmarkable**: Large code blocks can be bookmarked for quick reference

## Inline Code

You can also use `inline code` with proper styling that adapts to the current theme.

## Supported Languages

The syntax highlighter supports over 100 programming languages including:
- JavaScript/TypeScript
- Python
- C/C++
- Java
- Go
- Rust
- Shell/Bash
- SQL
- JSON/YAML
- CSS/SCSS
- HTML
- Markdown
- And many more...

Try copying any of the code blocks above to see the copy functionality in action!
