import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdvancedSearch } from '../contexts/AdvancedSearchContext';

export const AdvancedSearchComponent: React.FC = () => {
  const {
    query,
    results,
    filters,
    suggestions,
    searchHistory,
    analytics,
    isLoading,
    search,
    updateFilters,
    clearFilters,
    getSuggestions,
    trackClick,
    getPopularQueries,
  } = useAdvancedSearch();

  const [localQuery, setLocalQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize from URL params
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery !== query) {
      setLocalQuery(urlQuery);
      search(urlQuery);
    }
  }, [searchParams]);

  // Update URL when search changes
  useEffect(() => {
    if (query !== searchParams.get('q')) {
      const newParams = new URLSearchParams(searchParams);
      if (query) {
        newParams.set('q', query);
      } else {
        newParams.delete('q');
      }
      setSearchParams(newParams);
    }
  }, [query, searchParams, setSearchParams]);

  const handleSearch = async (searchQuery: string = localQuery) => {
    if (searchQuery.trim()) {
      await search(searchQuery.trim());
      setShowSuggestions(false);
      setShowHistory(false);
      inputRef.current?.blur();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setActiveSuggestionIndex(-1);
    
    if (value.length > 1) {
      setShowSuggestions(true);
      setShowHistory(false);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentSuggestions = localQuery.length > 1 ? getSuggestions(localQuery) : [];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < currentSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > -1 ? prev - 1 : prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
        const suggestion = currentSuggestions[activeSuggestionIndex];
        setLocalQuery(suggestion.text);
        handleSearch(suggestion.text);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowHistory(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    setLocalQuery(suggestion.text);
    handleSearch(suggestion.text);
  };

  const handleResultClick = (result: any) => {
    trackClick(query, result.path);
  };

  const availableCategories = [...new Set(results.map(r => r.category))].sort();
  const popularQueries = getPopularQueries();

  const formatResultContent = (content: string, matchedTerms: string[]) => {
    let formatted = content;
    matchedTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      formatted = formatted.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
    });
    return { __html: formatted };
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Advanced Search
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find exactly what you're looking for in the Chromium knowledge base
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (localQuery.length > 1) {
                setShowSuggestions(true);
              } else {
                setShowHistory(true);
              }
            }}
            onBlur={() => {
              // Delay hiding to allow clicks on suggestions
              setTimeout(() => {
                setShowSuggestions(false);
                setShowHistory(false);
              }, 200);
            }}
            placeholder="Search for articles, concepts, or code examples..."
            className="w-full pl-12 pr-24 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="Filters"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.586l-4-4V9.414a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <button
              onClick={() => handleSearch()}
              disabled={!localQuery.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Search'}
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {(showSuggestions || showHistory) && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {showSuggestions && localQuery.length > 1 && (
              <div>
                <div className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700">
                  Suggestions
                </div>
                {getSuggestions(localQuery).map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.text}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${
                      index === activeSuggestionIndex ? 'bg-blue-50 dark:bg-blue-900' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm">
                        {suggestion.type === 'article' ? '📄' : 
                         suggestion.type === 'category' ? '📁' : '🏷️'}
                      </span>
                      <span className="text-gray-900 dark:text-white">{suggestion.text}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {suggestion.type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {suggestion.frequency} results
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showHistory && !showSuggestions && (
              <div>
                {popularQueries.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700">
                      Popular Searches
                    </div>
                    {popularQueries.slice(0, 5).map(popularQuery => (
                      <button
                        key={popularQuery}
                        onClick={() => handleSuggestionClick({ text: popularQuery })}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                      >
                        <span className="text-sm">🔥</span>
                        <span className="text-gray-900 dark:text-white">{popularQuery}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchHistory.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                      Recent Searches
                    </div>
                    {searchHistory.slice(0, 5).map((historyItem, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick({ text: historyItem.query })}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm">🕐</span>
                          <span className="text-gray-900 dark:text-white">{historyItem.query}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {historyItem.resultsCount} results
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Search Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Categories */}
            {availableCategories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categories
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {availableCategories.map(category => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.categories.includes(category)}
                        onChange={(e) => {
                          const newCategories = e.target.checked
                            ? [...filters.categories, category]
                            : filters.categories.filter(c => c !== category);
                          updateFilters({ categories: newCategories });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {category.replace(/-/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilters({ sortBy: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="relevance">Relevance</option>
                <option value="title">Title</option>
                <option value="date">Date</option>
                <option value="readingTime">Reading Time</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => updateFilters({ sortOrder: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div>
        {query && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Search Results for "{query}"
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {results.length} results
              {isLoading && " (searching...)"}
            </span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-400">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Searching...</span>
            </div>
          </div>
        )}

        {!isLoading && query && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No results found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try adjusting your search terms or filters
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-500">Suggestions:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Check spelling and try different keywords</li>
                <li>• Remove filters to broaden your search</li>
                <li>• Try searching for related topics</li>
                <li>• Use more general terms</li>
              </ul>
            </div>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-6">
            {results.map((result, index) => (
              <div
                key={result.path}
                className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <Link
                    to={`/${result.path}`}
                    onClick={() => handleResultClick(result)}
                    className="text-xl font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {result.title}
                  </Link>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      {result.category.replace(/-/g, ' ')}
                    </span>
                    <span>Score: {Math.round(result.relevanceScore)}</span>
                  </div>
                </div>
                
                <p 
                  className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed"
                  dangerouslySetInnerHTML={formatResultContent(result.snippet, result.matchedTerms)}
                />
                
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-4">
                    <span>/{result.path}</span>
                    {result.tags.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <span>Tags:</span>
                        {result.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {result.matchedTerms.length > 0 && (
                      <span>
                        Matched: {result.matchedTerms.slice(0, 2).join(', ')}
                        {result.matchedTerms.length > 2 && ' +more'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!query && !isLoading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Advanced Search
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Search through our comprehensive Chromium knowledge base with powerful filters and intelligent suggestions.
            </p>
            
            {popularQueries.length > 0 && (
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Popular Searches
                </h4>
                <div className="flex flex-wrap gap-2 justify-center">
                  {popularQueries.slice(0, 8).map(query => (
                    <button
                      key={query}
                      onClick={() => handleSuggestionClick({ text: query })}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
