const fs = require('fs');
const path = require('path');

console.log('Simple test script running...');

const CONTENT_DIR = path.join(__dirname, '..', 'public', 'content');
console.log('Content directory:', CONTENT_DIR);
console.log('Content directory exists:', fs.existsSync(CONTENT_DIR));

if (fs.existsSync(CONTENT_DIR)) {
    const files = fs.readdirSync(CONTENT_DIR);
    console.log('Found directories:', files.slice(0, 5));
}

console.log('Test completed.');