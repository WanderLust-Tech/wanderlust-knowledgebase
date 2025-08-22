import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { BookmarksPanel } from './BookmarksPanel';
import { useBookmarks } from '../contexts/BookmarkContext';


interface SearchResult {
  path: string;
  title: string;
  content: string;
}

const Header: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { bookmarks } = useBookmarks();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (query.length > 1) {
      fetch('/search-index.json')
        .then(res => res.json())
        .then((data: SearchResult[]) => {
          const lower = query.toLowerCase();
          setResults(
            data.filter(
              item =>
                item.title.toLowerCase().includes(lower) ||
                item.content.toLowerCase().includes(lower)
            ).slice(0, 5)
          );
        });
      setShowDropdown(true);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  return (
    <header className={`bg-blue-600 dark:bg-gray-800 text-white p-4 sticky top-0 z-50 transition-all duration-200 ${
      isScrolled ? 'shadow-lg' : 'shadow-md'
    }`}>
      <nav className="flex items-center justify-between">
        <div className="text-lg font-bold flex-shrink-0">Wanderlust Knowledgebase</div>
        
        <div className="flex-1 flex justify-center mx-8">
          <form onSubmit={handleSubmit} className="relative w-full max-w-md">
            <input
              ref={inputRef}
              type="text"
              className="rounded px-3 py-2 text-black w-full"
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => query.length > 1 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              aria-label="Search"
            />
            {showDropdown && results.length > 0 && (
              <ul className="absolute left-0 mt-1 w-full bg-white text-black border rounded shadow-lg max-h-60 overflow-auto z-50">
                {results.map(result => (
                  <li key={result.path}>
                    <Link
                      to={`/${result.path}`}
                      className="block px-3 py-2 hover:bg-blue-100"
                      onMouseDown={e => e.preventDefault()}
                    >
                      <span className="font-semibold">{result.title || result.path}</span>
                      <div className="text-xs text-gray-600 truncate">{result.content.slice(0, 80).replace(/\n/g, ' ')}...</div>
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="submit"
                    className="w-full text-left px-3 py-2 text-blue-600 hover:underline bg-gray-50"
                  >
                    See all results for "{query}"
                  </button>
                </li>
              </ul>
            )}
          </form>
        </div>
        
        <div className="flex items-center space-x-4 flex-shrink-0">
          <button
            onClick={() => setShowBookmarks(true)}
            className="relative hover:text-blue-200 dark:hover:text-blue-300 transition-colors"
            title="Bookmarks"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {bookmarks.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {bookmarks.length > 9 ? '9+' : bookmarks.length}
              </span>
            )}
          </button>
          <Link to="/" className="hover:underline">
            Home
          </Link>
          {/* <Link to="/chromium" className="hover:underline">
            Chromium
          </Link>
          <Link to="/frontend" className="hover:underline">
            Frontend
          </Link>
          <Link to="/minecraft" className="hover:underline">
            Minecraft
          </Link> */}
          <ThemeToggle />
        </div>
      </nav>
      
      <BookmarksPanel isOpen={showBookmarks} onClose={() => setShowBookmarks(false)} />
    </header>
  );
};

export default Header;