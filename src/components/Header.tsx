import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';


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
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

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
    </header>
  );
};

export default Header;