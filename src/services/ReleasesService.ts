import { authService } from './AuthService';

export interface BrowserRelease {
  id: number;
  appId: string;
  version: string;
  platform: string;
  arch: string;
  installerName: string;
  installerUrl: string;
  hashSha256: string;
  sizeBytes: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateReleaseRequest {
  appId: string;
  version: string;
  platform: string;
  arch: string;
  installerName: string;
  installerUrl: string;
  hashSha256: string;
  sizeBytes: number;
}

class ReleasesService {
  async getAll(): Promise<BrowserRelease[]> {
    return authService.makeAuthenticatedRequest<BrowserRelease[]>('/releases');
  }

  async create(req: CreateReleaseRequest): Promise<BrowserRelease> {
    return authService.makeAuthenticatedRequest<BrowserRelease>('/releases', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async deactivate(id: number): Promise<void> {
    await authService.makeAuthenticatedRequest<void>(`/releases/${id}/deactivate`, {
      method: 'POST',
    });
  }
}

export const releasesService = new ReleasesService();
