/**
 * Authentication Service
 * Handles user authentication, token management, and auth state
 */

import { apiService } from './ApiService';

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: 'Member' | 'Contributor' | 'Moderator' | 'Admin';
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string;
  
  // Additional properties to match backend
  reputation: number;
  badges: UserBadge[];
  preferences: UserPreferences;
}

export interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedDate: string;
  category: 'Contribution' | 'Learning' | 'Community' | 'Achievement';
  userId: number;
}

export interface UserPreferences {
  id: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  themePreference: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  discussionSort: 'newest' | 'oldest' | 'popular' | 'relevance';
  autoSubscribe: boolean;
  userId: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
  bio?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface UserStats {
  articlesCreated: number;
  codeExamplesCreated: number;
  communityPostsCreated: number;
  totalContributions: number;
  joinedAt: string;
  lastActiveAt: string;
}

class AuthService {
  private readonly TOKEN_KEY = 'wanderlust_access_token';
  private readonly REFRESH_TOKEN_KEY = 'wanderlust_refresh_token';
  private readonly USER_KEY = 'wanderlust_user';
  private readonly API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5070'}/api`;

  private currentUser: User | null = null;
  private refreshTokenTimer: number | null = null;

  constructor() {
    this.loadUserFromStorage();
    this.setupTokenRefresh();
  }

  // Authentication Methods
  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('AuthService: Starting login request...');
      const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const apiResponse = await response.json();
      console.log('AuthService: Raw API response:', apiResponse);
      console.log('AuthService: API response type:', typeof apiResponse);
      console.log('AuthService: API response keys:', Object.keys(apiResponse));
      
      // Handle wrapped API response format
      const authResponse: AuthResponse = apiResponse.data || apiResponse;
      console.log('AuthService: Extracted auth response:', authResponse);
      console.log('AuthService: Auth response type:', typeof authResponse);
      
      if (!authResponse.accessToken) {
        throw new Error('No access token in response');
      }
      
      if (!authResponse.user) {
        throw new Error('No user data in response');
      }
      
      this.setAuthData(authResponse);
      this.setupTokenRefresh();

