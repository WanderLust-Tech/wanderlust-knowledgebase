const fs = require('fs');
const path = require('path');

// Path configuration
const CONTENT_DIR = path.join(__dirname, '..', 'public', 'content');

// Category mappings based on directory structure
const categoryMappings = {
    'introduction': 'Introduction',
    'getting-started': 'Getting Started',
    'architecture': 'Architecture',
    'design-patterns': 'Architecture',
    'security': 'Security',
    'modules': 'Core Modules',
    'apis': 'APIs',
    'features': 'Features',
    'development': 'Development',
    'debugging': 'Debugging',
    'performance': 'Performance',
    'platforms': 'Platforms',
    'contributing': 'Contributing',
    'tutorials': 'Tutorials',
    'video-tutorials': 'Video Tutorials',
    'demo': 'Interactive Demos',
    'examples': 'Examples',
    'guides': 'Guides',
    'accessibility': 'Accessibility',
    'gpu': 'GPU & Graphics',
    'infra': 'Infrastructure'
};

// Difficulty mappings based on directory and content
const getDifficulty = (filePath, content) => {
    if (filePath.includes('/overview') || filePath.includes('README') || filePath.includes('/intro')) {
        return 'beginner';
    }
    if (filePath.includes('/advanced') || filePath.includes('/internals') || filePath.includes('/security') || filePath.includes('/architecture')) {
        return 'advanced';
    }
    return 'intermediate';
};

// Generate tags based on file path and content
const generateTags = (filePath, content) => {
    const tags = [];
    const pathParts = filePath.split('/').filter(part => part !== '');
    
    // Add path-based tags
    pathParts.forEach(part => {
        if (part !== 'README' && part !== 'overview') {
            tags.push(part.toLowerCase().replace(/_/g, '-'));
        }
    });
    
    // Add content-based tags
    if (content.includes('Android')) tags.push('android');
    if (content.includes('iOS')) tags.push('ios');
    if (content.includes('Windows')) tags.push('windows');
    if (content.includes('macOS') || content.includes('Mac OS')) tags.push('macos');
    if (content.includes('Chrome OS')) tags.push('chromeos');
    if (content.includes('API')) tags.push('api');
    if (content.includes('testing') || content.includes('test')) tags.push('testing');
    if (content.includes('performance')) tags.push('performance');
    if (content.includes('security')) tags.push('security');
    if (content.includes('debugging')) tags.push('debugging');
    
    return [...new Set(tags)]; // Remove duplicates
};

// Extract title from content or generate from filename
const extractTitle = (filePath, content) => {
    // First, try to find an existing H1 title
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
        return h1Match[1].trim();
    }
    
    // Generate from filename
    const filename = path.basename(filePath);
    return filename
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

// Generate description from content
const generateDescription = (content, maxLength = 150) => {
    // Remove frontmatter if it exists
    let cleanContent = content.replace(/^---[\s\S]*?---\n/, '');
    
    // Remove markdown headers
    cleanContent = cleanContent.replace(/^#+\s+.+$/gm, '');
    
    // Remove code blocks
    cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code
    cleanContent = cleanContent.replace(/`[^`]+`/g, '');
    
    // Remove links
    cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Get first meaningful paragraph
    const paragraphs = cleanContent.split('\n\n').filter(p => p.trim().length > 20);
    
    if (paragraphs.length === 0) {
        return 'Documentation for Chromium development';
    }
    
    let description = paragraphs[0].replace(/\n/g, ' ').trim();
    
    if (description.length > maxLength) {
        description = description.substring(0, maxLength).replace(/\s+\w*$/, '...');
    }
    
    return description;
};

// Estimate reading time based on content length
const estimateReadingTime = (content) => {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / wordsPerMinute));
    return `${minutes} minutes`;
};

// Generate frontmatter for a file
const generateFrontmatter = (filePath, content) => {
    const relativePath = path.relative(CONTENT_DIR, filePath).replace(/\\/g, '/');
    const pathParts = relativePath.split('/');
    const category = categoryMappings[pathParts[0]] || 'Development';
    
    const title = extractTitle(relativePath, content);
    const description = generateDescription(content);
    const tags = generateTags(relativePath, content);
    const difficulty = getDifficulty(relativePath, content);
    const estimatedReading = estimateReadingTime(content);
    
    return `---
title: "${title}"
description: "${description}"
category: "${category}"
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
difficulty: "${difficulty}"
date: "${new Date().toISOString().split('T')[0]}"
author: "Wanderlust Team"
estimated_reading_time: "${estimatedReading}"
---

`;
};

// Process a single file to add frontmatter
const addFrontmatterToFile = (filePath, dryRun = true) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check if frontmatter already exists
        if (content.startsWith('---')) {
            return { status: 'skipped', reason: 'Already has frontmatter' };
        }
        
        const frontmatter = generateFrontmatter(filePath, content);
        const newContent = frontmatter + content;
        
        if (!dryRun) {
            fs.writeFileSync(filePath, newContent, 'utf-8');
            return { status: 'updated', frontmatter };
        } else {
            return { status: 'would-update', frontmatter };
        }
    } catch (error) {
        return { status: 'error', reason: error.message };
    }
};

// Process all markdown files in a directory
const addFrontmatterToAllFiles = (directory = CONTENT_DIR, dryRun = true) => {
    console.log(`🔧 ${dryRun ? 'Analyzing' : 'Adding'} frontmatter to markdown files...\n`);
    
    let stats = { updated: 0, skipped: 0, errors: 0 };
    
    const processDirectory = (dir) => {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                processDirectory(fullPath);
            } else if (entry.endsWith('.md')) {
                const relativePath = path.relative(CONTENT_DIR, fullPath).replace(/\\/g, '/');
                const result = addFrontmatterToFile(fullPath, dryRun);
                
                switch (result.status) {
                    case 'updated':
                    case 'would-update':
                        stats.updated++;
                        console.log(`✅ ${relativePath}`);
                        if (dryRun) {
                            console.log('   Preview:');
                            console.log('   ' + result.frontmatter.split('\n').slice(0, 5).join('\n   '));
                        }
                        break;
                    case 'skipped':
                        stats.skipped++;
                        console.log(`⏭️  ${relativePath} - ${result.reason}`);
                        break;
                    case 'error':
                        stats.errors++;
                        console.log(`❌ ${relativePath} - ${result.reason}`);
                        break;
                }
            }
        }
    };
    
    processDirectory(directory);
    
    console.log(`\n📊 Summary:`);
    console.log(`   ${stats.updated} files ${dryRun ? 'would be updated' : 'updated'}`);
    console.log(`   ${stats.skipped} files skipped (already have frontmatter)`);
    console.log(`   ${stats.errors} files had errors`);
    
    if (dryRun) {
        console.log(`\nTo apply changes, run: node scripts/add-frontmatter.js --apply`);
    }
    
    return stats;
};

// Main execution
if (require.main === module) {
    console.log('Script starting...');
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--apply');
    
    console.log(`Running in ${dryRun ? 'dry-run' : 'apply'} mode`);
    console.log(`Content directory: ${CONTENT_DIR}`);
    console.log(`Directory exists: ${fs.existsSync(CONTENT_DIR)}`);
    
    addFrontmatterToAllFiles(CONTENT_DIR, dryRun);
}

module.exports = { addFrontmatterToAllFiles, addFrontmatterToFile, generateFrontmatter };