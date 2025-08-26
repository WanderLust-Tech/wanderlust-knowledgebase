import { apiService } from './ApiService';

interface ArticleSource {
  source: 'markdown' | 'api';
  content: string;
  title: string;
  metadata?: {
    category?: string;
    tags?: string[];
    description?: string;
    readingTime?: number;
    lastModified?: string;
  };
}

class HybridArticleService {
  private useApiFirst = true; // Can be configured

  /**
   * Loads article content from API first, falling back to markdown files
   */
  async loadArticle(path: string): Promise<ArticleSource> {
    if (this.useApiFirst) {
      try {
        // Try to load from API first
        const article = await apiService.getArticleByPath(path);
        return {
          source: 'api',
          content: article.content,
          title: article.title,
          metadata: {
            category: article.category,
            tags: article.tags,
            description: article.description,
            readingTime: article.readingTimeMinutes,
            lastModified: article.updatedAt,
          }
        };
      } catch (error) {
        console.log('API load failed, falling back to markdown:', error);
        // Fall through to markdown loading
      }
    }

    // Load from markdown file
    try {
      const response = await fetch(`/content/${path}.md`);
      if (!response.ok) {
        throw new Error(`Markdown file not found: ${path}`);
      }
      
      const content = await response.text();
      const title = this.extractTitleFromMarkdown(content);
      
      return {
        source: 'markdown',
        content,
        title,
        metadata: this.parseMarkdownMetadata(content)
      };
    } catch (error) {
      throw new Error(`Failed to load article from both API and markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Saves article content (if using API)
   */
  async saveArticle(path: string, content: string, metadata?: any): Promise<void> {
    if (!this.useApiFirst) {
      throw new Error('Saving not supported in markdown-only mode');
    }

    try {
      // Check if article exists
      let article;
      try {
        article = await apiService.getArticleByPath(path);
        // Update existing
        await apiService.updateArticle(article.id, {
          content,
          title: metadata?.title || article.title,
          description: metadata?.description || article.description,
          tags: metadata?.tags || article.tags,
          category: metadata?.category || article.category,
          readingTimeMinutes: metadata?.readingTime || this.estimateReadingTime(content),
        });
      } catch (error) {
        // Create new
        await apiService.createArticle({
          title: metadata?.title || this.extractTitleFromMarkdown(content),
          content,
          category: metadata?.category || this.getCategoryFromPath(path),
          path,
          tags: metadata?.tags || [],
          description: metadata?.description || '',
          readingTimeMinutes: metadata?.readingTime || this.estimateReadingTime(content),
          isPublished: true,
        });
      }
    } catch (error) {
      throw new Error(`Failed to save article: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets all available articles from both sources
   */
  async getAllArticles(): Promise<Array<{ path: string; title: string; source: 'api' | 'markdown' }>> {
    const articles: Array<{ path: string; title: string; source: 'api' | 'markdown' }> = [];

    // Get articles from API
    if (this.useApiFirst) {
      try {
        const apiArticles = await apiService.getArticles();
        articles.push(...apiArticles.map(article => ({
          path: article.path,
          title: article.title,
          source: 'api' as const
        })));
      } catch (error) {
        console.warn('Failed to load articles from API:', error);
      }
    }

    // TODO: Could also scan markdown files if needed
    // This would require additional implementation

    return articles;
  }

  /**
   * Searches articles across both sources
   */
  async searchArticles(query: string): Promise<Array<{ path: string; title: string; snippet: string; source: 'api' | 'markdown' }>> {
    const results: Array<{ path: string; title: string; snippet: string; source: 'api' | 'markdown' }> = [];

    // Search in API articles
    if (this.useApiFirst) {
      try {
        const apiArticles = await apiService.getArticles();
        for (const article of apiArticles) {
          if (this.matchesQuery(article, query)) {
            results.push({
              path: article.path,
              title: article.title,
              snippet: this.extractSnippet(article.content, query),
              source: 'api'
            });
          }
        }
      } catch (error) {
        console.warn('Failed to search API articles:', error);
      }
    }

    return results;
  }

  /**
   * Configure whether to use API first or markdown first
   */
  setApiFirst(useApi: boolean): void {
    this.useApiFirst = useApi;
  }

  private extractTitleFromMarkdown(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled';
  }

  private parseMarkdownMetadata(content: string): any {
    // Simple frontmatter parsing
    const frontmatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n/s);
    if (frontmatterMatch) {
      try {
        return JSON.parse(frontmatterMatch[1]);
      } catch {
        // Ignore parsing errors
      }
    }
    return {};
  }

  private getCategoryFromPath(path: string): string {
    const parts = path.split('/');
    return parts.length > 1 ? parts[0] : 'general';
  }

  private estimateReadingTime(content: string): number {
    const words = content.split(/\s+/).length;
    return Math.ceil(words / 200); // 200 words per minute
  }

  private matchesQuery(article: any, query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return article.title.toLowerCase().includes(lowerQuery) ||
           article.content.toLowerCase().includes(lowerQuery) ||
           (article.description && article.description.toLowerCase().includes(lowerQuery)) ||
           (article.tags && article.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)));
  }

  private extractSnippet(content: string, query: string, maxLength = 150): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);
    const snippet = content.substring(start, end);
    
    return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '');
  }
}

export const hybridArticleService = new HybridArticleService();
