import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isMobile: boolean;
  isInitialized: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true); // Start with mobile assumption
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if screen is mobile size
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      // On desktop, sidebar should be open by default
      // On mobile, sidebar should be closed by default
      if (!mobile) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
      setIsInitialized(true);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isOpen) {
        const sidebar = document.querySelector('[data-sidebar]');
        const burger = document.querySelector('[data-burger-menu]');
        
        if (sidebar && !sidebar.contains(event.target as Node) && 
            burger && !burger.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isOpen]);

  // Close sidebar on navigation change (mobile)
  useEffect(() => {
    if (isMobile) {
      const handleRouteChange = () => setIsOpen(false);
      // Listen to hash changes for HashRouter
      window.addEventListener('hashchange', handleRouteChange);
      return () => window.removeEventListener('hashchange', handleRouteChange);
    }
  }, [isMobile]);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);
  const openSidebar = () => setIsOpen(true);

  const value: SidebarContextType = {
    isOpen,
    isMobile,
    isInitialized,
    toggleSidebar,
    closeSidebar,
    openSidebar,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};
