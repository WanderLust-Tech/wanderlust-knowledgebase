import React, { useState } from 'react';
import { useBookmarks } from '../contexts/BookmarkContext';
import { useAuth } from '../contexts/AuthContext';

interface BookmarkButtonProps {
  title: string;
  path: string;
  url: string;
  description?: string;
  section?: string;
  anchor?: string;
  category?: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  title,
  path,
  url,
  description,
  section,
  anchor,
  category,
  className = '',
  showLabel = false,
  size = 'md',
}) => {
  const { addBookmark, removeBookmark, isBookmarked, getBookmarkByPath } = useBookmarks();
  const { isAuthenticated } = useAuth();
  const [isAnimating, setIsAnimating] = useState(false);
  
  const bookmarked = isAuthenticated && isBookmarked(path, section);
  const bookmark = getBookmarkByPath(path, section);

  const handleToggle = () => {
    if (!isAuthenticated) {
      alert('Please sign in to bookmark content');
      return;
    }

    setIsAnimating(true);
    
    if (bookmarked && bookmark) {
      removeBookmark(bookmark.id);
    } else {
      addBookmark({
        title,
        path,
        url,
        description,
        section,
        anchor,
        category,
      });
    }

    // Reset animation after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  };

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        ${buttonSizeClasses[size]}
        flex items-center gap-2 
        ${isAuthenticated 
          ? 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400' 
          : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
        }
        transition-all duration-200
        ${isAnimating ? 'scale-110' : 'scale-100'}
        ${className}
      `}
      title={
        !isAuthenticated 
          ? 'Sign in to bookmark content' 
          : bookmarked 
            ? 'Remove bookmark' 
            : 'Add bookmark'
      }
      aria-label={
        !isAuthenticated 
          ? 'Sign in to bookmark content' 
          : bookmarked 
            ? 'Remove bookmark' 
            : 'Add bookmark'
      }
      disabled={!isAuthenticated}
    >
      <div className="relative">
        <svg
          className={`${sizeClasses[size]} transition-all duration-200`}
          fill={bookmarked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={bookmarked ? 0 : 2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        {!isAuthenticated && (
          <svg className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      {showLabel && (
        <span className="text-sm font-medium">
          {!isAuthenticated 
            ? 'Sign in to bookmark' 
            : bookmarked 
              ? 'Bookmarked' 
              : 'Bookmark'
          }
        </span>
      )}
    </button>
  );
};
