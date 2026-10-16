import { Injectable, inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { DatasetDef } from '@app/core/data/dataset.store';
import { ApiService } from '@app/core/http/api.service';
import { DirectUploadService } from '@app/core/http/direct-upload.service';
import { HandoffDetail, ProcurementInboxItem } from './procurement.models';

export const PROCUREMENT_INBOX: DatasetDef<ProcurementInboxItem> = {
  key: 'procurement-inbox',
  path: '/api/procurement/inbox',
  idOf: (h) => h.HandoffId,
  domains: ['procurement', 'reports', 'reference'],
};

/** seefix-api /api/procurement/* plus the Supervisor clarification answer. */
@Injectable({ providedIn: 'root' })
export class ProcurementService {
  private readonly api = inject(ApiService);
  private readonly uploads = inject(DirectUploadService);

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

  /** Uploads the file straight to Cloudinary, then attaches it with `documentType` and optional `clarificationId`. */
  uploadDocument(id: string, file: File, fields: { documentType: string; clarificationId?: string | null }) {
    return this.uploads.upload('procurement-document', [file]).pipe(
      switchMap(([uploaded]) =>
        this.api.post(`/api/procurement/handoffs/${id}/documents`, {
          ...fields,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          fileName: file.name,
          mimeType: file.type || undefined,
        }),
      ),
    );
  }

  recordOutcome(id: string, body: Record<string, unknown>) {
    return this.api.post(`/api/procurement/handoffs/${id}/outcome`, body);
  }
}
