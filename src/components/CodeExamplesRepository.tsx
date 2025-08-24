/**
 * Code Examples Repository Component
 * Main interface for browsing, searching, and interacting with code examples
 */

import React, { useState, useEffect } from 'react';
import { useCodeExamples, useCodeExampleCollections } from '../hooks/useCodeExamples';
import { 
  CodeExample, 
  CodeExampleSearchFilters, 
  CodeExampleCollection,
  ProgrammingLanguage,
  DifficultyLevel,
  CodeExampleCategory 
} from '../types/CodeExampleTypes';

const CodeExamplesRepository: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState<CodeExample | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filteredExamples, setFilteredExamples] = useState<CodeExample[]>([]);
  const [isCollectionFiltered, setIsCollectionFiltered] = useState(false);

  const {
    examples,
    searchResults,
    filters,
    setFilters,
    search,
    clearFilters,
    collections,
    recommendations,
    isLoading,
    error,
    executeExample,
    rateExample,
    bookmarkExample,
    shareExample,
    getPopularExamples
  } = useCodeExamples({
    autoSearch: true,
    enableRecommendations: true,
    cacheResults: true
  });

  const [popularExamples, setPopularExamples] = useState<CodeExample[]>([]);

  useEffect(() => {
    const loadPopular = async () => {
      const popular = await getPopularExamples();
      setPopularExamples(popular);
    };
    loadPopular();
  }, [getPopularExamples]);

  const handleSearch = (query: string) => {
    search(query);
  };

  const handleFilterChange = (newFilters: Partial<CodeExampleSearchFilters>) => {
    setFilters({ ...filters, ...newFilters });
  };

  const handleExampleSelect = (example: CodeExample) => {
    setSelectedExample(example);
  };

  if (selectedExample) {
    return (
      <CodeExampleViewer
        example={selectedExample}
        onClose={() => setSelectedExample(null)}
        onExecute={executeExample}
        onRate={rateExample}
        onBookmark={bookmarkExample}
        onShare={shareExample}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                <span className="mr-2">💻</span>
                Code Examples Repository
              </h1>
              <span className="text-sm text-gray-500">
                {examples.length} examples available
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
              >
                {viewMode === 'grid' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Toggle filters"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-80 space-y-6">
            {/* Search */}
            <SearchBox onSearch={handleSearch} />

            {/* Filters */}
            {showFilters && (
              <FiltersPanel 
                filters={filters}
                onChange={handleFilterChange}
                onClear={clearFilters}
                searchResults={searchResults}
              />
            )}

            {/* Collections */}
            <CollectionsPanel 
              collections={collections}
              onCollectionSelect={(collection) => {
                // Filter to show only collection examples
                const collectionExamples = examples.filter(example => 
                  collection.examples.includes(example.id)
                );
                setFilteredExamples(collectionExamples);
                setIsCollectionFiltered(true);
              }}
              onClearCollection={() => {
                setIsCollectionFiltered(false);
                setFilteredExamples([]);
              }}
            />

            {/* Popular Examples */}
            <PopularExamplesPanel 
              examples={popularExamples}
              onExampleSelect={handleExampleSelect}
            />

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <RecommendationsPanel 
                recommendations={recommendations}
                onExampleSelect={handleExampleSelect}
              />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                <p>{error}</p>
              </div>
            )}

            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <ExamplesGrid 
                examples={isCollectionFiltered ? filteredExamples : examples}
                viewMode={viewMode}
                onExampleSelect={handleExampleSelect}
                onExecute={executeExample}
                onRate={rateExample}
                onBookmark={bookmarkExample}
                onShare={shareExample}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Search Box Component
interface SearchBoxProps {
  onSearch: (query: string) => void;
}

const SearchBox: React.FC<SearchBoxProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Search Code Examples
        </label>
        <div className="relative">
          <input
            type="text"
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, description, or code..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Search Examples
      </button>
    </form>
  );
};

