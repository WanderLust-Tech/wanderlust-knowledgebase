/**
 * API Service for Backend Integration
 * Provides methods to interact with the Wanderlust API
 */

const API_BASE_URL = 'http://localhost:5070/api';

export interface ApiArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  path: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  description?: string;
  readingTimeMinutes: number;
  isPublished: boolean;
}

export interface ApiCodeExample {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  category: string;
  difficulty: string;
  tags: string[];
  author?: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface ApiCommunityPost {
  id: number;
  title: string;
  content: string;
  authorName: string;
  authorAvatar: string;
  type: string;
  createdAt: string;
}

export interface ApiCollection {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

class ApiService {
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Articles API
  async getArticles(): Promise<ApiArticle[]> {
    return this.makeRequest<ApiArticle[]>('/articles');
  }

  async getArticle(id: number): Promise<ApiArticle> {
    return this.makeRequest<ApiArticle>(`/articles/${id}`);
  }

  async getArticleByPath(path: string): Promise<ApiArticle> {
    // Encode the path to handle special characters
    const encodedPath = encodeURIComponent(path);
    return this.makeRequest<ApiArticle>(`/articles/by-path/${encodedPath}`);
  }

  async getArticlesByCategory(category: string): Promise<ApiArticle[]> {
    return this.makeRequest<ApiArticle[]>(`/articles/category/${category}`);
  }

  async createArticle(article: Omit<ApiArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiArticle> {
    return this.makeRequest<ApiArticle>('/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  async updateArticle(id: number, article: Partial<ApiArticle>): Promise<void> {
    await this.makeRequest(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...article, id }),
    });
  }

  async deleteArticle(id: number): Promise<void> {
    await this.makeRequest(`/articles/${id}`, {
      method: 'DELETE',
    });
  }

  // Code Examples API
  async getCodeExamples(): Promise<ApiCodeExample[]> {
    return this.makeRequest<ApiCodeExample[]>('/codeexamples');
  }

  async getCodeExample(id: string): Promise<ApiCodeExample> {
    return this.makeRequest<ApiCodeExample>(`/codeexamples/${id}`);
  }

  async createCodeExample(example: Omit<ApiCodeExample, 'dateCreated' | 'dateUpdated'>): Promise<ApiCodeExample> {
    return this.makeRequest<ApiCodeExample>('/codeexamples', {
      method: 'POST',
      body: JSON.stringify(example),
    });
  }

  async updateCodeExample(id: string, example: Partial<ApiCodeExample>): Promise<void> {
    await this.makeRequest(`/codeexamples/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...example, id }),
    });
  }

  async deleteCodeExample(id: string): Promise<void> {
    await this.makeRequest(`/codeexamples/${id}`, {
      method: 'DELETE',
    });
  }

  // Community Posts API
  async getCommunityPosts(): Promise<ApiCommunityPost[]> {
    return this.makeRequest<ApiCommunityPost[]>('/community/posts');
  }

  async getCommunityPost(id: number): Promise<ApiCommunityPost> {
    return this.makeRequest<ApiCommunityPost>(`/community/posts/${id}`);
  }

  async getCommunityPostsByType(type: string): Promise<ApiCommunityPost[]> {
    return this.makeRequest<ApiCommunityPost[]>(`/community/posts/type/${type}`);
  }

  async createCommunityPost(post: Omit<ApiCommunityPost, 'id' | 'createdAt'>): Promise<ApiCommunityPost> {
    return this.makeRequest<ApiCommunityPost>('/community/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  }

  async updateCommunityPost(id: number, post: Partial<ApiCommunityPost>): Promise<void> {
    await this.makeRequest(`/community/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...post, id }),
    });
  }

  async deleteCommunityPost(id: number): Promise<void> {
    await this.makeRequest(`/community/posts/${id}`, {
      method: 'DELETE',
    });
  }

  // Collections API
  async getCollections(): Promise<ApiCollection[]> {
    return this.makeRequest<ApiCollection[]>('/collections');
  }

  async getCollection(id: number): Promise<ApiCollection> {
    return this.makeRequest<ApiCollection>(`/collections/${id}`);
  }

  async createCollection(collection: Omit<ApiCollection, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiCollection> {
    return this.makeRequest<ApiCollection>('/collections', {
      method: 'POST',
      body: JSON.stringify(collection),
    });
  }

  async updateCollection(id: number, collection: Partial<ApiCollection>): Promise<void> {
    await this.makeRequest(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...collection, id }),
    });
  }

  async deleteCollection(id: number): Promise<void> {
    await this.makeRequest(`/collections/${id}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();
export default apiService;
