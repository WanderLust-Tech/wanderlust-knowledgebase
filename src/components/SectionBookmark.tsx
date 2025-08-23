import React, { useState, useRef, useEffect } from 'react';
import { BookmarkButton } from './BookmarkButton';
import { useBookmarks } from '../contexts/BookmarkContext';

interface SectionBookmarkProps {
  title: string;
  path: string;
  url: string;
  sectionId: string;
  sectionTitle: string;
  description?: string;
  category?: string;
  children: React.ReactNode;
}

export const SectionBookmark: React.FC<SectionBookmarkProps> = ({
  title,
  path,
  url,
  sectionId,
  sectionTitle,
  description,
  category,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { isBookmarked } = useBookmarks();
  
  const bookmarked = isBookmarked(path, sectionTitle);

  // Add section ID to the element for anchor linking
  useEffect(() => {
    if (sectionRef.current && sectionId) {
      sectionRef.current.id = sectionId;
    }
  }, [sectionId]);

  return (
    <div
      ref={sectionRef}
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Bookmark button - always visible when bookmarked, appears on hover when not */}
      <div
        className={`
          absolute -left-8 top-0 z-10 transition-all duration-200
          ${bookmarked ? 'opacity-100' : isHovered ? 'opacity-100' : 'opacity-0'}
          ${bookmarked ? 'scale-100' : 'scale-95'}
        `}
      >
        <BookmarkButton
          title={`${title} - ${sectionTitle}`}
          path={path}
          url={url}
          description={description || `Section: ${sectionTitle}`}
          section={sectionTitle}
          anchor={sectionId}
          category={category}
          size="sm"
          className={`
            rounded-full shadow-md border transition-all duration-200
            ${bookmarked 
              ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }
          `}
        />
      </div>
      
      {/* Content */}
      {children}
    </div>
  );
};
