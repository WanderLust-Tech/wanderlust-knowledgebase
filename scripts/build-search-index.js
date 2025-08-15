// Node.js script to index markdown files for search
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const PROJECT_ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'public', 'content');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'public', 'search-index.json');

function getTitle(content) {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function indexFiles() {
  const files = glob.sync('**/*.md', { cwd: CONTENT_DIR, absolute: true });
  const index = files.map(file => {
    const relPath = path.relative(CONTENT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const title = getTitle(content);
    return {
      path: relPath.replace(/\.md$/, ''),
      title,
      content,
    };
  });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`Indexed ${index.length} markdown files.`);
}

indexFiles();
