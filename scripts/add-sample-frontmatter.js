const fs = require('fs');
const path = require('path');

// Sample a few specific files to add frontmatter to as examples
const SAMPLE_FILES = [
    'accessibility/overview.md',
    'architecture/overview.md', 
    'modules/overview.md',
    'development/overview.md',
    'security/overview.md',
    'performance/overview.md',
    'tutorials/overview.md',
    'apis/overview.md',
    'features/overview.md',
    'debugging/overview.md'
];

const CONTENT_DIR = path.join(__dirname, '..', 'public', 'content');

// Category mappings based on directory structure
const categoryMappings = {
    'accessibility': 'Accessibility',
    'architecture': 'Architecture', 
    'modules': 'Core Modules',
    'development': 'Development',
    'security': 'Security',
    'performance': 'Performance',
    'tutorials': 'Tutorials',
    'apis': 'APIs',
    'features': 'Features',
    'debugging': 'Debugging'
};

// Generate proper frontmatter for a file
const generateFrontmatter = (fileName, content) => {
    const pathParts = fileName.split('/');
    const category = categoryMappings[pathParts[0]] || 'Documentation';
    
    // Extract or generate title
    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1].trim() : pathParts[pathParts.length - 1].replace('.md', '').replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Generate description from first paragraph
    let cleanContent = content.replace(/^#+\s+.+$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
    const paragraphs = cleanContent.split('\n\n').filter(p => p.trim().length > 20);
    let description = paragraphs.length > 0 ? paragraphs[0].replace(/\n/g, ' ').trim() : `${title} documentation for Chromium development`;
    if (description.length > 150) {
        description = description.substring(0, 150).replace(/\s+\w*$/, '...');
    }
    
    // Generate tags
    const tags = [pathParts[0]];
    if (fileName.includes('overview')) tags.push('overview');
    if (fileName.includes('testing')) tags.push('testing');
    if (fileName.includes('debugging')) tags.push('debugging');
    
    return `---
title: "${title}"
description: "${description}"
category: "${category}"
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
difficulty: "beginner"
date: "${new Date().toISOString().split('T')[0]}"
author: "Wanderlust Team"
estimated_reading_time: "5 minutes"
---

`;
};

// Process sample files
const addFrontmatterToSampleFiles = () => {
    console.log('🔧 Adding frontmatter to sample overview files...\n');
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const fileName of SAMPLE_FILES) {
        const filePath = path.join(CONTENT_DIR, fileName);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⏭️  ${fileName} - File not found`);
            continue;
        }
        
        processed++;
        const content = fs.readFileSync(filePath, 'utf-8');
        
        if (content.startsWith('---')) {
            console.log(`⏭️  ${fileName} - Already has frontmatter`);
            skipped++;
            continue;
        }
        
        const frontmatter = generateFrontmatter(fileName, content);
        const newContent = frontmatter + content;
        
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✅ ${fileName} - Added frontmatter`);
        updated++;
    }
    
    console.log(`\n📊 Sample Frontmatter Update Results:`);
    console.log(`   ${updated} files updated with frontmatter`);
    console.log(`   ${skipped} files already had frontmatter`);
    console.log(`   ${processed} total files processed`);
};

// Run the sample frontmatter addition
if (require.main === module) {
    addFrontmatterToSampleFiles();
}

module.exports = { addFrontmatterToSampleFiles };