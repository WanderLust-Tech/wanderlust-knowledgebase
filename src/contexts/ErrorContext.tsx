import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface AppError {
  id: string;
  type: 'network' | 'api' | 'validation' | 'auth' | 'offline' | 'sync' | 'general';
  message: string;
  details?: string;
  timestamp: Date;
  action?: string;
  retry?: () => Promise<void>;
  dismissible?: boolean;
  persistent?: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorContextType {
  errors: AppError[];
  isOnline: boolean;
  lastApiCheck: Date | null;
  addError: (error: Omit<AppError, 'id' | 'timestamp'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  retryError: (id: string) => Promise<void>;
  checkApiStatus: () => Promise<boolean>;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastApiCheck, setLastApiCheck] = useState<Date | null>(null);

  // Monitor online/offline status
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkApiStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      addError({
        type: 'offline',
        message: 'You are currently offline',
        details: 'Some features may be limited. Your changes will be saved locally and synced when connection is restored.',
        action: 'Working offline',
        severity: 'medium',
        persistent: true,
        dismissible: false
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    } else {
      checkApiStatus();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addError = useCallback((errorData: Omit<AppError, 'id' | 'timestamp'>) => {
    const error: AppError = {
      ...errorData,
      id: generateId(),
      timestamp: new Date(),
      dismissible: errorData.dismissible ?? true
    };

    setErrors(prev => {
      // Remove any existing offline errors when coming back online
      if (error.type !== 'offline' && isOnline) {
        const filtered = prev.filter(e => e.type !== 'offline');
        return [...filtered, error];
      }
      
      // Prevent duplicate errors of the same type
      const existingIndex = prev.findIndex(e => 
        e.type === error.type && e.message === error.message
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = error;
        return updated;
      }
      
      return [...prev, error];
    });

    // Auto-dismiss non-persistent errors after 10 seconds
    if (!error.persistent && error.dismissible) {
      setTimeout(() => {
        removeError(error.id);
      }, 10000);
    }
  }, [isOnline]);

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const retryError = useCallback(async (id: string) => {
    const error = errors.find(e => e.id === id);
    if (error?.retry) {
      try {
        await error.retry();
        removeError(id);
      } catch (retryError) {
        addError({
          type: 'general',
          message: 'Retry failed',
          details: retryError instanceof Error ? retryError.message : 'Unknown error during retry',
          severity: 'medium'
        });
      }
    }
  }, [errors, removeError, addError]);

  const checkApiStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        timeout: 5000,
        headers: {
          'Cache-Control': 'no-cache'
        }
      } as RequestInit);
      
      const isApiOnline = response.ok;
      setLastApiCheck(new Date());
      
      if (!isApiOnline && isOnline) {
        addError({
          type: 'api',
          message: 'API Server Unavailable',
          details: 'The backend API is not responding. Some features may be limited.',
          action: 'Using cached data',
          severity: 'high',
          persistent: true,
          retry: async () => { await checkApiStatus(); }
        });
      } else if (isApiOnline) {
        // Remove API errors when back online
        setErrors(prev => prev.filter(e => e.type !== 'api'));
      }
      
      return isApiOnline;
    } catch (error) {
      setLastApiCheck(new Date());
      
      if (isOnline) {
        addError({
          type: 'network',
          message: 'Network Error',
          details: 'Unable to connect to the server. Check your internet connection.',
          action: 'Connection failed',
          severity: 'high',
          persistent: true,
          retry: async () => { await checkApiStatus(); }
        });
      }
      
      return false;
    }
  }, [isOnline, addError]);

  // Periodic API health check when online
  React.useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      checkApiStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isOnline, checkApiStatus]);

  const value: ErrorContextType = {
    errors,
    isOnline,
    lastApiCheck,
    addError,
    removeError,
    clearErrors,
    retryError,
    checkApiStatus
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};
