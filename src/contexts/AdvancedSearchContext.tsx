import React, { createContext, useContext, useEffect, useState } from 'react';

export interface SearchResult {
  path: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  readingTime?: number;
  lastUpdated?: Date;
  relevanceScore: number;
  matchedTerms: string[];
  snippet: string;
}

export interface SearchFilters {
  categories: string[];
  difficulty: ('beginner' | 'intermediate' | 'advanced')[];
  tags: string[];
  minReadingTime?: number;
  maxReadingTime?: number;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  sortBy: 'relevance' | 'date' | 'title' | 'readingTime';
  sortOrder: 'asc' | 'desc';
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'category' | 'tag' | 'article';
  frequency: number;
  category?: string;
}

export interface SearchHistory {
  query: string;
  timestamp: Date;
  resultsCount: number;
  clickedResult?: string;
}

export interface SearchAnalytics {
  popularQueries: { query: string; count: number }[];
  popularCategories: { category: string; count: number }[];
  searchTrends: { date: string; searches: number }[];
  noResultQueries: string[];
  averageResultsPerQuery: number;
  totalSearches: number;
}

interface AdvancedSearchContextType {
  // Search state
  query: string;
  results: SearchResult[];
  filters: SearchFilters;
  suggestions: SearchSuggestion[];
  searchHistory: SearchHistory[];
  analytics: SearchAnalytics;
  isLoading: boolean;
  
