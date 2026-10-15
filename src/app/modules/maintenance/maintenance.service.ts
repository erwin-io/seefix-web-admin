import { Injectable, inject } from '@angular/core';
import { DatasetDef } from '@app/core/data/dataset.store';
import { ApiService } from '@app/core/http/api.service';
import { Items, Row } from '@app/core/models/api.model';
import { ActionItem, CategoryRef, MaintenanceReportItem, ReportDetail, ReviewQueueItem, ReviewResult } from './maintenance.models';

/** Full-list datasets (every page, filtered/sorted locally). Server order = business ranking. */
export const ACTION_CENTER: DatasetDef<ActionItem> = {
  key: 'action-center',
  path: '/api/maintenance/action-center',
  idOf: (a) => `${a.EntityType}:${a.EntityId}:${a.ActionType}`,
  domains: ['reports', 'work_orders', 'procurement', 'reference'],
};
export const REVIEW_QUEUE: DatasetDef<ReviewQueueItem> = {
  key: 'review-queue',
  path: '/api/maintenance/review-queue',
  idOf: (r) => r.ReportId,
  domains: ['reports', 'reference'],
};
export const REPORTS: DatasetDef<MaintenanceReportItem> = {
  key: 'reports',
  path: '/api/maintenance/reports',
  idOf: (r) => r.id,
  domains: ['reports', 'reference'],
};

/** seefix-api /api/maintenance/* and report detail. */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly api = inject(ApiService);

  /** Role-scoped by the API: staff see all, Procurement/Worker only linked reports. */
  report(id: string) {
    return this.api.get<ReportDetail>(`/api/reports/${id}`);
  }

  /** Takes the MaintenanceReview id, not the report id. */
  review(id: string) {
    return this.api.get<{ review: Row }>(`/api/maintenance/reviews/${id}`);
  }

  categories() {
    return this.api.get<Items<CategoryRef>>('/api/reference/categories');
  }

  regenerateDraft(reportId: string) {
    return this.api.post(`/api/maintenance/reports/${reportId}/maintenance-request/regenerate`);
  }

  submitReview(reportId: string, body: Record<string, unknown>) {
    return this.api.post<ReviewResult>(`/api/maintenance/reports/${reportId}/review`, body);
  }
}
