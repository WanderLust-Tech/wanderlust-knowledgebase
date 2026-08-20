import { authService } from './AuthService';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
}

export interface QaChecklistRun {
  id: number;
  appId: string;
  version: string;
  createdAt: string;
  createdBy: string | null;
  completedCount: number;
  totalCount: number;
}

export interface QaChecklistRunItem {
  id: number;
  runId: number;
  templateItemId: number;
  isComplete: boolean;
  completedBy: string | null;
  completedAt: string | null;
  notes: string | null;
  category: string;
  featureName: string;
  itemText: string;
  sortOrder: number;
}

export interface RunDetail {
  run: QaChecklistRun;
  items: QaChecklistRunItem[];
}

export interface CreateRunRequest {
  appId: string;
  version: string;
}

class QaChecklistService {
  async getRuns(): Promise<QaChecklistRun[]> {
    const res = await authService.makeAuthenticatedRequest<ApiResponse<QaChecklistRun[]>>('/qachecklist/runs');
    return res.data ?? res as unknown as QaChecklistRun[];
  }

  async createRun(req: CreateRunRequest): Promise<QaChecklistRun> {
    const res = await authService.makeAuthenticatedRequest<ApiResponse<QaChecklistRun>>('/qachecklist/runs', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    return res.data ?? res as unknown as QaChecklistRun;
  }

  async getRun(id: number): Promise<RunDetail> {
    const res = await authService.makeAuthenticatedRequest<ApiResponse<RunDetail>>(`/qachecklist/runs/${id}`);
    return res.data ?? res as unknown as RunDetail;
  }

  async setItemStatus(runId: number, itemId: number, isComplete: boolean, notes?: string): Promise<void> {
    await authService.makeAuthenticatedRequest<void>(`/qachecklist/runs/${runId}/items/${itemId}`, {
      method: 'POST',
      body: JSON.stringify({ isComplete, notes }),
    });
  }

  async deleteRun(id: number): Promise<void> {
    await authService.makeAuthenticatedRequest<void>(`/qachecklist/runs/${id}/delete`, {
      method: 'POST',
    });
  }
}

export const qaChecklistService = new QaChecklistService();