  // Search methods
  search: (query: string, filters?: Partial<SearchFilters>) => Promise<void>;
  updateFilters: (filters: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  getSuggestions: (partialQuery: string) => SearchSuggestion[];
  
  // Analytics methods
  trackSearch: (query: string, resultsCount: number) => void;
  trackClick: (query: string, resultPath: string) => void;
  getPopularQueries: () => string[];
  getSearchTrends: () => { date: string; searches: number }[];
  
  // Semantic search
  findSimilarContent: (content: string) => Promise<SearchResult[]>;
  findRelatedTopics: (topic: string) => string[];
  
  // Data management
  clearSearchHistory: () => void;
  exportSearchData: () => string;
  importSearchData: (data: string) => void;
}

const AdvancedSearchContext = createContext<AdvancedSearchContextType | undefined>(undefined);

export const useAdvancedSearch = () => {
  const context = useContext(AdvancedSearchContext);
  if (!context) {
    throw new Error('useAdvancedSearch must be used within an AdvancedSearchProvider');
  }
  return context;
};

const STORAGE_KEYS = {
  SEARCH_HISTORY: 'wanderlust-search-history',
  SEARCH_ANALYTICS: 'wanderlust-search-analytics',
  SEARCH_PREFERENCES: 'wanderlust-search-preferences',
} as const;

// Default filters
const defaultFilters: SearchFilters = {
  categories: [],
  difficulty: [],
  tags: [],
  sortBy: 'relevance',
  sortOrder: 'desc',
};

export const AdvancedSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [analytics, setAnalytics] = useState<SearchAnalytics>({
    popularQueries: [],
    popularCategories: [],
    searchTrends: [],
    noResultQueries: [],
    averageResultsPerQuery: 0,
    totalSearches: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchIndex, setSearchIndex] = useState<any[]>([]);

  // Load search index and saved data
  useEffect(() => {
    const loadSearchIndex = async () => {
      try {
        const response = await fetch('/search-index.json');
        const data = await response.json();
        setSearchIndex(data);
        
        // Generate suggestions from the index
        generateSuggestions(data);
      } catch (error) {
        console.error('Error loading search index:', error);
      }
    };

    loadSearchIndex();
    loadSavedData();
  }, []);

  const loadSavedData = () => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
      const savedAnalytics = localStorage.getItem(STORAGE_KEYS.SEARCH_ANALYTICS);
      const savedPreferences = localStorage.getItem(STORAGE_KEYS.SEARCH_PREFERENCES);

      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        setSearchHistory(history.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        })));
      }

      if (savedAnalytics) {
        setAnalytics(JSON.parse(savedAnalytics));
      }

      if (savedPreferences) {
        setFilters({ ...defaultFilters, ...JSON.parse(savedPreferences) });
      }
    } catch (error) {
      console.error('Error loading saved search data:', error);
    }
  };

  const generateSuggestions = (data: any[]) => {
    const suggestions: SearchSuggestion[] = [];
    const categoryCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};

    data.forEach(item => {
      // Extract category from path
      const category = item.path.split('/')[0];
      categoryCount[category] = (categoryCount[category] || 0) + 1;

      // Add article titles as suggestions
      if (item.title) {
        suggestions.push({
          text: item.title,
          type: 'article',
          frequency: 1,
          category,
        });
      }

      // Extract common terms for suggestions
      const words = item.content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 3);

      words.forEach((word: string) => {
        tagCount[word] = (tagCount[word] || 0) + 1;
      });
    });

    // Add category suggestions
    Object.entries(categoryCount).forEach(([category, count]) => {
      suggestions.push({
        text: category.replace(/-/g, ' '),
        type: 'category',
        frequency: count,
        category,
      });
    });

    // Add popular tag suggestions
    Object.entries(tagCount)
      .filter(([, count]) => count > 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .forEach(([tag, count]) => {
        suggestions.push({
          text: tag,
          type: 'tag',
          frequency: count,
        });
      });

    setSuggestions(suggestions);
  };

  const calculateRelevanceScore = (item: any, query: string, filters: SearchFilters): number => {
    let score = 0;
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);

    // Title match (highest weight)
    if (item.title?.toLowerCase().includes(queryLower)) {
      score += 100;
    }

    // Exact phrase match in content
    if (item.content?.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Individual term matches
    queryTerms.forEach(term => {
      if (item.title?.toLowerCase().includes(term)) {
        score += 20;
      }
      if (item.content?.toLowerCase().includes(term)) {
        score += 10;
      }
    });

    // Category relevance
    const category = item.path.split('/')[0];
    if (filters.categories.length === 0 || filters.categories.includes(category)) {
      score += 5;
    }

    // Boost for recent content
    if (item.lastUpdated) {
      const daysSinceUpdate = (Date.now() - new Date(item.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) {
        score += 10;
      }
    }

    return score;
  };

  const generateSnippet = (content: string, query: string): string => {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(queryLower);
    
    if (index === -1) {
      return content.slice(0, 200) + '...';
    }

    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + query.length + 100);
    let snippet = content.slice(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  };

  const search = async (searchQuery: string, searchFilters?: Partial<SearchFilters>) => {
    setIsLoading(true);
    setQuery(searchQuery);
    
    const currentFilters = { ...filters, ...searchFilters };
    setFilters(currentFilters);

    try {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      const queryLower = searchQuery.toLowerCase();
      const filteredResults = searchIndex
        .map(item => {
          const category = item.path.split('/')[0];
          const relevanceScore = calculateRelevanceScore(item, searchQuery, currentFilters);
          
          if (relevanceScore === 0) return null;

          // Apply filters
          if (currentFilters.categories.length > 0 && !currentFilters.categories.includes(category)) {
            return null;
          }

          const matchedTerms = searchQuery.toLowerCase().split(/\s+/).filter(term =>
            item.title?.toLowerCase().includes(term) || item.content?.toLowerCase().includes(term)
          );

          return {
            path: item.path,
            title: item.title || item.path,
            content: item.content,
            category,
            tags: extractTags(item.content),
            relevanceScore,
            matchedTerms,
            snippet: generateSnippet(item.content, searchQuery),
          } as SearchResult;
        })
        .filter(Boolean)
        .sort((a, b) => {
          switch (currentFilters.sortBy) {
            case 'title':
              return currentFilters.sortOrder === 'asc' 
                ? a!.title.localeCompare(b!.title)
                : b!.title.localeCompare(a!.title);
            case 'date':
              // Would need lastUpdated data in search index
              return 0;
            case 'readingTime':
              // Would need reading time data in search index
              return 0;
            default: // relevance
              return currentFilters.sortOrder === 'asc'
                ? a!.relevanceScore - b!.relevanceScore
                : b!.relevanceScore - a!.relevanceScore;
          }
        });

      setResults(filteredResults as SearchResult[]);
      trackSearch(searchQuery, filteredResults.length);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractTags = (content: string): string[] => {
    // Simple tag extraction based on common technical terms
    const technicalTerms = [
      'chromium', 'browser', 'javascript', 'typescript', 'css', 'html',
      'react', 'node', 'v8', 'blink', 'rendering', 'architecture',
      'security', 'performance', 'debugging', 'build', 'process'
    ];
    
    const contentLower = content.toLowerCase();
    return technicalTerms.filter(term => contentLower.includes(term));
  };

  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    // Re-run search with new filters if there's a query
    if (query) {
      search(query, updatedFilters);
    }

    // Save preferences
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_PREFERENCES, JSON.stringify(updatedFilters));
    } catch (error) {
      console.error('Error saving search preferences:', error);
    }
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    if (query) {
      search(query, defaultFilters);
    }
  };

  const getSuggestions = (partialQuery: string): SearchSuggestion[] => {
    if (!partialQuery.trim()) return [];
    
    const queryLower = partialQuery.toLowerCase();
    return suggestions
      .filter(suggestion => suggestion.text.toLowerCase().includes(queryLower))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  };

  const trackSearch = (searchQuery: string, resultsCount: number) => {
    const newHistoryEntry: SearchHistory = {
      query: searchQuery,
      timestamp: new Date(),
      resultsCount,
    };

    setSearchHistory(prev => {
      const updated = [newHistoryEntry, ...prev.slice(0, 99)]; // Keep last 100 searches
      
      try {
        localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving search history:', error);
      }
      
      return updated;
    });

    // Update analytics
    setAnalytics(prev => {
      const updated = {
        ...prev,
        totalSearches: prev.totalSearches + 1,
        averageResultsPerQuery: ((prev.averageResultsPerQuery * prev.totalSearches) + resultsCount) / (prev.totalSearches + 1),
      };

      // Update popular queries
      const queryIndex = updated.popularQueries.findIndex(q => q.query === searchQuery);
      if (queryIndex >= 0) {
        updated.popularQueries[queryIndex].count++;
      } else {
        updated.popularQueries.push({ query: searchQuery, count: 1 });
      }
      updated.popularQueries.sort((a, b) => b.count - a.count).slice(0, 20);

      // Track no-result queries
      if (resultsCount === 0 && !updated.noResultQueries.includes(searchQuery)) {
        updated.noResultQueries.push(searchQuery);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.SEARCH_ANALYTICS, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving search analytics:', error);
      }

      return updated;
    });
  };

  const trackClick = (searchQuery: string, resultPath: string) => {
    setSearchHistory(prev => {
      const updated = prev.map(entry => 
        entry.query === searchQuery && !entry.clickedResult
          ? { ...entry, clickedResult: resultPath }
          : entry
      );
      
      try {
        localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updated));
      } catch (error) {
        console.error('Error updating search history:', error);
      }
      
      return updated;
    });
  };

  const getPopularQueries = (): string[] => {
    return analytics.popularQueries.slice(0, 10).map(q => q.query);
  };

  const getSearchTrends = () => {
    const trends: { date: string; searches: number }[] = [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(date => {
      const searchesOnDate = searchHistory.filter(
        h => h.timestamp.toISOString().split('T')[0] === date
      ).length;
      
      trends.push({ date, searches: searchesOnDate });
    });

    return trends;
  };

  const findSimilarContent = async (content: string): Promise<SearchResult[]> => {
    // Simple similarity based on common words
    const contentWords = content.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const results: SearchResult[] = [];

    searchIndex.forEach(item => {
      const itemWords = item.content.toLowerCase().split(/\s+/).filter((word: string) => word.length > 3);
      const commonWords = contentWords.filter(word => itemWords.includes(word));
      const similarity = commonWords.length / Math.max(contentWords.length, itemWords.length);

      if (similarity > 0.1) {
        results.push({
          path: item.path,
          title: item.title || item.path,
          content: item.content,
          category: item.path.split('/')[0],
          tags: extractTags(item.content),
          relevanceScore: similarity * 100,
          matchedTerms: commonWords,
          snippet: generateSnippet(item.content, commonWords.join(' ')),
        });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
  };

  const findRelatedTopics = (topic: string): string[] => {
    const topicLower = topic.toLowerCase();
    const relatedTopics = new Set<string>();

    suggestions.forEach(suggestion => {
      if (suggestion.text.toLowerCase().includes(topicLower) && suggestion.text !== topic) {
        relatedTopics.add(suggestion.text);
      }
    });

    return Array.from(relatedTopics).slice(0, 10);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
  };

  const exportSearchData = (): string => {
    return JSON.stringify({
      searchHistory,
      analytics,
      filters,
      exportDate: new Date().toISOString(),
    }, null, 2);
  };

  const importSearchData = (data: string) => {
    try {
      const imported = JSON.parse(data);
      
      if (imported.searchHistory) {
        setSearchHistory(imported.searchHistory.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        })));
      }
      
      if (imported.analytics) {
        setAnalytics(imported.analytics);
      }
      
      if (imported.filters) {
        setFilters({ ...defaultFilters, ...imported.filters });
      }
    } catch (error) {
      console.error('Error importing search data:', error);
      throw new Error('Invalid search data format');
    }
  };

  const value: AdvancedSearchContextType = {
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
    trackSearch,
    trackClick,
    getPopularQueries,
    getSearchTrends,
    findSimilarContent,
    findRelatedTopics,
    clearSearchHistory,
    exportSearchData,
    importSearchData,
  };

  return (
    <AdvancedSearchContext.Provider value={value}>
      {children}
    </AdvancedSearchContext.Provider>
  );
};
