/**
 * Dynamic Content Index Builder
 * Fetches content structure from API or builds from static files
 */

import { ContentNode } from '../contentIndex';
import { contentService } from './ContentService';

interface ContentIndexService {
  buildDynamicIndex(): Promise<ContentNode[]>;
  updateIndexFromAPI(): Promise<void>;
  mergeStaticAndDynamicContent(): Promise<ContentNode[]>;
}

class ContentIndexBuilder implements ContentIndexService {
  private cachedIndex: ContentNode[] | null = null;
  private lastUpdated: Date | null = null;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Build content index dynamically from available sources
   */
  async buildDynamicIndex(): Promise<ContentNode[]> {
    // Check cache first
    if (this.cachedIndex && this.lastUpdated && 
        Date.now() - this.lastUpdated.getTime() < this.cacheTimeout) {
      return this.cachedIndex;
    }

    try {
      // Try to merge both API and static content
      const index = await this.mergeStaticAndDynamicContent();
      this.cachedIndex = index;
      this.lastUpdated = new Date();
      return index;
    } catch (error) {
      console.warn('Failed to build dynamic index, using static fallback:', error);
      
      // Import static content index as fallback
      const { contentIndex } = await import('../contentIndex');
      this.cachedIndex = contentIndex;
      this.lastUpdated = new Date();
      return contentIndex;
    }
  }

  /**
   * Update index from API metadata
   */
  async updateIndexFromAPI(): Promise<void> {
    try {
      const metadata = await contentService.getContentIndex();
      
      // Group content by category and build tree structure
      const categoryMap = new Map<string, ContentNode>();
      
      metadata.forEach(item => {
        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, {
            title: this.formatCategoryTitle(item.category),
            description: `${item.category} documentation and guides`,
            children: []
          });
        }
        
        const category = categoryMap.get(item.category)!;
        category.children!.push({
          title: item.title,
          path: this.extractPathFromTitle(item.title, item.category),
          description: item.description
        });
      });

      // Convert to array and sort
      const dynamicIndex = Array.from(categoryMap.values()).sort((a, b) => 
        this.getCategoryOrder(a.title) - this.getCategoryOrder(b.title)
      );

      this.cachedIndex = dynamicIndex;
      this.lastUpdated = new Date();
    } catch (error) {
      console.error('Failed to update index from API:', error);
      throw error;
    }
  }

  /**
   * Merge static content index with API metadata
   */
  async mergeStaticAndDynamicContent(): Promise<ContentNode[]> {
    // Load static index
    const { contentIndex: staticIndex } = await import('../contentIndex');
    
    try {
      // Get API metadata
      const apiMetadata = await contentService.getContentIndex();
      const apiPaths = new Set(apiMetadata.map(item => 
        this.extractPathFromTitle(item.title, item.category)
      ));

      // Enhance static index with API information
      const enhancedIndex = this.enhanceWithAPIData(staticIndex, apiMetadata);
      
      // Add any API-only content that's not in static index
      const staticPaths = new Set(this.extractAllPaths(staticIndex));
      const apiOnlyContent = apiMetadata.filter(item => 
        !staticPaths.has(this.extractPathFromTitle(item.title, item.category))
      );

      if (apiOnlyContent.length > 0) {
        // Group API-only content
        const apiOnlyMap = new Map<string, ContentNode>();
        
        apiOnlyContent.forEach(item => {
          const category = item.category;
          if (!apiOnlyMap.has(category)) {
            apiOnlyMap.set(category, {
              title: `${this.formatCategoryTitle(category)} (API)`,
              description: `Additional ${category} content from database`,
              children: []
            });
          }
          
          apiOnlyMap.get(category)!.children!.push({
            title: item.title,
            path: this.extractPathFromTitle(item.title, item.category),
            description: item.description
          });
        });

        // Add API-only sections to enhanced index
        enhancedIndex.push(...Array.from(apiOnlyMap.values()));
      }

      return enhancedIndex;
    } catch (error) {
      console.warn('API merge failed, using static index:', error);
      return staticIndex;
    }
  }

  /**
   * Enhance static nodes with API metadata
   */
  private enhanceWithAPIData(nodes: ContentNode[], apiMetadata: any[]): ContentNode[] {
    return nodes.map(node => {
      if (node.children) {
        return {
          ...node,
          children: this.enhanceWithAPIData(node.children, apiMetadata)
        };
      } else if (node.path) {
        // Find matching API metadata
        const apiItem = apiMetadata.find(item => 
          this.extractPathFromTitle(item.title, item.category) === node.path
        );
        
        if (apiItem) {
          return {
            ...node,
            title: apiItem.title, // Use API title if available
            description: apiItem.description || node.description
          };
        }
      }
      
      return node;
    });
  }

  /**
   * Extract all paths from content index recursively
   */
  private extractAllPaths(nodes: ContentNode[]): string[] {
    const paths: string[] = [];
    
    nodes.forEach(node => {
      if (node.path) {
        paths.push(node.path);
      }
      if (node.children) {
        paths.push(...this.extractAllPaths(node.children));
      }
    });
    
    return paths;
  }

  /**
   * Extract path from title and category
   */
  private extractPathFromTitle(title: string, category: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    return `${category}/${slug}`;
  }

  /**
   * Format category title for display
   */
  private formatCategoryTitle(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get category display order
   */
  private getCategoryOrder(categoryTitle: string): number {
    const order = [
      'Learning Path Guide',
      'Introduction',
      'Getting Started',
      'Architecture',
      'Development',
      'Modules',
      'APIs',
      'Security',
      'Performance',
      'Debugging',
      'Testing',
      'Platform Specific',
      'Contributing',
      'Advanced Topics'
    ];
    
    const index = order.indexOf(categoryTitle);
    return index === -1 ? order.length : index;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedIndex = null;
    this.lastUpdated = null;
  }

  /**
   * Get cached index if available
   */
  getCachedIndex(): ContentNode[] | null {
    return this.cachedIndex;
  }
}

export const contentIndexBuilder = new ContentIndexBuilder();
