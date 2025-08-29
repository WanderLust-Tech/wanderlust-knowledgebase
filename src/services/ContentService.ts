/**
 * Content Service
 * Handles loading content from both static files and API
 * with fallback mechanisms and caching
 */

export interface ContentItem {
  id: string;
  path: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  lastUpdated: Date;
  author?: string;
  readingTime?: number;
  isPublished: boolean;
}

export interface ContentMetadata {
  title: string;
  description?: string;
  category: string;
  tags: string[];
  lastUpdated: Date;
  author?: string;
  readingTime?: number;
}

class ContentService {
  private apiBaseUrl: string;
  private contentCache = new Map<string, ContentItem>();
  private metadataCache = new Map<string, ContentMetadata>();
  private useApiFirst: boolean;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://your-api-url.com/api';
    this.useApiFirst = import.meta.env.VITE_USE_API_CONTENT === 'true';
  }

  /**
   * Get content by path with fallback mechanism
   * Priority: 1. API (if enabled), 2. Static files, 3. Cache
   */
  async getContent(path: string): Promise<{ content: string; metadata: ContentMetadata }> {
    // Check cache first
    const cached = this.contentCache.get(path);
    if (cached) {
      return {
        content: cached.content,
        metadata: {
          title: cached.title,
          description: undefined,
          category: cached.category,
          tags: cached.tags,
          lastUpdated: cached.lastUpdated,
          author: cached.author,
          readingTime: cached.readingTime
        }
      };
    }

    try {
      if (this.useApiFirst) {
        // Try API first
        try {
          const apiResult = await this.loadFromAPI(path);
          this.cacheContent(path, apiResult);
          return {
            content: apiResult.content,
            metadata: {
              title: apiResult.title,
              category: apiResult.category,
              tags: apiResult.tags,
              lastUpdated: apiResult.lastUpdated,
              author: apiResult.author,
              readingTime: apiResult.readingTime
            }
          };
        } catch (apiError) {
          console.warn(`API failed for ${path}, falling back to static files:`, apiError);
          // Fall back to static files
          return await this.loadFromStaticFiles(path);
        }
      } else {
        // Try static files first
        try {
          return await this.loadFromStaticFiles(path);
        } catch (staticError) {
          console.warn(`Static files failed for ${path}, trying API:`, staticError);
          // Fall back to API
          const apiResult = await this.loadFromAPI(path);
          this.cacheContent(path, apiResult);
          return {
            content: apiResult.content,
            metadata: {
              title: apiResult.title,
              category: apiResult.category,
              tags: apiResult.tags,
              lastUpdated: apiResult.lastUpdated,
              author: apiResult.author,
              readingTime: apiResult.readingTime
            }
          };
        }
      }
    } catch (error) {
      console.error(`Failed to load content for ${path}:`, error);
      throw new Error(`Content not found: ${path}`);
    }
  }

  /**
   * Load content from API
   */
  private async loadFromAPI(path: string): Promise<ContentItem> {
    const response = await fetch(`${this.apiBaseUrl}/articles/by-path/${encodeURIComponent(path)}`, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
        // 'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      path: data.path,
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags || [],
      lastUpdated: new Date(data.lastUpdated),
      author: data.author,
      readingTime: data.readingTime,
      isPublished: data.isPublished
    };
  }

  /**
   * Load content from static markdown files (fallback)
   */
  private async loadFromStaticFiles(path: string): Promise<{ content: string; metadata: ContentMetadata }> {
    const response = await fetch(`/content/${path}.md`);
    
    if (!response.ok) {
      throw new Error(`Static file not found: ${path}.md`);
    }

    const markdownContent = await response.text();
    
    // Extract metadata from frontmatter or content
    const metadata = this.extractMetadata(markdownContent, path);
    
    return {
      content: markdownContent,
      metadata
    };
  }

  /**
   * Extract metadata from markdown content
   */
  private extractMetadata(content: string, path: string): ContentMetadata {
    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : this.pathToTitle(path);

    // Basic metadata extraction - you can enhance this
    const category = path.split('/')[0] || 'general';
    const tags: string[] = [];
    
    // Estimate reading time
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);

    return {
      title,
      category,
      tags,
      lastUpdated: new Date(),
      readingTime
    };
  }

  /**
   * Convert path to readable title
   */
  private pathToTitle(path: string): string {
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1] || '';
    return fileName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Cache content for faster subsequent access
   */
  private cacheContent(path: string, content: ContentItem): void {
    this.contentCache.set(path, content);
  }

  /**
   * Get all content metadata for building navigation
   */
  async getContentIndex(): Promise<ContentMetadata[]> {
    try {
      if (this.useApiFirst) {
        const response = await fetch(`${this.apiBaseUrl}/articles/metadata`, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          return data.map((item: any) => ({
            title: item.title,
            description: item.description,
            category: item.category,
            tags: item.tags || [],
            lastUpdated: new Date(item.lastUpdated),
            author: item.author,
            readingTime: item.readingTime
          }));
        }
      }

      // Fallback to static content index
      return this.getStaticContentIndex();
    } catch (error) {
      console.warn('Failed to load content index from API, using static fallback:', error);
      return this.getStaticContentIndex();
    }
  }

  /**
   * Get static content index as fallback
   */
  private async getStaticContentIndex(): Promise<ContentMetadata[]> {
    try {
      const response = await fetch('/search-index.json');
      if (response.ok) {
        const data = await response.json();
        return data.map((item: any) => ({
          title: item.title,
          category: item.path.split('/')[0] || 'general',
          tags: [],
          lastUpdated: new Date(),
          readingTime: Math.ceil(item.content.split(/\s+/).length / 200)
        }));
      }
    } catch (error) {
      console.warn('Failed to load static content index:', error);
    }
    return [];
  }

  /**
   * Search content across both API and static sources
   */
  async searchContent(query: string): Promise<ContentItem[]> {
    try {
      if (this.useApiFirst) {
        const response = await fetch(`${this.apiBaseUrl}/articles/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          return data.map((item: any) => ({
            id: item.id,
            path: item.path,
            title: item.title,
            content: item.content,
            category: item.category,
            tags: item.tags || [],
            lastUpdated: new Date(item.lastUpdated),
            author: item.author,
            readingTime: item.readingTime,
            isPublished: item.isPublished
          }));
        }
      }

      // Fallback to static search
      return this.searchStaticContent(query);
    } catch (error) {
      console.warn('API search failed, using static search:', error);
      return this.searchStaticContent(query);
    }
  }

  private async searchStaticContent(query: string): Promise<ContentItem[]> {
    // Implement static content search using existing search index
    // This would integrate with your current search functionality
    return [];
  }

  /**
   * Clear cache (useful for development or when content is updated)
   */
  clearCache(): void {
    this.contentCache.clear();
    this.metadataCache.clear();
  }

  /**
   * Update content (for CMS functionality)
   */
  async updateContent(path: string, content: string, metadata: Partial<ContentMetadata>): Promise<void> {
    if (!this.useApiFirst) {
      throw new Error('API mode must be enabled to update content');
    }

    const response = await fetch(`${this.apiBaseUrl}/articles/by-path/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers
      },
      body: JSON.stringify({
        content,
        ...metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update content: ${response.statusText}`);
    }

    // Clear cache for updated content
    this.contentCache.delete(path);
  }
}

export const contentService = new ContentService();
