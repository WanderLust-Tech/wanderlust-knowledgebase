import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Bookmark {
  id: string;
  title: string;
  path: string;
  url: string;
  timestamp: number;
  description?: string;
  section?: string; // For section-specific bookmarks
  anchor?: string;  // For linking to specific sections
  tags?: string[];
  category?: string;
}

interface BookmarkContextType {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'timestamp'>) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (path: string, section?: string) => boolean;
  getBookmarkByPath: (path: string, section?: string) => Bookmark | undefined;
  getBookmarksByCategory: (category: string) => Bookmark[];
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  clearAllBookmarks: () => void;
  importBookmarks: (bookmarks: Bookmark[]) => void;
  exportBookmarks: () => Bookmark[];
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const useBookmarks = () => {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarkProvider');
  }
  return context;
};

interface BookmarkProviderProps {
  children: ReactNode;
}

const STORAGE_KEY_PREFIX = 'wanderlust-bookmarks';

export const BookmarkProvider: React.FC<BookmarkProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Generate user-specific storage key
  const getStorageKey = () => {
    const userId = user?.id || 'anonymous';
    return `${STORAGE_KEY_PREFIX}-${userId}`;
  };

  // Load bookmarks from localStorage on mount and when authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear bookmarks when not authenticated
      setBookmarks([]);
      return;
    }

    try {
      const storageKey = getStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsedBookmarks = JSON.parse(saved);
        setBookmarks(parsedBookmarks);
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }, [isAuthenticated, user]);

  // Save bookmarks to localStorage whenever they change (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(bookmarks));
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
    }
  }, [bookmarks, isAuthenticated, user]);

  const addBookmark = (bookmarkData: Omit<Bookmark, 'id' | 'timestamp'>) => {
    if (!isAuthenticated) return;
    
    const newBookmark: Bookmark = {
      ...bookmarkData,
      id: generateId(),
      timestamp: Date.now(),
    };

    setBookmarks(prev => {
      // Check if bookmark already exists (same path and section)
      const exists = prev.some(b => 
        b.path === newBookmark.path && 
        b.section === newBookmark.section
      );
      
      if (exists) {
        return prev; // Don't add duplicate
      }
      
      return [...prev, newBookmark];
    });
  };

  const removeBookmark = (id: string) => {
    if (!isAuthenticated) return;
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const isBookmarked = (path: string, section?: string): boolean => {
    if (!isAuthenticated) return false;
    return bookmarks.some(b => 
      b.path === path && 
      b.section === section
    );
  };

  const getBookmarkByPath = (path: string, section?: string): Bookmark | undefined => {
    if (!isAuthenticated) return undefined;
    return bookmarks.find(b => 
      b.path === path && 
      b.section === section
    );
  };

  const getBookmarksByCategory = (category: string): Bookmark[] => {
    if (!isAuthenticated) return [];
    return bookmarks.filter(b => b.category === category);
  };

  const updateBookmark = (id: string, updates: Partial<Bookmark>) => {
    if (!isAuthenticated) return;
    setBookmarks(prev => 
      prev.map(b => b.id === id ? { ...b, ...updates } : b)
    );
  };

  const clearAllBookmarks = () => {
    if (!isAuthenticated) return;
    setBookmarks([]);
    // Clear user-specific localStorage
    const storageKey = getStorageKey();
    localStorage.removeItem(storageKey);
  };

  const importBookmarks = (importedBookmarks: Bookmark[]) => {
    if (!isAuthenticated) return;
    setBookmarks(prev => {
      const combined = [...prev];
      
      importedBookmarks.forEach(imported => {
        const exists = combined.some(b => 
          b.path === imported.path && 
          b.section === imported.section
        );
        
        if (!exists) {
          combined.push(imported);
        }
      });
      
      return combined;
    });
  };

  const exportBookmarks = (): Bookmark[] => {
    if (!isAuthenticated) return [];
    return [...bookmarks];
  };

  const value: BookmarkContextType = {
    bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
    getBookmarkByPath,
    getBookmarksByCategory,
    updateBookmark,
    clearAllBookmarks,
    importBookmarks,
    exportBookmarks,
  };

  return (
    <BookmarkContext.Provider value={value}>
      {children}
    </BookmarkContext.Provider>
  );
};

// Helper function to generate unique IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
