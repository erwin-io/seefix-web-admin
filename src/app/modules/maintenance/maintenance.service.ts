import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/http/api.service';
import { Items, Row } from '@app/core/models/api.model';
import { ActionItem, CategoryRef, MaintenanceReportItem, ReportDetail, ReviewQueueItem, ReviewResult, Triage } from './maintenance.models';

/** seefix-api /api/maintenance/* and report detail. */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly api = inject(ApiService);

  actionCenter() {
    return this.api.get<Items<ActionItem>>('/api/maintenance/action-center');
  }

  reviewQueue(triage: Triage) {
    return this.api.get<Items<ReviewQueueItem>>('/api/maintenance/review-queue', { triage });
  }

  reports(triage: Triage, status: string | null) {
    return this.api.get<Items<MaintenanceReportItem>>('/api/maintenance/reports', { triage, status });
  }

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
