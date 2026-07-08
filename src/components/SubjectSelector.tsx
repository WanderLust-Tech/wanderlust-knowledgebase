import React, { useState, useRef } from 'react';
import { useSubject } from '../contexts/SubjectContext';
import { Subject } from '../contentIndex';

interface SubjectSelectorProps {
  sidebar?: boolean;
}

const SubjectSelector: React.FC<SubjectSelectorProps> = ({ sidebar = false }) => {
  const { currentSubject, subjects, switchToSubject } = useSubject();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'green':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'purple':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getBorderColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'border-blue-200 dark:border-blue-700';
      case 'green':
        return 'border-green-200 dark:border-green-700';
      case 'purple':
        return 'border-purple-200 dark:border-purple-700';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  };

  const handleSubjectSelect = (subjectId: string) => {
    setIsOpen(false);
    switchToSubject(subjectId);
  };

  const handleOpen = () => {
    if (sidebar && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setIsOpen(prev => !prev);
  };

  return (
    <div className="relative">
      {/* Subject Selector Button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`
          flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200
          ${sidebar ? 'w-full' : ''}
          ${getColorClasses(currentSubject.color)}
          border ${getBorderColorClasses(currentSubject.color)}
          hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        `}
      >
        <span className="text-xl">{currentSubject.icon}</span>
        <div className="text-left">
          <div className="font-semibold text-sm">{currentSubject.title}</div>
          <div className="text-xs opacity-75 truncate max-w-40">
            {currentSubject.description}
          </div>
        </div>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div
            className="w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
            style={sidebar && dropdownPos
              ? { position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }
              : { position: 'absolute', top: '100%', marginTop: '0.5rem', right: 0 }
            }
          >
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Select Knowledge Base
              </h3>
              <div className="space-y-2">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => handleSubjectSelect(subject.id)}
                    className={`
                      w-full p-3 rounded-lg text-left transition-all duration-200
                      border ${getBorderColorClasses(subject.color)}
                      ${subject.id === currentSubject.id 
                        ? `${getColorClasses(subject.color)} ring-2 ring-offset-2 ring-blue-500`
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{subject.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {subject.title}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {subject.description}
                        </div>
                      </div>
                      {subject.id === currentSubject.id && (
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Help Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-2">
                  <strong>📚 Multiple Knowledge Bases</strong>
                </p>
                <p>
                  Switch between different subject areas. Each knowledge base contains 
                  comprehensive documentation, tutorials, and guides specific to that topic.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SubjectSelector;