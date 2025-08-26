import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface LoadingState {
  id: string;
  message: string;
  progress?: number;
  cancellable?: boolean;
  onCancel?: () => void;
}

interface LoadingContextType {
  loadingStates: LoadingState[];
  isLoading: boolean;
  addLoading: (loading: Omit<LoadingState, 'id'>) => string;
  updateLoading: (id: string, updates: Partial<Omit<LoadingState, 'id'>>) => void;
  removeLoading: (id: string) => void;
  clearAllLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState<LoadingState[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addLoading = useCallback((loading: Omit<LoadingState, 'id'>): string => {
    const id = generateId();
    const newLoading: LoadingState = { ...loading, id };
    
    setLoadingStates(prev => [...prev, newLoading]);
    return id;
  }, []);

  const updateLoading = useCallback((id: string, updates: Partial<Omit<LoadingState, 'id'>>) => {
    setLoadingStates(prev => 
      prev.map(loading => 
        loading.id === id ? { ...loading, ...updates } : loading
      )
    );
  }, []);

  const removeLoading = useCallback((id: string) => {
    setLoadingStates(prev => prev.filter(loading => loading.id !== id));
  }, []);

  const clearAllLoading = useCallback(() => {
    setLoadingStates([]);
  }, []);

  const isLoading = loadingStates.length > 0;

  const value: LoadingContextType = {
    loadingStates,
    isLoading,
    addLoading,
    updateLoading,
    removeLoading,
    clearAllLoading
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

// Hook for managing loading states with automatic cleanup
export const useLoadingOperation = () => {
  const { addLoading, updateLoading, removeLoading } = useLoading();

  const withLoading = useCallback(<T extends unknown>(
    operation: () => Promise<T>,
    message: string,
    options?: {
      showProgress?: boolean;
      cancellable?: boolean;
      onCancel?: () => void;
    }
  ) => {
    return async (): Promise<T> => {
      const loadingId = addLoading({
        message,
        progress: options?.showProgress ? 0 : undefined,
        cancellable: options?.cancellable,
        onCancel: options?.onCancel
      });

      try {
        const result = await operation();
        removeLoading(loadingId);
        return result;
      } catch (error) {
        removeLoading(loadingId);
        throw error;
      }
    };
  }, [addLoading, updateLoading, removeLoading]);

  const withProgressLoading = useCallback(<T extends unknown>(
    operation: (updateProgress: (progress: number) => void) => Promise<T>,
    message: string,
    options?: {
      cancellable?: boolean;
      onCancel?: () => void;
    }
  ) => {
    return async (): Promise<T> => {
      const loadingId = addLoading({
        message,
        progress: 0,
        cancellable: options?.cancellable,
        onCancel: options?.onCancel
      });

      const updateProgress = (progress: number) => {
        updateLoading(loadingId, { progress: Math.max(0, Math.min(100, progress)) });
      };

      try {
        const result = await operation(updateProgress);
        removeLoading(loadingId);
        return result;
      } catch (error) {
        removeLoading(loadingId);
        throw error;
      }
    };
  }, [addLoading, updateLoading, removeLoading]);

  return {
    withLoading,
    withProgressLoading
  };
};
