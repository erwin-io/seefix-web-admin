import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '@app/core/http/api.service';
import {
  ActionResult,
  AskResponse,
  Draft,
  DraftKind,
  QueueItem,
  ReassessmentHistory,
  ReassessmentJob,
  RecordContext,
  RecordFact,
  RecordType,
  Reminder,
  ToolCatalog,
} from './assistant.model';

const BASE = '/api/assistant';

/** Typed calls to `/api/assistant/*`. The web never talks to the Agent; the API picks the facts. */
@Injectable({ providedIn: 'root' })
export class AssistantApi {
  private readonly api = inject(ApiService);

  tools(): Promise<ToolCatalog> {
    return firstValueFrom(this.api.get<ToolCatalog>(`${BASE}/tools`));
  }

  ask(question: string, context: RecordContext | null): Promise<AskResponse> {
    return firstValueFrom(
      this.api.post<AskResponse>(`${BASE}/ask`, context ? { question, context } : { question }),
    );
  }

  actionQueue(limit = 5): Promise<QueueItem[]> {
    return firstValueFrom(
      this.api.get<{ items: QueueItem[] }>(`${BASE}/tools/action-queue`, { limit }),
    ).then((r) => r.items);
  }

  record(type: RecordType, id: string): Promise<RecordFact> {
    return firstValueFrom(
      this.api.get<{ fact: RecordFact }>(`${BASE}/tools/records/${type}/${encodeURIComponent(id)}`),
    ).then((r) => r.fact);
  }

  drafts(entityId: string): Promise<Draft[]> {
    return firstValueFrom(this.api.get<{ items: Draft[] }>(`${BASE}/drafts`, { entityId })).then(
      (r) => r.items,
    );
  }

  reminders(scope: 'received' | 'created'): Promise<Reminder[]> {
    return firstValueFrom(this.api.get<{ items: Reminder[] }>(`${BASE}/reminders`, { scope })).then(
      (r) => r.items,
    );
  }

  reassessments(reportId: string): Promise<ReassessmentHistory> {
    return firstValueFrom(this.api.get<ReassessmentHistory>(`${BASE}/reassessments`, { reportId }));
  }

  /**
   * One assistant write. Without `confirm` the API only returns a preview and writes nothing; the UI shows it and
   * calls again with `confirm: true` after the human agrees. Creates carry an idempotency key so a retry never
   * creates a second row.
   */
  saveDraft(p: { kind: DraftKind; entityId: string; body: string }, confirm?: { key: string }) {
    return this.write<{ draft: Draft }>('/drafts', p, confirm);
  }

  discardDraft(id: string, confirm?: boolean) {
    return this.write<{ draft: Draft }>(
      `/drafts/${encodeURIComponent(id)}/discard`,
      {},
      confirm ? {} : undefined,
    );
  }

  createReminder(
    p: {
      title: string;
      message?: string;
      dueAt: string;
      timeZone: string;
      entity?: { type: string; id: string };
    },
    confirm?: { key: string },
  ) {
    return this.write<{ reminder: Reminder }>('/reminders', p, confirm);
  }

  cancelReminder(id: string, confirm?: boolean) {
    return this.write<{ reminder: Reminder }>(
      `/reminders/${encodeURIComponent(id)}/cancel`,
      {},
      confirm ? {} : undefined,
    );
  }

  requestReassessment(p: { reportId: string; reason: string }, confirm?: { key: string }) {
    return this.write<{ job: ReassessmentJob }>('/reassessments', p, confirm);
  }

  cancelReassessment(id: string, confirm?: boolean) {
    return this.write<{ job: ReassessmentJob }>(
      `/reassessments/${encodeURIComponent(id)}/cancel`,
      {},
      confirm ? {} : undefined,
    );
  }

  private write<T>(
    path: string,
    params: object,
    confirm?: { key?: string },
  ): Promise<ActionResult<T>> {
    const body = confirm
      ? { ...params, confirm: true, ...(confirm.key ? { idempotencyKey: confirm.key } : {}) }
      : params;
    return firstValueFrom(this.api.post<ActionResult<T>>(`${BASE}${path}`, body));
  }
}

export function newKey(): string {
  return crypto.randomUUID();
}