      return authResponse;
    } catch (error) {
      console.error('AuthService: Login error:', error);
      throw error instanceof Error ? error : new Error('Login failed');
    }
  }

  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('AuthService: Starting register request...');
      const response = await fetch(`${this.API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const apiResponse = await response.json();
      console.log('AuthService: Registration API response received:', apiResponse);
      
      // Handle wrapped API response format
      const authResponse: AuthResponse = apiResponse.data || apiResponse;
      console.log('AuthService: Registration auth response extracted:', authResponse);
      
      this.setAuthData(authResponse);
      this.setupTokenRefresh();

      return authResponse;
    } catch (error) {
      console.error('AuthService: Registration error:', error);
      throw error instanceof Error ? error : new Error('Registration failed');
    }
  }

  async logout(): Promise<void> {
    try {
      // Call API to invalidate refresh token
      if (this.isAuthenticated()) {
        await fetch(`${this.API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.warn('Error during logout API call:', error);
    } finally {
      this.clearAuthData();
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        this.clearAuthData();
        return false;
      }

      const response = await fetch(`${this.API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearAuthData();
        return false;
      }

      const authResponse: AuthResponse = await response.json();
      this.setAuthData(authResponse);
      this.setupTokenRefresh();

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuthData();
      return false;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmNewPassword: newPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password change failed');
    }
  }

  async updateProfile(updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>): Promise<User> {
    const response = await fetch(`${this.API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Profile update failed');
    }

    const updatedUser: User = await response.json();
    this.currentUser = updatedUser;
    localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));

    return updatedUser;
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`,
        },
      });

      if (!response.ok) {
        this.clearAuthData();
        return null;
      }

      const user: User = await response.json();
      this.currentUser = user;
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));

      return user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      this.clearAuthData();
      return null;
    }
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const response = await fetch(`${this.API_BASE_URL}/auth/users/${userId}/stats`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get user stats');
    }

    return response.json();
  }

  // Token Management
  getAccessToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;
    
    // Validate JWT format
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('AuthService: Invalid JWT format detected, clearing token:', {
        token: token.substring(0, 50) + '...',
        parts: parts.length
      });
      localStorage.removeItem(this.TOKEN_KEY);
      return null;
    }
    
    return token;
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      // Validate JWT format first
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payloadPart = parts[1];
      if (!payloadPart) return false;

      // Ensure proper base64 padding
      const paddedPayload = payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
      
      const payload = JSON.parse(atob(paddedPayload));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }

  getCurrentUserSync(): User | null {
    return this.currentUser;
  }

  getUserRole(): string | null {
    return this.currentUser?.role || null;
  }

  hasRole(role: string): boolean {
    const userRole = this.getUserRole();
    const roleHierarchy = ['Member', 'Contributor', 'Moderator', 'Admin'];
    const userRoleIndex = roleHierarchy.indexOf(userRole || '');
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    
    return userRoleIndex >= requiredRoleIndex;
  }

  // Private Methods
  private setAuthData(authResponse: AuthResponse): void {
    console.log('AuthService: Setting auth data:', authResponse);
    console.log('AuthService: Access token format check:', {
      token: authResponse.accessToken,
      tokenParts: authResponse.accessToken?.split('.').length || 0,
      isValidFormat: authResponse.accessToken?.split('.').length === 3
    });
    
    localStorage.setItem(this.TOKEN_KEY, authResponse.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, authResponse.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(authResponse.user));
    this.currentUser = authResponse.user;
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser = null;
    
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
      this.refreshTokenTimer = null;
    }
  }

  private loadUserFromStorage(): void {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (userJson) {
      try {
        this.currentUser = JSON.parse(userJson);
      } catch {
        this.clearAuthData();
      }
    }
  }

  private setupTokenRefresh(): void {
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
    }

    const token = this.getAccessToken();
    if (!token) {
      console.log('AuthService: No token available for refresh setup');
      return;
    }

    try {
      // Validate JWT format first
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('AuthService: Invalid JWT format: token does not have 3 parts', {
          partsCount: parts.length,
          tokenPreview: token.substring(0, 50) + '...'
        });
        // Clear invalid token and logout user
        this.clearAuthData();
        return;
      }

      // Get the payload part and validate it's properly base64 encoded
      const payloadPart = parts[1];
      if (!payloadPart) {
        console.error('AuthService: Invalid JWT: missing payload part');
        this.clearAuthData();
        return;
      }

      // Ensure proper base64 padding
      const paddedPayload = payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
      
      const payload = JSON.parse(atob(paddedPayload));
      
      if (!payload.exp) {
        console.error('AuthService: JWT payload missing expiration time');
        this.clearAuthData();
        return;
      }
      
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const refreshTime = expirationTime - (5 * 60 * 1000); // Refresh 5 minutes before expiry

      console.log('AuthService: Token refresh setup', {
        expirationTime: new Date(expirationTime).toISOString(),
        currentTime: new Date(currentTime).toISOString(),
        refreshTime: new Date(refreshTime).toISOString(),
        timeUntilRefresh: Math.max(0, refreshTime - currentTime)
      });

      if (refreshTime > currentTime) {
        this.refreshTokenTimer = setTimeout(() => {
          this.refreshToken().catch(console.error);
        }, refreshTime - currentTime);
      } else {
        console.log('AuthService: Token expires soon, attempting immediate refresh');
        this.refreshToken().catch(console.error);
      }
    } catch (error) {
      console.error('AuthService: Error setting up token refresh:', error);
      // Clear the invalid token and logout user
      this.clearAuthData();
    }
  }

  // HTTP Request Helper
  async makeAuthenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry the request with new token
        return this.makeAuthenticatedRequest(endpoint, options);
      } else {
        throw new Error('Authentication expired');
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }
}

export const authService = new AuthService();
export default authService;
