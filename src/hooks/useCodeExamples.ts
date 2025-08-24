/**
 * Code Examples Hook
 * React hook for managing code examples with search, filtering,
 * execution, recommendations, and analytics capabilities
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { codeExamplesService } from '../services/CodeExamplesService';
import {
  CodeExample,
  CodeExampleCollection,
  CodeExampleSearchFilters,
  CodeExampleSearchResult,
  CodeExampleRecommendation,
  CodeExecutionResult,
  CodeExampleUsageStats,
  UseCodeExamplesOptions,
  UseCodeExamplesReturn,
  ProgrammingLanguage,
  DifficultyLevel,
  CodeExampleCategory
} from '../types/CodeExampleTypes';

export const useCodeExamples = (options: UseCodeExamplesOptions = {}): UseCodeExamplesReturn => {
  const {
    initialFilters = {},
    autoSearch = true,
    cacheResults = true,
    enableRecommendations = true,
    userId = 'anonymous',
    contextArticle
  } = options;

  // State management
  const [examples, setExamples] = useState<CodeExample[]>([]);
  const [searchResults, setSearchResults] = useState<CodeExampleSearchResult | null>(null);
  const [filters, setFilters] = useState<CodeExampleSearchFilters>(initialFilters);
  const [collections, setCollections] = useState<CodeExampleCollection[]>([]);
  const [featuredCollections, setFeaturedCollections] = useState<CodeExampleCollection[]>([]);
  const [recommendations, setRecommendations] = useState<CodeExampleRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Cache for frequently accessed data
  const [cache] = useState(new Map<string, any>());

  // Memoized filter key for caching
  const filterKey = useMemo(() => {
    return JSON.stringify(filters);
  }, [filters]);

  // Search function
  const search = useCallback(async (query?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const searchFilters = query ? { ...filters, query } : filters;
      
      // Check cache first
      const cacheKey = `search:${JSON.stringify(searchFilters)}`;
      if (cacheResults && cache.has(cacheKey)) {
        const cachedResult = cache.get(cacheKey);
        setSearchResults(cachedResult);
        setExamples(cachedResult.examples);
        setIsLoading(false);
        return;
      }

      const results = await codeExamplesService.searchExamples(searchFilters);
      
      setSearchResults(results);
      setExamples(results.examples);
      setHasMore(results.examples.length > 0);

      // Cache results
      if (cacheResults) {
        cache.set(cacheKey, results);
      }

      // Track search analytics
      trackUsage('search', `query:${query || 'no-query'}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Code examples search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, cacheResults, cache]);

  // Get individual example
  const getExample = useCallback(async (id: string): Promise<CodeExample | null> => {
    try {
      // Check cache first
      const cacheKey = `example:${id}`;
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }

      const example = await codeExamplesService.getExample(id);
      
      if (example && cacheResults) {
        cache.set(cacheKey, example);
      }

      // Track view
      if (example) {
        await trackUsage(id, 'view');
      }

      return example;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get example');
      return null;
    }
  }, [cache, cacheResults]);

  // Execute example code
  const executeExample = useCallback(async (id: string, customCode?: string): Promise<CodeExecutionResult> => {
    try {
      const example = await getExample(id);
      if (!example) {
        throw new Error('Example not found');
      }

      if (!example.runnable) {
        throw new Error('Example is not runnable');
      }

      const codeToExecute = customCode || example.code;
      const result = await codeExamplesService.executionService.execute(
        codeToExecute,
        example.language,
        example.environment
      );

      // Track execution
      await trackUsage(id, 'execute');

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      return {
        success: false,
        error: errorMessage,
        metadata: {
          environment: 'unknown' as any,
          timestamp: new Date(),
          version: '1.0'
        }
      };
    }
  }, [getExample]);

  // Rate example
  const rateExample = useCallback(async (id: string, rating: number, review?: string): Promise<boolean> => {
    try {
      const success = await codeExamplesService.rateExample({
        exampleId: id,
        userId,
        rating,
        review,
        helpful: rating >= 4
      });

      if (success) {
        // Update local example if cached
        const cacheKey = `example:${id}`;
        if (cache.has(cacheKey)) {
          const example = cache.get(cacheKey);
          // Update rating (simplified)
          example.ratings.count++;
          cache.set(cacheKey, example);
        }

        // Refresh search results if applicable
        if (searchResults) {
          await search();
        }
      }

      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rate example');
      return false;
    }
  }, [userId, cache, searchResults, search]);

  // Bookmark example
  const bookmarkExample = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await codeExamplesService.bookmarkExample(userId, id);
      
      if (success) {
        await trackUsage(id, 'bookmark');
      }

      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bookmark example');
      return false;
    }
  }, [userId]);

  // Share example
  const shareExample = useCallback(async (id: string): Promise<string> => {
    try {
      const example = await getExample(id);
      if (!example) {
        throw new Error('Example not found');
      }

      // Generate shareable URL
      const shareUrl = `${window.location.origin}/code-examples/${id}`;
      
      // Track share
      await trackUsage(id, 'share');

      // Copy to clipboard if available
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }

      return shareUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share example');
      throw err;
    }
  }, [getExample]);

  // Track usage analytics
  const trackUsage = useCallback(async (exampleId: string, action: string) => {
    try {
      await codeExamplesService.trackUsage(exampleId, action as any);
    } catch (err) {
      console.warn('Failed to track usage:', err);
    }
  }, []);

  // Get popular examples
  const getPopularExamples = useCallback(async (): Promise<CodeExample[]> => {
    try {
      const cacheKey = 'popular-examples';
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }

      const popular = await codeExamplesService.getPopularExamples(10);
      
      if (cacheResults) {
        cache.set(cacheKey, popular);
      }

      return popular;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get popular examples');
      return [];
    }
  }, [cache, cacheResults]);

  // Get usage stats
  const getUsageStats = useCallback(async (exampleId: string): Promise<CodeExampleUsageStats> => {
    try {
      return await codeExamplesService.getUsageStats(exampleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get usage stats');
      throw err;
    }
  }, []);

  // Load recommendations
  const refreshRecommendations = useCallback(async () => {
    if (!enableRecommendations) return;

    try {
      const recs = await codeExamplesService.getRecommendations(userId, contextArticle);
      setRecommendations(recs);
    } catch (err) {
      console.warn('Failed to load recommendations:', err);
    }
  }, [enableRecommendations, userId, contextArticle]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setCurrentPage(1);
  }, []);

  // Load more results (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    setIsLoading(true);
    try {
      // Simulate pagination by loading more examples
      // In a real implementation, this would use offset/limit
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      
      // For now, just search again (in real implementation, append results)
      await search();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more examples');
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, currentPage, search]);

  // Load collections
  useEffect(() => {
    const loadCollections = async () => {
      try {
        const allCollections = await codeExamplesService.getCollections();
        setCollections(allCollections);
        
        // Featured collections (e.g., getting started, popular)
        const featured = allCollections.filter(c => 
          c.category === 'getting-started' || c.examples.length >= 3
        );
        setFeaturedCollections(featured);
      } catch (err) {
        console.warn('Failed to load collections:', err);
      }
    };

    loadCollections();
  }, []);

  // Load recommendations on mount and when context changes
  useEffect(() => {
    refreshRecommendations();
  }, [refreshRecommendations]);

  // Auto-search on mount if enabled
  useEffect(() => {
    if (autoSearch) {
      search();
    }
  }, [autoSearch]); // Only run on mount

  // Search when filters change (but not on initial mount)
  useEffect(() => {
    if (filterKey !== JSON.stringify(initialFilters)) {
      search();
    }
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Search and filtering
    examples,
    searchResults,
    filters,
    setFilters,
    search,
    clearFilters,
    
    // Collections
    collections,
    featuredCollections,
    
    // Individual example operations
    getExample,
    executeExample,
    rateExample,
    bookmarkExample,
    shareExample,
    
    // Recommendations
    recommendations,
    refreshRecommendations,
    
    // State management
    isLoading,
    error,
    hasMore,
    loadMore,
    
    // Analytics
    trackUsage,
    getPopularExamples,
    getUsageStats
  };
};

// Utility hook for managing a single code example
export const useCodeExample = (id: string) => {
  const [example, setExample] = useState<CodeExample | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<CodeExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const loadExample = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const exampleData = await codeExamplesService.getExample(id);
        setExample(exampleData);
        
        if (exampleData) {
          // Track view
          await codeExamplesService.trackUsage(id, 'view');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load example');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadExample();
    }
  }, [id]);

  const executeCode = useCallback(async (customCode?: string) => {
    if (!example) return;

    setIsExecuting(true);
    try {
      const codeToExecute = customCode || example.code;
      const result = await codeExamplesService.executionService.execute(
        codeToExecute,
        example.language,
        example.environment
      );
      
      setExecutionResult(result);
      
      // Track execution
      await codeExamplesService.trackUsage(id, 'execute');
      
      return result;
    } catch (err) {
      const errorResult: CodeExecutionResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed',
        metadata: {
          environment: example.environment,
          timestamp: new Date(),
          version: '1.0'
        }
      };
      setExecutionResult(errorResult);
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  }, [example, id]);

  return {
    example,
    isLoading,
    error,
    executionResult,
    isExecuting,
    executeCode
  };
};

// Hook for code example collections
export const useCodeExampleCollections = (category?: CodeExampleCategory) => {
  const [collections, setCollections] = useState<CodeExampleCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCollections = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const collectionsData = await codeExamplesService.getCollections(category);
        setCollections(collectionsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load collections');
      } finally {
        setIsLoading(false);
      }
    };

    loadCollections();
  }, [category]);

  return {
    collections,
    isLoading,
    error
  };
};
