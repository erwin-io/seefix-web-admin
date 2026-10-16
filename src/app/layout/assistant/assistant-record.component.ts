import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SessionService } from '@app/core/auth/session.service';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';
import { UiService } from '@app/shared/services/ui.service';
import { AssistantApi, newKey } from './assistant.api';
import { previewThenConfirm } from './assistant.confirm';
import { JOB_STATUS, explain } from './assistant.explain';
import {
  ACTIVE_JOB,
  DRAFT_KIND,
  Draft,
  MAX_REASSESSMENTS,
  ReassessmentHistory,
  RecordContext,
  RecordFact,
} from './assistant.model';
import { AssistantStore } from './assistant.store';

/** While a reassessment is queued or running, its state is re-read this often (only while this tab is open). */
export const JOB_POLL_MS = 10_000;

/**
 * Draft-only helpers and guarded reassessment for the record on screen. Nothing here submits a workflow decision:
 * drafts are private text the human pastes into the real form, and a reassessment only queues a new AI assessment
 * after an explicit confirmation; the current assessment and every human decision stay as they are.
 */
@Component({
  selector: 'app-assistant-record',
  imports: [
    DatePipe,
    FormsModule,
    HumanizePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './assistant-record.component.html',
  styleUrl: './assistant-record.component.scss',
})
export class AssistantRecordComponent {
  readonly context = input.required<RecordContext>();

  readonly store = inject(AssistantStore);
  private readonly api = inject(AssistantApi);
  private readonly ui = inject(UiService);
  private readonly session = inject(SessionService);

  readonly jobStatus = JOB_STATUS;
  readonly fact = signal<RecordFact | null>(null);
  readonly factError = signal<string | null>(null);
  readonly drafts = signal<Draft[]>([]);
  readonly history = signal<ReassessmentHistory | null>(null);
  readonly busy = signal(false);
  /** Result of the last write: shown in an alert region so screen readers hear denials and conflicts. */
  readonly problem = signal<string | null>(null);
  readonly done = signal<string | null>(null);

  readonly draftKind = computed(() => DRAFT_KIND[this.context().type]);
  readonly canDraft = computed(() => this.session.has(...this.draftKind().roles));
  readonly draftText = computed(() => this.store.draftText()[this.context().id] ?? '');
  readonly showReassess = computed(
    () => this.context().type === 'report' && this.store.canReassess(),
  );
  readonly activeJob = computed(
    () => this.history()?.jobs.find((j) => ACTIVE_JOB.includes(j.status)) ?? null,
  );
  /** Why a reassessment can't be requested now (null = eligible). The API re-checks everything under a row lock. */
  readonly ineligible = computed<string | null>(() => {
    const fact = this.fact();
    const history = this.history();
    if (!fact || !history) return 'Checking eligibility…';
    const status = String(fact.data['status'] ?? '');
    const agent = String(fact.data['agentStatus'] ?? '');
    if (status !== 'PENDING_REVIEW') {
      return `This report is ${status.replace(/_/g, ' ').toLowerCase() || 'not available'}. Only reports waiting for Maintenance Review can be reassessed.`;
    }
    if (agent !== 'COMPLETED')
      return 'The current AI assessment has not finished, so there is nothing to reassess yet.';
    if (this.activeJob()) return 'A reassessment is already in progress for this report.';
    if (history.jobs.length >= MAX_REASSESSMENTS)
      return `This report has reached the limit of ${MAX_REASSESSMENTS} reassessments.`;
    return null;
  });

  private run = 0;
  private draftKey: string | null = null;
  private jobKey: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const ctx = this.context();
      untracked(() => this.load(ctx));
    });
    inject(DestroyRef).onDestroy(() => {
      this.run++;
      this.stopPolling();
    });
  }

  setDraft(text: string): void {
    this.store.setDraft(this.context().id, text);
  }

  async saveDraft(): Promise<void> {
    const ctx = this.context();
    const body = this.draftText().trim();
    if (!body || this.busy()) return;
    const params = { kind: this.draftKind().kind, entityId: ctx.id, body };
    await this.write(async () => {
      const ok = await previewThenConfirm(this.ui, this.api.saveDraft(params), {
        title: 'Save private draft?',
        confirm: 'Save draft',
        note: 'Only you can see it.',
      });
      if (!ok) return null;
      // Same key on a retry after an error, so a lost response never creates a second draft.
      this.draftKey ??= newKey();
      await this.api.saveDraft(params, { key: this.draftKey });
      this.draftKey = null;
      this.store.setDraft(ctx.id, '');
      return 'Draft saved. Paste it into the form on the record page and submit it there yourself.';
    });
  }

  async discard(d: Draft): Promise<void> {
    await this.write(async () => {
      const ok = await previewThenConfirm(this.ui, this.api.discardDraft(d.id), {
        title: 'Discard draft?',
        confirm: 'Discard',
        danger: true,
      });
      if (!ok) return null;
      await this.api.discardDraft(d.id, true);
      return 'Draft discarded.';
    });
  }

  async copy(d: Draft): Promise<void> {
    try {
      await navigator.clipboard.writeText(d.body);
      this.ui.toast('Draft copied. Paste it into the form on the record page.');
    } catch {
      this.ui.toast('Copy failed. Select the text and copy it manually.');
    }
  }

  async requestReassessment(): Promise<void> {
    const ctx = this.context();
    if (this.ineligible() || this.busy()) return;
    await this.write(async () => {
      const reason = await previewThenConfirm(
        this.ui,
        this.api.requestReassessment({ reportId: ctx.id, reason: 'preview' }),
        {
          title: 'Request a new AI assessment?',
          confirm: 'Queue reassessment',
          note: 'It does not approve, route or review anything.',
          input: {
            label: 'Reason',
            required: true,
            minLength: 3,
            maxLength: 1000,
            hint: 'Why the current assessment should be redone',
          },
        },
      );
      if (typeof reason !== 'string') return null;
      this.jobKey ??= newKey();
      await this.api.requestReassessment({ reportId: ctx.id, reason }, { key: this.jobKey });
      this.jobKey = null;
      return 'Reassessment queued. The current assessment stays reviewable until the new one is ready.';
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.write(async () => {
      const ok = await previewThenConfirm(this.ui, this.api.cancelReassessment(jobId), {
        title: 'Cancel reassessment?',
        confirm: 'Cancel reassessment',
        danger: true,
      });
      if (!ok) return null;
      await this.api.cancelReassessment(jobId, true);
      return 'Reassessment cancelled. The current assessment was not changed.';
    });
  }

  reload(): void {
    this.load(this.context());
  }

  /** Runs one confirmed write; reloads afterwards, success or not (a 409 often means the state moved). */
  private async write(fn: () => Promise<string | null>): Promise<void> {
    const run = this.run;
    this.busy.set(true);
    this.problem.set(null);
    this.done.set(null);
    try {
      const msg = await fn();
      if (run !== this.run || msg === null) return;
      this.done.set(msg);
      this.reload();
    } catch (e) {
      if (run !== this.run) return;
      this.problem.set(explain(e));
      this.reload();
    } finally {
      if (run === this.run) this.busy.set(false);
    }
  }

  private load(ctx: RecordContext): void {
    const run = ++this.run;
    this.stopPolling();
    this.busy.set(false);
    this.fact.set(null);
    this.factError.set(null);
    this.drafts.set([]);
    this.history.set(null);
    this.api.record(ctx.type, ctx.id).then(
      (f) => run === this.run && this.fact.set(f),
      (e) => run === this.run && this.factError.set(explain(e)),
    );
    if (this.canDraft()) {
      this.api.drafts(ctx.id).then(
        (d) => run === this.run && this.drafts.set(d),
        () => undefined,
      );
    }
    if (ctx.type === 'report' && this.store.canReassess()) this.loadHistory(ctx, run);
  }

  private loadHistory(ctx: RecordContext, run: number): void {
    this.api.reassessments(ctx.id).then(
      (h) => {
        if (run !== this.run) return;
        this.history.set(h);
        if (h.jobs.some((j) => ACTIVE_JOB.includes(j.status))) {
          this.timer = setTimeout(
            () => run === this.run && this.loadHistory(ctx, run),
            JOB_POLL_MS,
          );
        }
      },
      (e) => run === this.run && this.problem.set(explain(e)),
    );
  }

  private stopPolling(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
