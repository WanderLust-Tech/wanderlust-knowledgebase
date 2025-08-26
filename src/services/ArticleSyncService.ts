import { enhancedApiService, ApiResponse } from './EnhancedApiService';

export interface SyncResult {
  filesProcessed: number;
  articlesCreated: number;
  articlesUpdated: number;
  articlesSkipped: number;
  errors: string[];
  syncStartTime: string;
  syncEndTime: string;
  duration: string;
}

export interface SyncStatus {
  contentPath: string;
  contentPathExists: boolean;
  markdownFileCount: number;
  databaseArticleCount: number;
  lastSyncTime?: string;
  isContentPathConfigured: boolean;
}

export interface ValidationResult {
  totalMarkdownFiles: number;
  filesWithIssues: number;
  issues: string[];
  validationTime: string;
}

export interface SyncFileRequest {
  relativePath: string;
}

class ArticleSyncService {
  /**
   * Performs a full sync from markdown files to database
   */
  async syncFromMarkdown(): Promise<SyncResult> {
    const response = await enhancedApiService.post<SyncResult>('/articlesync/sync-from-markdown');
    
    if (!response.success) {
      throw new Error(response.error || 'Sync failed');
    }
    
    return response.data!;
  }

  /**
   * Syncs database articles back to markdown files
   */
  async syncToMarkdown(): Promise<{ message: string }> {
    const response = await enhancedApiService.post<{ message: string }>('/articlesync/sync-to-markdown');
    
    if (!response.success) {
      throw new Error(response.error || 'Sync to markdown failed');
    }
    
    return response.data!;
  }

  /**
   * Gets the current sync status and content statistics
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const response = await enhancedApiService.get<SyncStatus>('/articlesync/status');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get sync status');
    }
    
    return response.data!;
  }

  /**
   * Validates content integrity between files and database
   */
  async validateContent(): Promise<ValidationResult> {
    const response = await enhancedApiService.get<ValidationResult>('/articlesync/validate');
    
    if (!response.success) {
      throw new Error(response.error || 'Validation failed');
    }
    
    return response.data!;
  }

  /**
   * Syncs a specific markdown file by path
   */
  async syncSpecificFile(request: SyncFileRequest): Promise<{ message: string }> {
    const response = await enhancedApiService.post<{ message: string }>('/articlesync/sync-file', request);
    
    if (!response.success) {
      throw new Error(response.error || 'File sync failed');
    }
    
    return response.data!;
  }

  /**
   * Performs a comprehensive sync operation with progress tracking
   */
  async performFullSync(onProgress?: (message: string) => void): Promise<SyncResult> {
    try {
      onProgress?.('Getting sync status...');
      const status = await this.getSyncStatus();
      
      onProgress?.(`Found ${status.markdownFileCount} markdown files and ${status.databaseArticleCount} database articles`);
      
      onProgress?.('Validating content...');
      const validation = await this.validateContent();
      
      if (validation.filesWithIssues > 0) {
        onProgress?.(`Warning: ${validation.filesWithIssues} files have issues`);
        console.warn('Content validation issues:', validation.issues);
      }
      
      onProgress?.('Starting sync from markdown to database...');
      const result = await this.syncFromMarkdown();
      
      onProgress?.(`Sync completed: ${result.articlesCreated} created, ${result.articlesUpdated} updated, ${result.articlesSkipped} skipped`);
      
      if (result.errors.length > 0) {
        onProgress?.(`Warning: ${result.errors.length} errors occurred during sync`);
        console.warn('Sync errors:', result.errors);
      }
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      onProgress?.(`Sync failed: ${message}`);
      throw error;
    }
  }

  /**
   * Formats sync result for display
   */
  formatSyncResult(result: SyncResult): string {
    const duration = this.parseDuration(result.duration);
    return `Sync completed in ${duration}:
• Files processed: ${result.filesProcessed}
• Articles created: ${result.articlesCreated}
• Articles updated: ${result.articlesUpdated}
• Articles skipped: ${result.articlesSkipped}
${result.errors.length > 0 ? `• Errors: ${result.errors.length}` : ''}`;
  }

  /**
   * Formats sync status for display
   */
  formatSyncStatus(status: SyncStatus): string {
    return `Content Sync Status:
• Content path: ${status.contentPath}
• Path exists: ${status.contentPathExists ? '✅' : '❌'}
• Markdown files: ${status.markdownFileCount}
• Database articles: ${status.databaseArticleCount}
• Last sync: ${status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Never'}
• Configuration: ${status.isContentPathConfigured ? '✅' : '❌'}`;
  }

  /**
   * Formats validation result for display
   */
  formatValidationResult(validation: ValidationResult): string {
    return `Content Validation:
• Total files: ${validation.totalMarkdownFiles}
• Files with issues: ${validation.filesWithIssues}
• Validation time: ${new Date(validation.validationTime).toLocaleString()}
${validation.issues.length > 0 ? `\nIssues:\n${validation.issues.map(issue => `• ${issue}`).join('\n')}` : ''}`;
  }

  private parseDuration(duration: string): string {
    // Parse duration format like "00:00:05.1234567" to human readable
    const match = duration.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      const [, hours, minutes, seconds] = match;
      if (parseInt(hours) > 0) return `${hours}h ${minutes}m ${seconds}s`;
      if (parseInt(minutes) > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }
    return duration;
  }
}

export const articleSyncService = new ArticleSyncService();
