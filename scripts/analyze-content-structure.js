const fs = require('fs');
const path = require('path');

// Path configuration
const CONTENT_DIR = path.join(__dirname, '..', 'public', 'content');
const CONTENT_INDEX_PATH = path.join(__dirname, '..', 'src', 'contentIndex.ts');

// Extract all paths from contentIndex.ts
function extractPathsFromIndex() {
    const indexContent = fs.readFileSync(CONTENT_INDEX_PATH, 'utf-8');
    const pathMatches = indexContent.match(/path:\s*['"](.*?)['"][\s,}]/g) || [];
    
    return pathMatches.map(match => {
        const pathMatch = match.match(/path:\s*['"](.*?)['"][\s,}]/);
        return pathMatch ? pathMatch[1] : null;
    }).filter(Boolean);
}

// Get all markdown files in content directory
function getAllMarkdownFiles(dir = CONTENT_DIR, basePath = '') {
    let files = [];
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files = files.concat(getAllMarkdownFiles(fullPath, path.join(basePath, item)));
            } else if (item.endsWith('.md')) {
                const relativePath = path.join(basePath, item.replace('.md', ''));
                files.push(relativePath.replace(/\\/g, '/')); // Normalize path separators
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
    }
    
    return files;
}

// Check frontmatter in a file
function checkFrontmatter(filePath) {
    try {
        const content = fs.readFileSync(path.join(CONTENT_DIR, filePath + '.md'), 'utf-8');
        const hasFrontmatter = content.startsWith('---');
        
        if (hasFrontmatter) {
            const frontmatterEnd = content.indexOf('---', 3);
            if (frontmatterEnd === -1) return { valid: false, reason: 'Invalid frontmatter format' };
            
            const frontmatter = content.substring(3, frontmatterEnd).trim();
            const requiredFields = ['title', 'description', 'category'];
            const hasRequiredFields = requiredFields.every(field => 
                frontmatter.includes(`${field}:`));
            
            return {
                valid: true,
                hasRequiredFields,
                frontmatter: frontmatter.split('\n').slice(0, 5).join('\n') + '...'
            };
        }
        
        return { valid: false, reason: 'No frontmatter' };
    } catch (error) {
        return { valid: false, reason: error.message };
    }
}

// Main analysis function
function analyzeContentStructure() {
    console.log('🔍 Analyzing Wanderlust Knowledge Base Content Structure\n');
    
    // Get all paths from index and all files from filesystem
    const indexPaths = extractPathsFromIndex();
    const actualFiles = getAllMarkdownFiles();
    
    console.log(`📊 Summary:`);
    console.log(`   - Paths in contentIndex.ts: ${indexPaths.length}`);
    console.log(`   - Markdown files in filesystem: ${actualFiles.length}\n`);
    
    // Check for missing files (in index but not in filesystem)
    const missingFiles = indexPaths.filter(indexPath => !actualFiles.includes(indexPath));
    
    // Check for orphaned files (in filesystem but not in index)
    const orphanedFiles = actualFiles.filter(filePath => !indexPaths.includes(filePath));
    
    // Report missing files
    if (missingFiles.length > 0) {
        console.log('❌ Missing Files (referenced in index but not found):');
        missingFiles.forEach(file => {
            console.log(`   - ${file}`);
        });
        console.log('');
    } else {
        console.log('✅ No missing files found\n');
    }
    
    // Report orphaned files
    if (orphanedFiles.length > 0) {
        console.log('🔗 Orphaned Files (exist but not in index):');
        orphanedFiles.slice(0, 20).forEach(file => { // Show first 20
            console.log(`   - ${file}`);
        });
        if (orphanedFiles.length > 20) {
            console.log(`   ... and ${orphanedFiles.length - 20} more`);
        }
        console.log('');
    } else {
        console.log('✅ No orphaned files found\n');
    }
    
    // Check frontmatter consistency (sample of valid files)
    console.log('📝 Frontmatter Analysis (sampling existing files):');
    const validFiles = actualFiles.filter(file => indexPaths.includes(file));
    const sampleSize = Math.min(10, validFiles.length);
    const sampledFiles = validFiles.slice(0, sampleSize);
    
    let frontmatterStats = { withFrontmatter: 0, withRequiredFields: 0, total: sampleSize };
    
    sampledFiles.forEach(file => {
        const frontmatterCheck = checkFrontmatter(file);
        if (frontmatterCheck.valid) {
            frontmatterStats.withFrontmatter++;
            if (frontmatterCheck.hasRequiredFields) {
                frontmatterStats.withRequiredFields++;
            }
        }
        console.log(`   ${frontmatterCheck.valid ? '✅' : '❌'} ${file} - ${frontmatterCheck.reason || 'Valid frontmatter'}`);
    });
    
    console.log(`\n📈 Frontmatter Statistics (sample of ${sampleSize}):`);
    console.log(`   - With frontmatter: ${frontmatterStats.withFrontmatter}/${frontmatterStats.total}`);
    console.log(`   - With required fields: ${frontmatterStats.withRequiredFields}/${frontmatterStats.total}`);
    
    // Generate summary
    console.log('\n📋 Summary of Issues:');
    if (missingFiles.length > 0) {
        console.log(`   ❌ ${missingFiles.length} missing files need to be created or removed from index`);
    }
    if (orphanedFiles.length > 0) {
        console.log(`   🔗 ${orphanedFiles.length} orphaned files need to be added to index or removed`);
    }
    if (frontmatterStats.withRequiredFields < frontmatterStats.total) {
        console.log(`   📝 ${frontmatterStats.total - frontmatterStats.withRequiredFields} files missing proper frontmatter`);
    }
    if (missingFiles.length === 0 && orphanedFiles.length === 0 && frontmatterStats.withRequiredFields === frontmatterStats.total) {
        console.log('   ✅ No issues found! Content structure is consistent.');
    }
    
    // Return results for further processing
    return {
        indexPaths,
        actualFiles,
        missingFiles,
        orphanedFiles,
        frontmatterStats
    };
}

// Run analysis if script is executed directly
if (require.main === module) {
    analyzeContentStructure();
}

module.exports = { analyzeContentStructure, extractPathsFromIndex, getAllMarkdownFiles, checkFrontmatter };