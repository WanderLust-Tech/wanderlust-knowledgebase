import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Subject, subjects, getSubjectById, getContentIndexForSubject } from '../contentIndex';

interface SubjectContextType {
  currentSubject: Subject;
  setCurrentSubject: (subject: Subject) => void;
  subjects: Subject[];
  currentContentIndex: any[];
  switchToSubject: (subjectId: string) => void;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

interface SubjectProviderProps {
  children: ReactNode;
}

export const SubjectProvider: React.FC<SubjectProviderProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine current subject from URL path
  const getCurrentSubjectFromPath = (): Subject => {
    const pathSegments = location.pathname.split('/').filter(segment => segment);
    const firstSegment = pathSegments[0];
    
    // Check if the first segment matches a subject ID
    const subjectFromPath = getSubjectById(firstSegment);
    
    // Default to Chromium if no valid subject found
    return subjectFromPath || subjects[0]; // Chromium is first in array
  };

  const [currentSubject, setCurrentSubject] = useState<Subject>(() => getCurrentSubjectFromPath());

  // Update current subject when route changes
  useEffect(() => {
    const newSubject = getCurrentSubjectFromPath();
    if (newSubject.id !== currentSubject.id) {
      setCurrentSubject(newSubject);
    }
  }, [location.pathname, currentSubject.id]);

  // Get content index for current subject
  const currentContentIndex = getContentIndexForSubject(currentSubject.id);

  // Function to switch subjects and navigate
  const switchToSubject = (subjectId: string) => {
    const newSubject = getSubjectById(subjectId);
    if (newSubject && newSubject.id !== currentSubject.id) {
      setCurrentSubject(newSubject);
      
      // Navigate to the default route for the new subject
      const defaultPath = getDefaultPathForSubject(newSubject);
      navigate(defaultPath);
    }
  };

  // Helper function to get default path for a subject
  const getDefaultPathForSubject = (subject: Subject): string => {
    const contentIndex = subject.contentIndex;
    
    // Look for introduction/overview or getting-started/overview
    for (const node of contentIndex) {
      if (node.children) {
        for (const child of node.children) {
          if (child.path && (
            child.path.includes('introduction/overview') ||
            child.path.includes('getting-started/overview') ||
            child.path.includes('overview')
          )) {
            return `/${subject.id}/${child.path}`;
          }
        }
      }
    }
    
    // Fall back to first node with a path
    for (const node of contentIndex) {
      if (node.path) {
        return `/${subject.id}/${node.path}`;
      }
      if (node.children) {
        for (const child of node.children) {
          if (child.path) {
            return `/${subject.id}/${child.path}`;
          }
        }
      }
    }
    
    // Ultimate fallback
    return `/${subject.id}`;
  };

  const contextValue: SubjectContextType = {
    currentSubject,
    setCurrentSubject,
    subjects,
    currentContentIndex,
    switchToSubject
  };

  return (
    <SubjectContext.Provider value={contextValue}>
      {children}
    </SubjectContext.Provider>
  );
};

export const useSubject = (): SubjectContextType => {
  const context = useContext(SubjectContext);
  if (context === undefined) {
    throw new Error('useSubject must be used within a SubjectProvider');
  }
  return context;
};