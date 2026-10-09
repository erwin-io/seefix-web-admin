import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/http/api.service';
import { Items, Row } from '@app/core/models/api.model';
import { AssignRequest, AssignableUser, WorkOrderDetail, WorkOrderItem } from './work-orders.models';

/** seefix-api /api/work-orders/* plus Supervisor closeout under /api/maintenance/work-orders. */
@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  private readonly api = inject(ApiService);

  list(status: string | null) {
    return this.api.get<Items<WorkOrderItem>>('/api/work-orders', { status });
  }

  get(id: string) {
    return this.api.get<WorkOrderDetail>(`/api/work-orders/${id}`);
  }

  /** Advisory AI completion check (Agent, or DB fallback when the Agent is down). */
  completionStatus(id: string) {
    return this.api.get<Row>(`/api/work-orders/${id}/completion-status`);
  }

  assignableUsers() {
    return this.api.get<Items<AssignableUser>>('/api/work-orders/assignable-users');
  }

  assign(id: string, body: AssignRequest) {
    return this.api.post(`/api/work-orders/${id}/assign`, body);
  }

  start(id: string) {
    return this.api.post(`/api/work-orders/${id}/start`);
  }

  setStatus(id: string, status: string, message: string) {
    return this.api.post(`/api/work-orders/${id}/status`, { status, message });
  }

  addUpdate(id: string, body: { message: string | null; updateType: string | null; progressPercent: number | null }) {
    return this.api.post(`/api/work-orders/${id}/updates`, body);
  }

  addPerson(id: string, body: Record<string, unknown>) {
    return this.api.post(`/api/work-orders/${id}/people`, body);
  }

  addMaterial(id: string, body: Record<string, unknown>) {
    return this.api.post(`/api/work-orders/${id}/materials`, body);
  }

  /** Multipart: repeated `images` + `repairNotes` (+ optional actuals). */
  submitCompletion(id: string, form: FormData) {
    return this.api.upload(`/api/work-orders/${id}/completion`, form);
  }

  accept(id: string) {
    return this.api.post(`/api/maintenance/work-orders/${id}/complete`);
  }

  rework(id: string, reason: string) {
    return this.api.post(`/api/maintenance/work-orders/${id}/rework`, { reason });
  }
}
