import { useError } from '../contexts/ErrorContext';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
  offline?: boolean;
  cached?: boolean;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public isNetworkError: boolean = false,
    public isTimeout: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class EnhancedApiService {
  private baseUrl = '/api';
  private defaultTimeout = 10000;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private pendingRequests = new Map<string, Promise<any>>();

  constructor() {
    // Clear expired cache entries every 5 minutes
    setInterval(() => {
      this.clearExpiredCache();
    }, 5 * 60 * 1000);
  }

  private clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(endpoint: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body || '';
    return `${method}:${endpoint}:${typeof body === 'string' ? body : JSON.stringify(body)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      exponentialBackoff = true
    } = retryOptions;

    const cacheKey = this.getCacheKey(endpoint, options);
    
    // Check if this exact request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // For GET requests, try cache first if offline
    if (!navigator.onLine && (!options.method || options.method === 'GET')) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return {
          data: cached,
          success: true,
          offline: true,
          cached: true
        };
      }
    }

    const requestPromise = this.executeRequestWithRetry<T>(
      endpoint,
      options,
      maxAttempts,
      baseDelay,
      maxDelay,
      exponentialBackoff,
      cacheKey
    );

    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async executeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    maxAttempts: number,
    baseDelay: number,
    maxDelay: number,
    exponentialBackoff: boolean,
    cacheKey: string
  ): Promise<ApiResponse<T>> {
    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.executeSingleRequest<T>(endpoint, options, cacheKey);
        return result;
      } catch (error) {
        lastError = error instanceof ApiError ? error : new ApiError(
          error instanceof Error ? error.message : 'Unknown error',
          undefined,
          undefined,
          true
        );

        // Don't retry on certain errors
        if (lastError.status === 401 || lastError.status === 403 || lastError.status === 404) {
          break;
        }

        // Don't retry if this is the last attempt
        if (attempt === maxAttempts) {
          break;
        }

        // Calculate delay for next retry
        const delay = exponentialBackoff 
          ? Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
          : baseDelay;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If all retries failed, try to return cached data for GET requests
    if (!options.method || options.method === 'GET') {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        return {
          data: cached,
          success: true,
          cached: true,
          error: `Using cached data due to: ${lastError?.message}`
        };
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after all retry attempts',
      offline: !navigator.onLine
    };
  }

  private async executeSingleRequest<T>(
    endpoint: string,
    options: RequestInit,
    cacheKey: string
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Use default error message if response is not JSON
        }

        throw new ApiError(
          errorMessage,
          response.status,
          response.status.toString(),
          false,
          false
        );
      }

      const data = await response.json();
      
      // Cache successful GET responses
      if (!options.method || options.method === 'GET') {
        this.setCache(cacheKey, data);
      }

      return {
        data,
        success: true
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', undefined, 'TIMEOUT', false, true);
        }
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new ApiError('Network error - check your connection', undefined, 'NETWORK_ERROR', true, false);
        }
      }

      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown network error',
        undefined,
        undefined,
        true,
        false
      );
    }
  }

  // Enhanced API methods with error handling
  async get<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithRetry<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithRetry<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithRetry<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequestWithRetry<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Utility methods
  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.success;
    } catch {
      return false;
    }
  }
}

// React hook for using the enhanced API service with error context
export const useApiService = () => {
  const { addError } = useError();
  const apiService = new EnhancedApiService();

  const withErrorHandling = <T>(
    apiCall: () => Promise<ApiResponse<T>>,
    errorContext?: string
  ) => {
    return async (): Promise<ApiResponse<T>> => {
      try {
        const result = await apiCall();
        
        if (!result.success && result.error) {
          addError({
            type: result.offline ? 'offline' : 'api',
            message: errorContext || 'API Request Failed',
            details: result.error,
            severity: result.offline ? 'medium' : 'high',
            retry: result.offline ? undefined : async () => { await withErrorHandling(apiCall, errorContext)(); }
          });
        }
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        addError({
          type: 'network',
          message: errorContext || 'Network Error',
          details: errorMessage,
          severity: 'high',
          retry: async () => { await withErrorHandling(apiCall, errorContext)(); }
        });
        
        return {
          success: false,
          error: errorMessage
        };
      }
    };
  };

  return {
    ...apiService,
    withErrorHandling
  };
};

export const enhancedApiService = new EnhancedApiService();