// Filters Panel Component
interface FiltersPanelProps {
  filters: CodeExampleSearchFilters;
  onChange: (filters: Partial<CodeExampleSearchFilters>) => void;
  onClear: () => void;
  searchResults: any;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({ filters, onChange, onClear, searchResults }) => {
  const languages: ProgrammingLanguage[] = ['javascript', 'typescript', 'cpp', 'python', 'html', 'css', 'json', 'gn'];
  const difficulties: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  const categories: CodeExampleCategory[] = ['getting-started', 'architecture', 'debugging', 'performance', 'security'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
        <button
          onClick={onClear}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-4">
        {/* Languages */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Languages
          </label>
          <div className="space-y-2">
            {languages.map(language => (
              <label key={language} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.languages?.includes(language) || false}
                  onChange={(e) => {
                    const currentLanguages = filters.languages || [];
                    const newLanguages = e.target.checked
                      ? [...currentLanguages, language]
                      : currentLanguages.filter(l => l !== language);
                    onChange({ languages: newLanguages });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {language}
                  {searchResults?.filters.languages[language] && (
                    <span className="ml-1 text-gray-400">({searchResults.filters.languages[language]})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Difficulty
          </label>
          <div className="space-y-2">
            {difficulties.map(difficulty => (
              <label key={difficulty} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.difficulties?.includes(difficulty) || false}
                  onChange={(e) => {
                    const currentDifficulties = filters.difficulties || [];
                    const newDifficulties = e.target.checked
                      ? [...currentDifficulties, difficulty]
                      : currentDifficulties.filter(d => d !== difficulty);
                    onChange({ difficulties: newDifficulties });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {difficulty}
                  {searchResults?.filters.difficulties[difficulty] && (
                    <span className="ml-1 text-gray-400">({searchResults.filters.difficulties[difficulty]})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Categories
          </label>
          <div className="space-y-2">
            {categories.map(category => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.categories?.includes(category) || false}
                  onChange={(e) => {
                    const currentCategories = filters.categories || [];
                    const newCategories = e.target.checked
                      ? [...currentCategories, category]
                      : currentCategories.filter(c => c !== category);
                    onChange({ categories: newCategories });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {category.replace('-', ' ')}
                  {searchResults?.filters.categories[category] && (
                    <span className="ml-1 text-gray-400">({searchResults.filters.categories[category]})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Runnable only */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.runnable || false}
              onChange={(e) => onChange({ runnable: e.target.checked || undefined })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Runnable examples only
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

// Collections Panel Component
interface CollectionsPanelProps {
  collections: CodeExampleCollection[];
  onCollectionSelect: (collection: CodeExampleCollection) => void;
  onClearCollection?: () => void;
}

const CollectionsPanel: React.FC<CollectionsPanelProps> = ({ collections, onCollectionSelect, onClearCollection }) => {
  if (collections.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Collections</h3>
        {onClearCollection && (
          <button
            onClick={onClearCollection}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Show All
          </button>
        )}
      </div>
      <div className="space-y-3">
        {collections.map(collection => (
          <button
            key={collection.id}
            onClick={() => onCollectionSelect(collection)}
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              {collection.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {collection.examples.length} examples • {collection.estimatedTime}min
            </p>
            <div className="flex items-center mt-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                collection.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                collection.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                collection.difficulty === 'advanced' ? 'bg-red-100 text-red-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {collection.difficulty}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Popular Examples Panel Component
interface PopularExamplesPanelProps {
  examples: CodeExample[];
  onExampleSelect: (example: CodeExample) => void;
}

const PopularExamplesPanel: React.FC<PopularExamplesPanelProps> = ({ examples, onExampleSelect }) => {
  if (examples.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Popular Examples</h3>
      <div className="space-y-2">
        {examples.slice(0, 5).map(example => (
          <button
            key={example.id}
            onClick={() => onExampleSelect(example)}
            className="w-full text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              {example.title}
            </h4>
            <div className="flex items-center mt-1 space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {example.language}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <div className="flex items-center">
                <span className="text-xs text-yellow-500">⭐</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  {example.ratings.average.toFixed(1)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Recommendations Panel Component
interface RecommendationsPanelProps {
  recommendations: any[];
  onExampleSelect: (example: CodeExample) => void;
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ recommendations, onExampleSelect }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recommended for You</h3>
      <div className="space-y-3">
        {recommendations.map(rec => (
          <button
            key={rec.example.id}
            onClick={() => onExampleSelect(rec.example)}
            className="w-full text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              {rec.example.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {rec.explanation}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

// Examples Grid Component
interface ExamplesGridProps {
  examples: CodeExample[];
  viewMode: 'grid' | 'list';
  onExampleSelect: (example: CodeExample) => void;
  onExecute: (id: string) => Promise<any>;
  onRate: (id: string, rating: number) => Promise<boolean>;
  onBookmark: (id: string) => Promise<boolean>;
  onShare: (id: string) => Promise<string>;
}

const ExamplesGrid: React.FC<ExamplesGridProps> = ({ 
  examples, 
  viewMode, 
  onExampleSelect,
  onExecute,
  onRate,
  onBookmark,
  onShare
}) => {
  if (examples.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No examples found</h3>
        <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
      </div>
    );
  }

  const containerClass = viewMode === 'grid' 
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    : 'space-y-4';

  return (
    <div className={containerClass}>
      {examples.map(example => (
        <CodeExampleCard
          key={example.id}
          example={example}
          viewMode={viewMode}
          onSelect={() => onExampleSelect(example)}
          onExecute={() => onExecute(example.id)}
          onRate={(rating) => onRate(example.id, rating)}
          onBookmark={() => onBookmark(example.id)}
          onShare={() => onShare(example.id)}
        />
      ))}
    </div>
  );
};

// Code Example Card Component
interface CodeExampleCardProps {
  example: CodeExample;
  viewMode: 'grid' | 'list';
  onSelect: () => void;
  onExecute: () => void;
  onRate: (rating: number) => void;
  onBookmark: () => void;
  onShare: () => void;
}

const CodeExampleCard: React.FC<CodeExampleCardProps> = ({
  example,
  viewMode,
  onSelect,
  onExecute,
  onRate,
  onBookmark,
  onShare
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const cardClass = viewMode === 'grid'
    ? 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer'
    : 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center space-x-4';

  return (
    <div className={cardClass}>
      <div className={viewMode === 'list' ? 'flex-1' : ''}>
        <div className="flex items-start justify-between mb-3">
          <h3 
            className="font-semibold text-gray-900 dark:text-white text-lg hover:text-blue-600 dark:hover:text-blue-400"
            onClick={onSelect}
          >
            {example.title}
          </h3>
          <div className="flex items-center space-x-1">
            <span className="text-yellow-500">⭐</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {example.ratings.average.toFixed(1)}
            </span>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          {example.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`}>
            {example.language}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full ${
            example.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            example.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            example.difficulty === 'advanced' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
          }`}>
            {example.difficulty}
          </span>
          {example.runnable && (
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Runnable
            </span>
          )}
        </div>

        {viewMode === 'grid' && isExpanded && (
          <div className="mb-4">
            <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-xs overflow-x-auto">
              <code>{example.code.slice(0, 200)}...</code>
            </pre>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={onSelect}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium"
            >
              View Details
            </button>
            {example.runnable && (
              <button
                onClick={onExecute}
                className="text-green-600 hover:text-green-700 dark:text-green-400 text-sm font-medium"
              >
                Run Code
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={onBookmark}
              className="p-1 text-gray-400 hover:text-yellow-500"
              title="Bookmark"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <button
              onClick={onShare}
              className="p-1 text-gray-400 hover:text-blue-500"
              title="Share"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Code Example Viewer Component
interface CodeExampleViewerProps {
  example: CodeExample;
  onClose: () => void;
  onExecute: (id: string, code?: string) => Promise<any>;
  onRate: (id: string, rating: number) => Promise<boolean>;
  onBookmark: (id: string) => Promise<boolean>;
  onShare: (id: string) => Promise<string>;
}

const CodeExampleViewer: React.FC<CodeExampleViewerProps> = ({
  example,
  onClose,
  onExecute,
  onRate,
  onBookmark,
  onShare
}) => {
  const [code, setCode] = useState(example.code);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const result = await onExecute(example.id, code);
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({ success: false, error: 'Execution failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-full overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {example.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {example.description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Code Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Code</h3>
                {example.runnable && (
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {isExecuting ? 'Running...' : 'Run Code'}
                  </button>
                )}
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-96 p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                spellCheck={false}
              />
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Output</h3>
              <div className="h-96 p-4 bg-gray-100 dark:bg-gray-700 rounded border overflow-auto">
                {executionResult ? (
                  <div>
                    {executionResult.success ? (
                      <div>
                        <div className="text-green-600 font-medium mb-2">✓ Execution successful</div>
                        <pre className="text-sm">{executionResult.output}</pre>
                      </div>
                    ) : (
                      <div>
                        <div className="text-red-600 font-medium mb-2">✗ Execution failed</div>
                        <pre className="text-sm text-red-600">{executionResult.error}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    Click "Run Code" to see output
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => onBookmark(example.id)}
                className="flex items-center space-x-2 text-gray-600 hover:text-yellow-600 dark:text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>Bookmark</span>
              </button>
              <button
                onClick={() => onShare(example.id)}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 dark:text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                <span>Share</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Rate this example:</span>
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => onRate(example.id, rating)}
                  className="text-yellow-400 hover:text-yellow-500"
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading Spinner Component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

export default CodeExamplesRepository;
