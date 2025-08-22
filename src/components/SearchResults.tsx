import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface SearchResult {
  path: string;
  title: string;
  content: string;
}

const SearchResults: React.FC = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    setQuery(q);
    if (q) {
      fetch('/search-index.json')
        .then(res => res.json())
        .then((data: SearchResult[]) => {
          const lower = q.toLowerCase();
          setResults(
            data.filter(
              item =>
                item.title.toLowerCase().includes(lower) ||
                item.content.toLowerCase().includes(lower)
            )
          );
        });
    }
  }, [window.location.search]);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-4">Search Results for "{query}"</h1>
      {results.length === 0 ? (
        <p>No results found.</p>
      ) : (
        <ul>
          {results.map(result => (
            <li key={result.path} className="mb-6">
              <Link to={`/${result.path}`} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                {result.title || result.path}
              </Link>
              <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                {result.content.slice(0, 200).replace(/\n/g, ' ')}...
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchResults;
