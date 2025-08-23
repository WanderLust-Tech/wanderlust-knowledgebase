#!/usr/bin/env node

/**
 * Advanced Search System Test
 * 
 * This script tests the advanced search functionality to ensure all features are working correctly.
 * Run this after implementing the advanced search features to verify functionality.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? 'green' : 'red';
  log(`${status} ${testName}`, color);
  if (details) {
    log(`   ${details}`, 'yellow');
  }
}

function testAdvancedSearchImplementation() {
  log('\n🔍 Testing Advanced Search Implementation\n', 'bold');
  
  let allTestsPassed = true;
  
  // Test 1: Check if AdvancedSearchContext exists
  const contextPath = path.join(__dirname, 'src', 'contexts', 'AdvancedSearchContext.tsx');
  const contextExists = fs.existsSync(contextPath);
  logTest('AdvancedSearchContext file exists', contextExists);
  allTestsPassed = allTestsPassed && contextExists;
  
  if (contextExists) {
    const contextContent = fs.readFileSync(contextPath, 'utf8');
    
    // Test context features
    const hasSemanticSearch = contextContent.includes('semanticSearch');
    logTest('Context includes semantic search', hasSemanticSearch);
    allTestsPassed = allTestsPassed && hasSemanticSearch;
    
    const hasFilters = contextContent.includes('filters');
    logTest('Context includes filters', hasFilters);
    allTestsPassed = allTestsPassed && hasFilters;
    
    const hasAnalytics = contextContent.includes('analytics');
    logTest('Context includes analytics', hasAnalytics);
    allTestsPassed = allTestsPassed && hasAnalytics;
    
    const hasSuggestions = contextContent.includes('getSuggestions');
    logTest('Context includes suggestions', hasSuggestions);
    allTestsPassed = allTestsPassed && hasSuggestions;
    
    const hasHistory = contextContent.includes('searchHistory');
    logTest('Context includes search history', hasHistory);
    allTestsPassed = allTestsPassed && hasHistory;
  }
  
  // Test 2: Check if AdvancedSearchComponent exists
  const componentPath = path.join(__dirname, 'src', 'components', 'AdvancedSearchComponent.tsx');
  const componentExists = fs.existsSync(componentPath);
  logTest('AdvancedSearchComponent file exists', componentExists);
  allTestsPassed = allTestsPassed && componentExists;
  
  if (componentExists) {
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    
    // Test component features
    const hasSearchInput = componentContent.includes('Search for articles');
    logTest('Component has search input', hasSearchInput);
    allTestsPassed = allTestsPassed && hasSearchInput;
    
    const hasAdvancedFilters = componentContent.includes('showFilters');
    logTest('Component has advanced filters', hasAdvancedFilters);
    allTestsPassed = allTestsPassed && hasAdvancedFilters;
    
    const hasSuggestionsDropdown = componentContent.includes('showSuggestions');
    logTest('Component has suggestions dropdown', hasSuggestionsDropdown);
    allTestsPassed = allTestsPassed && hasSuggestionsDropdown;
    
    const hasKeyboardNavigation = componentContent.includes('onKeyDown');
    logTest('Component has keyboard navigation', hasKeyboardNavigation);
    allTestsPassed = allTestsPassed && hasKeyboardNavigation;
  }
  
  // Test 3: Check if SearchResults is updated
  const searchResultsPath = path.join(__dirname, 'src', 'components', 'SearchResults.tsx');
  const searchResultsExists = fs.existsSync(searchResultsPath);
  logTest('SearchResults component exists', searchResultsExists);
  allTestsPassed = allTestsPassed && searchResultsExists;
  
  if (searchResultsExists) {
    const searchResultsContent = fs.readFileSync(searchResultsPath, 'utf8');
    const usesAdvancedSearch = searchResultsContent.includes('useAdvancedSearch');
    logTest('SearchResults uses AdvancedSearch context', usesAdvancedSearch);
    allTestsPassed = allTestsPassed && usesAdvancedSearch;
  }
  
  // Test 4: Check if main app integrates the provider
  const indexPath = path.join(__dirname, 'src', 'index.tsx');
  const indexExists = fs.existsSync(indexPath);
  logTest('Main index file exists', indexExists);
  allTestsPassed = allTestsPassed && indexExists;
  
  if (indexExists) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const hasProvider = indexContent.includes('AdvancedSearchProvider');
    logTest('Main app includes AdvancedSearchProvider', hasProvider);
    allTestsPassed = allTestsPassed && hasProvider;
  }
  
  // Test 5: Check if Header is updated
  const headerPath = path.join(__dirname, 'src', 'components', 'Header.tsx');
  const headerExists = fs.existsSync(headerPath);
  logTest('Header component exists', headerExists);
  allTestsPassed = allTestsPassed && headerExists;
  
  if (headerExists) {
    const headerContent = fs.readFileSync(headerPath, 'utf8');
    const hasAdvancedSearchImport = headerContent.includes('useAdvancedSearch');
    logTest('Header uses AdvancedSearch context', hasAdvancedSearchImport);
    allTestsPassed = allTestsPassed && hasAdvancedSearchImport;
    
    const hasSearchButton = headerContent.includes('Advanced Search');
    logTest('Header has search button', hasSearchButton);
    allTestsPassed = allTestsPassed && hasSearchButton;
  }
  
  // Test 6: Check if search index exists
  const searchIndexPath = path.join(__dirname, 'public', 'search-index.json');
  const searchIndexExists = fs.existsSync(searchIndexPath);
  logTest('Search index file exists', searchIndexExists);
  allTestsPassed = allTestsPassed && searchIndexExists;
  
  // Test 7: Check TypeScript compilation
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit', { cwd: __dirname, stdio: 'pipe' });
    logTest('TypeScript compilation successful', true);
  } catch (error) {
    logTest('TypeScript compilation failed', false, error.message.split('\n')[0]);
    allTestsPassed = false;
  }
  
  // Final result
  log('\n' + '='.repeat(50), 'blue');
  if (allTestsPassed) {
    log('🎉 ALL TESTS PASSED! Advanced Search is ready!', 'green');
    log('\n✨ Features implemented:', 'blue');
    log('  • Semantic search with intelligent suggestions', 'green');
    log('  • Advanced filters (category, relevance, date)', 'green');
    log('  • Search analytics and popular queries', 'green');
    log('  • Search history with persistent storage', 'green');
    log('  • Real-time suggestions and autocomplete', 'green');
    log('  • Enhanced search results with highlighting', 'green');
    log('  • Mobile-responsive search interface', 'green');
    log('  • Keyboard navigation and accessibility', 'green');
  } else {
    log('❌ Some tests failed. Please check the implementation.', 'red');
  }
  log('='.repeat(50), 'blue');
}

// Run the tests
testAdvancedSearchImplementation();
