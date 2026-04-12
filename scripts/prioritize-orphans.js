const { analyzeContentStructure } = require('./analyze-content-structure.js');

function prioritizeOrphanedFiles() {
    const results = analyzeContentStructure();
    
    // Categorize orphaned files by importance
    const highPriority = [];
    const mediumPriority = [];
    const lowPriority = [];
    
    results.orphanedFiles.forEach(file => {
        // High priority: Core documentation files
        if (file.includes('README') || 
            file.includes('overview') || 
            file.includes('/architecture/') ||
            file.includes('/security/') ||
            file.includes('/features/') && !file.includes('enterprise') ||
            file.includes('/development/') ||
            file.includes('/apis/')) {
            highPriority.push(file);
        }
        // Medium priority: Specialized but valuable content
        else if (file.includes('/platforms/') ||
                 file.includes('/performance/') ||
                 file.includes('/gpu/') ||
                 file.includes('/modules/') ||
                 file.includes('testing') ||
                 file.includes('debugging')) {
            mediumPriority.push(file);
        }
        // Low priority: Examples, demos, very specialized content
        else {
            lowPriority.push(file);
        }
    });
    
    console.log('🎯 High Priority Orphaned Files (should add to index):');
    highPriority.forEach(file => console.log(`   - ${file}`));
    
    console.log('\n⚡ Medium Priority Orphaned Files:');
    mediumPriority.slice(0, 10).forEach(file => console.log(`   - ${file}`));
    if (mediumPriority.length > 10) {
        console.log(`   ... and ${mediumPriority.length - 10} more`);
    }
    
    console.log('\n📎 Low Priority Orphaned Files:');
    lowPriority.slice(0, 5).forEach(file => console.log(`   - ${file}`));
    if (lowPriority.length > 5) {
        console.log(`   ... and ${lowPriority.length - 5} more`);
    }
    
    return { highPriority, mediumPriority, lowPriority };
}

prioritizeOrphanedFiles();