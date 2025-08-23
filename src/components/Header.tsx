import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { BookmarksPanel } from './BookmarksPanel';
import { useBookmarks } from '../contexts/BookmarkContext';
import { useSidebar } from '../contexts/SidebarContext';


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
  const { toggleSidebar, isMobile, isInitialized } = useSidebar();

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
    <header className={`bg-blue-600 dark:bg-gray-800 text-white px-4 py-2 sticky top-0 z-50 transition-all duration-200 ${
      isScrolled ? 'shadow-lg' : 'shadow-md'
    }`}>
      <nav className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Burger Menu Button - Mobile Only */}
          {isInitialized && isMobile && (
            <button
              data-burger-menu
              onClick={toggleSidebar}
              className="p-1 hover:text-blue-200 dark:hover:text-blue-300 transition-colors md:hidden"
              title="Toggle menu"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          
          <div className="text-base font-bold flex-shrink-0">Wanderlust Knowledgebase</div>
        </div>
        
        <div className="flex-1 flex justify-center mx-6">
          <form onSubmit={handleSubmit} className="relative w-full max-w-md">
            <input
              ref={inputRef}
              type="text"
              className="rounded px-3 py-1.5 text-black w-full text-sm"
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
        
        <div className="flex items-center space-x-3 flex-shrink-0">
          <Link to="/" className="hover:underline text-sm">
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
          <button
            onClick={() => setShowBookmarks(true)}
            className="relative hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Bookmarks"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {bookmarks.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none">
                {bookmarks.length > 9 ? '9+' : bookmarks.length}
              </span>
            )}
          </button>
          <Link
            to="/progress"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Learning Progress"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </Link>
          <ThemeToggle />
        </div>
      </nav>
      
      <BookmarksPanel isOpen={showBookmarks} onClose={() => setShowBookmarks(false)} />
    </header>
  );
};

export default Header;