import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { BookmarksPanel } from './BookmarksPanel';
import { useBookmarks } from '../contexts/BookmarkContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useAdvancedSearch } from '../contexts/AdvancedSearchContext';


interface SearchResult {
  path: string;
  title: string;
  content: string;
}

const Header: React.FC = () => {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { bookmarks } = useBookmarks();
  const { toggleSidebar, isMobile, isInitialized } = useSidebar();
  const { getSuggestions, search: performSearch } = useAdvancedSearch();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const quickSuggestions = query.length > 1 ? getSuggestions(query).slice(0, 5) : [];

  useEffect(() => {
    if (query.length > 1) {
      setShowDropdown(true);
    } else {
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
            {showDropdown && quickSuggestions.length > 0 && (
              <ul className="absolute left-0 mt-1 w-full bg-white text-black border rounded shadow-lg max-h-60 overflow-auto z-50">
                {quickSuggestions.map((suggestion, index) => (
                  <li key={`${suggestion.type}-${suggestion.text}-${index}`}>
                    <button
                      onClick={() => {
                        setQuery(suggestion.text);
                        navigate(`/search?q=${encodeURIComponent(suggestion.text)}`);
                        setShowDropdown(false);
                        inputRef.current?.blur();
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-blue-100"
                      onMouseDown={e => e.preventDefault()}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">
                          {suggestion.type === 'article' ? '📄' : 
                           suggestion.type === 'category' ? '📁' : '🏷️'}
                        </span>
                        <span className="font-semibold">{suggestion.text}</span>
                        <span className="text-xs text-gray-500 capitalize">
                          {suggestion.type}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="submit"
                    className="w-full text-left px-3 py-2 text-blue-600 hover:underline bg-gray-50"
                  >
                    Advanced search for "{query}"
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
          <Link
            to="/community"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Community Discussions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>
          <Link
            to="/analytics"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Analytics Dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </Link>
          <Link
            to="/versioning"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Content Versioning"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </Link>
          <Link
            to="/search"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Advanced Search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
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