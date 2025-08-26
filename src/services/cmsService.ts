// Content Management System Service for Wanderlust Platform
import { enhancedApiService } from './EnhancedApiService';

export interface ContentItem {
  id: string;
  title: string;
  type: 'article' | 'code-example' | 'collection';
  status: 'published' | 'draft' | 'archived';
  author: string;
  createdAt: string;
  updatedAt: string;
  path: string;
  category: string;
  tags: string[];
}

export interface ContentDetails extends ContentItem {
  content: string;
  metadata: Record<string, any>;
}

export interface CreateContentRequest {
  title: string;
  content: string;
  category: string;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface UpdateContentRequest extends CreateContentRequest {}

export interface ContentAnalytics {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalCodeExamples: number;
  recentUpdates: number;
  topCategories: CategoryStats[];
  lastUpdated: string;
}

export interface CategoryStats {
  category: string;
  count: number;
  published: number;
  drafts: number;
}

export interface MediaItem {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt?: string;
  description?: string;
  uploadedBy: string;
  uploadedAt: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  imageCount: number;
  documentCount: number;
  recentUploads: number;
  topUploaders: Record<string, number>;
}

class CmsService {
  // Content Management
  async getAllContent(): Promise<ContentItem[]> {
    const response = await enhancedApiService.get<ContentItem[]>('/cms/content');
    return response.data || [];
  }

  async getContentDetails(type: string, id: string): Promise<ContentDetails> {
    const response = await enhancedApiService.get<ContentDetails>(`/cms/content/${type}/${id}`);
    if (!response.data) throw new Error('Content not found');
    return response.data;
  }

  async createContent(type: string, content: CreateContentRequest): Promise<ContentDetails> {
    const response = await enhancedApiService.post<ContentDetails>(`/cms/content/${type}`, content);
    if (!response.data) throw new Error('Failed to create content');
    return response.data;
  }

  async updateContent(type: string, id: string, content: UpdateContentRequest): Promise<void> {
    await enhancedApiService.put(`/cms/content/${type}/${id}`, content);
  }

  async deleteContent(type: string, id: string): Promise<void> {
    await enhancedApiService.delete(`/cms/content/${type}/${id}`);
  }

  // Analytics
  async getContentAnalytics(): Promise<ContentAnalytics> {
    const response = await enhancedApiService.get<ContentAnalytics>('/cms/analytics/content');
    if (!response.data) throw new Error('Failed to load analytics');
    return response.data;
  }

  // Bulk Operations
  async bulkPublish(contentIds: string[]): Promise<{ affectedCount: number }> {
    const response = await enhancedApiService.post<{ affectedCount: number }>('/cms/bulk/publish', {
      contentIds
    });
    return response.data || { affectedCount: 0 };
  }

  async bulkUnpublish(contentIds: string[]): Promise<{ affectedCount: number }> {
    const response = await enhancedApiService.post<{ affectedCount: number }>('/cms/bulk/unpublish', {
      contentIds
    });
    return response.data || { affectedCount: 0 };
  }

  // Media Management
  async getMedia(params?: {
    type?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }): Promise<MediaItem[]> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    if (params?.tag) searchParams.append('tag', params.tag);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const response = await enhancedApiService.get<MediaItem[]>(`/media?${searchParams}`);
    return response.data || [];
  }

  async getMediaItem(id: string): Promise<MediaItem> {
    const response = await enhancedApiService.get<MediaItem>(`/media/${id}`);
    if (!response.data) throw new Error('Media not found');
    return response.data;
  }

  async uploadMedia(file: File, metadata?: {
    alt?: string;
    description?: string;
    tags?: string[];
  }): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.alt) formData.append('alt', metadata.alt);
    if (metadata?.description) formData.append('description', metadata.description);
    if (metadata?.tags) {
      metadata.tags.forEach(tag => formData.append('tags', tag));
    }

    const response = await enhancedApiService.post<MediaItem>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (!response.data) throw new Error('Failed to upload media');
    return response.data;
  }

  async updateMedia(id: string, metadata: {
    alt?: string;
    description?: string;
    tags?: string[];
  }): Promise<void> {
    await enhancedApiService.put(`/media/${id}`, metadata);
  }

  async deleteMedia(id: string): Promise<void> {
    await enhancedApiService.delete(`/media/${id}`);
  }

  async getMediaStats(): Promise<MediaStats> {
    const response = await enhancedApiService.get<MediaStats>('/media/stats');
    if (!response.data) throw new Error('Failed to load media stats');
    return response.data;
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('text/')) return '📝';
    if (mimeType === 'application/json') return '🔧';
    return '📎';
  }
}

export const cmsService = new CmsService();
