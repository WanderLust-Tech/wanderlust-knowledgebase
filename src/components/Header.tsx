import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { BookmarksPanel } from './BookmarksPanel';
import { useBookmarks } from '../contexts/BookmarkContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useAdvancedSearch } from '../contexts/AdvancedSearchContext';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './auth/AuthModal';


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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { bookmarks } = useBookmarks();
  const { toggleSidebar, isMobile, isInitialized } = useSidebar();
  const { getSuggestions, search: performSearch } = useAdvancedSearch();
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const handleRegister = () => {
    setAuthModalMode('register');
    setIsAuthModalOpen(true);
  };

  const handleLogout = () => {
    logout();
  };

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
            to="/api-community"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="API Community (New)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </Link>
          <Link
            to="/real-time-demo"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Real-Time Features Demo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
            to="/content-sync"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Content Sync"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Link>
          <Link
            to="/cms"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Content Management System"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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
            to="/ai-suggestions"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="AI Content Suggestions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </Link>
          <Link
            to="/code-examples"
            className="hover:text-blue-200 dark:hover:text-blue-300 transition-colors p-1"
            title="Code Examples Repository"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
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
            onClick={() => isAuthenticated ? setShowBookmarks(true) : alert('Please sign in to access bookmarks')}
            className={`relative transition-colors p-1 ${
              isAuthenticated 
                ? 'hover:text-blue-200 dark:hover:text-blue-300' 
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title={isAuthenticated ? "Bookmarks" : "Sign in to access bookmarks"}
            disabled={!isAuthenticated}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {isAuthenticated && bookmarks.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none">
                {bookmarks.length > 9 ? '9+' : bookmarks.length}
              </span>
            )}
            {!isAuthenticated && (
              <svg className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <Link
            to="/progress"
            className={`relative transition-colors p-1 ${
              isAuthenticated 
                ? 'hover:text-blue-200 dark:hover:text-blue-300' 
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed pointer-events-none'
            }`}
            title={isAuthenticated ? "Learning Progress" : "Sign in to track learning progress"}
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                alert('Please sign in to access learning progress');
              }
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {!isAuthenticated && (
              <svg className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            )}
          </Link>
          {/* Authentication Section */}
          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-blue-100 dark:text-gray-300">
                Hi, {user?.username || user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm bg-blue-500 hover:bg-blue-400 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1 rounded transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleLogin}
                className="text-sm hover:text-blue-200 dark:hover:text-blue-300 transition-colors"
                title="Sign in"
              >
                Sign in
              </button>
              <button
                onClick={handleRegister}
                className="text-sm bg-blue-500 hover:bg-blue-400 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1 rounded transition-colors"
                title="Sign up"
              >
                Sign up
              </button>
            </div>
          )}
          <ThemeToggle />
        </div>
      </nav>
      
      <BookmarksPanel isOpen={showBookmarks} onClose={() => setShowBookmarks(false)} />
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </header>
  );
};

export default Header;