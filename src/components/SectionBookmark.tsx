import React, { useState, useRef, useEffect } from 'react';
import { BookmarkButton } from './BookmarkButton';

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
      {/* Bookmark button - appears on hover */}
      <div
        className={`
          absolute -left-8 top-0 z-10 transition-opacity duration-200
          ${isHovered ? 'opacity-100' : 'opacity-0'}
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
          className="bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-200 dark:border-gray-700"
        />
      </div>
      
      {/* Content */}
      {children}
    </div>
  );
};
