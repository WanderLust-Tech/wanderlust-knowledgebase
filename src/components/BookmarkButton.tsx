import React, { useState } from 'react';
import { useBookmarks } from '../contexts/BookmarkContext';

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
  const [isAnimating, setIsAnimating] = useState(false);
  
  const bookmarked = isBookmarked(path, section);
  const bookmark = getBookmarkByPath(path, section);

  const handleToggle = () => {
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
        text-gray-600 dark:text-gray-400 
        hover:text-blue-600 dark:hover:text-blue-400
        transition-all duration-200
        ${isAnimating ? 'scale-110' : 'scale-100'}
        ${className}
      `}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
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
      {showLabel && (
        <span className="text-sm font-medium">
          {bookmarked ? 'Bookmarked' : 'Bookmark'}
        </span>
      )}
    </button>
  );
};
