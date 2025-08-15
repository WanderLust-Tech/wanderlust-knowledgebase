import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';


interface SearchResult {
  path: string;
  title: string;
  content: string;
}

const Header: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

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
    <header className="bg-blue-600 text-white p-4 shadow-md relative z-10">
      <nav className="flex justify-between items-center">
        <div className="text-lg font-bold">Wanderlust Knowledgebase</div>
        <form onSubmit={handleSubmit} className="relative mr-4">
          <input
            ref={inputRef}
            type="text"
            className="rounded px-2 py-1 text-black w-64"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query.length > 1 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            aria-label="Search"
          />
          {showDropdown && results.length > 0 && (
            <ul className="absolute left-0 mt-1 w-64 bg-white text-black border rounded shadow-lg max-h-60 overflow-auto">
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
        <ul className="flex space-x-4">
          <li>
            <Link to="/" className="hover:underline">
              Home
            </Link>
          </li>
          <li>
            <Link to="/chromium" className="hover:underline">
              Chromium
            </Link>
          </li>
          <li>
            <Link to="/frontend" className="hover:underline">
              Frontend
            </Link>
          </li>
          <li>
            <Link to="/minecraft" className="hover:underline">
              Minecraft
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;