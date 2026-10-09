import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/http/api.service';
import { Items } from '@app/core/models/api.model';
import { HandoffDetail, ProcurementInboxItem } from './procurement.models';

/** seefix-api /api/procurement/* plus the Supervisor clarification answer. */
@Injectable({ providedIn: 'root' })
export class ProcurementService {
  private readonly api = inject(ApiService);

  inbox() {
    return this.api.get<Items<ProcurementInboxItem>>('/api/procurement/inbox');
  }

  handoff(id: string) {
    return this.api.get<HandoffDetail>(`/api/procurement/handoffs/${id}`);
  }

  acknowledge(id: string) {
    return this.api.post(`/api/procurement/handoffs/${id}/acknowledge`);
  }

  start(id: string, body: { externalSystemReference: string | null; externalSystemUrl: string | null }) {
    return this.api.post(`/api/procurement/handoffs/${id}/start`, body);
  }

  askClarification(id: string, question: string) {
    return this.api.post(`/api/procurement/handoffs/${id}/clarifications`, { question });
  }

  /** MAINTENANCE_SUPERVISOR / ADMIN only. */
  answerClarification(clarificationId: string, response: string) {
    return this.api.post(`/api/maintenance/procurement/clarifications/${clarificationId}/respond`, { response });
  }

  /** Multipart: `file`, `documentType`, optional `clarificationId`. */
  uploadDocument(id: string, form: FormData) {
    return this.api.upload(`/api/procurement/handoffs/${id}/documents`, form);
  }

  recordOutcome(id: string, body: Record<string, unknown>) {
    return this.api.post(`/api/procurement/handoffs/${id}/outcome`, body);
  }
}
