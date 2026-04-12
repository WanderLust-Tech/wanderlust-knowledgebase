const { analyzeContentStructure } = require('./analyze-content-structure.js');

function categorizeOrphanedFiles() {
    const results = analyzeContentStructure();
    
    console.log('\n🔍 Detailed Analysis of Orphaned Files by Category:\n');
    
    // Group orphaned files by top-level directory
    const orphanedByCategory = {};
    
    results.orphanedFiles.forEach(file => {
        const topLevel = file.split('/')[0];
        if (!orphanedByCategory[topLevel]) {
            orphanedByCategory[topLevel] = [];
        }
        orphanedByCategory[topLevel].push(file);
    });
    
    // Display categorized results
    Object.keys(orphanedByCategory).sort().forEach(category => {
        console.log(`📁 ${category}/ (${orphanedByCategory[category].length} files):`);
        orphanedByCategory[category].slice(0, 10).forEach(file => {
            console.log(`   - ${file}`);
        });
        if (orphanedByCategory[category].length > 10) {
            console.log(`   ... and ${orphanedByCategory[category].length - 10} more`);
        }
        console.log('');
    });
    
    return orphanedByCategory;
}

// Run the detailed analysis
categorizeOrphanedFiles();