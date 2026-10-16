import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { UiService } from '@app/shared/services/ui.service';
import { AssistantLauncherComponent } from './assistant-launcher.component';
import { AssistantRecordComponent } from './assistant-record.component';
import { AssistantRemindersComponent } from './assistant-reminders.component';
import { ReassessmentHistory, RecordFact, ToolCatalog } from './assistant.model';
import { AssistantStore } from './assistant.store';

const ID = '11111111-2222-4333-8444-555555555555';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ALL_ACTIONS = [
  'save_draft',
  'discard_draft',
  'create_reminder',
  'cancel_reminder',
  'request_reassessment',
  'cancel_reassessment',
];
const catalog = (role: string, allowed = ALL_ACTIONS): ToolCatalog => ({
  role,
  tools: ['summary', 'action-queue', 'trends', 'records', 'navigation'],
  actions: {
    allowed,
    prohibited: [
      'review_report',
      'approve_routing',
      'complete_work_order',
      'rework_work_order',
      'submit_procurement_handoff',
    ],
  },
  navigation: [{ path: '/dashboard', label: 'Dashboard' }],
});
const reportFact = (status = 'PENDING_REVIEW', agentStatus = 'COMPLETED'): RecordFact => ({
  id: `report:${ID}`,
  kind: 'report',
  label: 'RPT-0001 Electrical',
  navigation: `/reports/${ID}`,
  data: { status, agentStatus },
});
const history = (
  jobs: Partial<ReassessmentHistory['jobs'][number]>[] = [],
): ReassessmentHistory => ({
  reportId: ID,
  jobs: jobs.map((j, i) => ({
    id: `job-${i}`,
    reportId: ID,
    status: 'COMPLETED',
    reason: 'r',
    requestedBy: 'u1',
    attemptCount: 1,
    baseAgentAttempt: 1,
    createdAt: '2026-10-16T01:00:00Z',
    claimedAt: null,
    finishedAt: null,
    ...j,
  })),
  assessments: [
    {
      attempt: 1,
      scopeDecision: 'IN_SCOPE',
      category: 'ELECTRICAL',
      urgency: 'HIGH',
      priorityScore: 80,
      createdAt: '2026-10-15T01:00:00Z',
    },
  ],
});
/** Words that would mean a workflow decision. No control in the assistant may carry them. */
const APPROVAL = /approv|authori[sz]|complet|rework|procure|\broute|assign|submit/i;

describe('Assistant UI', () => {
  let http: HttpTestingController;
  let session: SessionService;
  let store: AssistantStore;
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    confirm = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: UiService, useValue: { confirm, toast: vi.fn(), error: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.token.set('jwt');
    session.user.set({ id: 'u1', role: 'MAINTENANCE_STAFF', fullName: 'Staff' } as never);
    store = TestBed.inject(AssistantStore);
  });
  afterEach(() => http.verify());

  const flush = () => new Promise((r) => setTimeout(r));
  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await flush();
    fixture.detectChanges();
  }
  const buttons = (el: HTMLElement) =>
    [...el.querySelectorAll('button')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
  const preview = (req: TestRequest, action: string) =>
    req.flush({ status: 'CONFIRMATION_REQUIRED', action, preview: `Preview of ${action}.` });
  const one = (url: string, method = 'GET') =>
    http.expectOne((r) => r.url === url && r.method === method);

  describe('record tab: drafts and reassessment', () => {
    async function open(
      fact: RecordFact | null,
      hist: ReassessmentHistory,
      role = 'MAINTENANCE_STAFF',
    ) {
      store.catalog.set(catalog(role));
      store.availability.set('ready');
      const fixture = TestBed.createComponent(AssistantRecordComponent);
      fixture.componentRef.setInput('context', { type: 'report', id: ID });
      fixture.detectChanges();
      serve(fact, hist);
      await settle(fixture);
      return fixture;
    }
    function serve(fact: RecordFact | null, hist: ReassessmentHistory) {
      const rec = one(`/api/assistant/tools/records/report/${ID}`);
      if (fact) rec.flush({ fact });
      else
        rec.flush(
          { error: { code: 'FORBIDDEN', message: 'You do not have access to this report.' } },
          { status: 403, statusText: 'F' },
        );
      one('/api/assistant/drafts').flush({ items: [] });
      one('/api/assistant/reassessments').flush(hist);
    }

    it('saves a draft only after the human confirms the API preview, with an idempotency key', async () => {
      const fixture = await open(reportFact(), history());
      const comp = fixture.componentInstance;
      comp.setDraft('Check the breaker panel first.');

      confirm.mockResolvedValueOnce(false);
      let save = comp.saveDraft();
      const first = one('/api/assistant/drafts', 'POST');
      expect(first.request.body).toEqual({
        kind: 'REVIEW_NOTE',
        entityId: ID,
        body: 'Check the breaker panel first.',
      });
      preview(first, 'save_draft');
      await save;
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save private draft?',
          message: expect.stringContaining('Preview of save_draft.'),
        }),
      );
      // Cancelled: nothing else was sent (verify() in afterEach).

      confirm.mockResolvedValueOnce(true);
      save = comp.saveDraft();
      preview(one('/api/assistant/drafts', 'POST'), 'save_draft');
      await flush();
      const commit = one('/api/assistant/drafts', 'POST');
      expect(commit.request.body).toMatchObject({
        confirm: true,
        kind: 'REVIEW_NOTE',
        idempotencyKey: expect.stringMatching(UUID),
      });
      commit.flush(
        { status: 'DONE', action: 'save_draft', draft: { id: 'd1' } },
        { status: 201, statusText: 'Created' },
      );
      await save;
      serve(reportFact(), history());
      await settle(fixture);
      expect(comp.done()).toContain('submit it there yourself');
      expect(comp.draftText()).toBe('');
    });

    it('queues a reassessment only after explicit confirmation with a reason, and explains a 409', async () => {
      const fixture = await open(reportFact(), history());
      const el: HTMLElement = fixture.nativeElement;
      const btn = [...el.querySelectorAll('button')].find((b) =>
        b.textContent!.includes('Request new AI assessment'),
      )!;
      expect(btn).toBeTruthy();

      confirm.mockResolvedValueOnce('Category looks wrong');
      btn.click();
      const pre = one('/api/assistant/reassessments', 'POST');
      expect(pre.request.body.confirm).toBeUndefined();
      preview(pre, 'request_reassessment');
      await flush();
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ required: true, minLength: 3 }),
        }),
      );
      const commit = one('/api/assistant/reassessments', 'POST');
      expect(commit.request.body).toEqual({
        reportId: ID,
        reason: 'Category looks wrong',
        confirm: true,
        idempotencyKey: expect.stringMatching(UUID),
      });
      commit.flush(
        { error: { code: 'HUMAN_DECISION_EXISTS', message: 'x' } },
        { status: 409, statusText: 'Conflict' },
      );
      await flush();
      serve(reportFact(), history());
      await settle(fixture);
      expect(el.querySelector('[role="alert"]')!.textContent).toContain(
        'already recorded a review decision',
      );
    });

    it('does not ask the API when the human cancels the reassessment dialog', async () => {
      const fixture = await open(reportFact(), history());
      confirm.mockResolvedValueOnce(false);
      const run = fixture.componentInstance.requestReassessment();
      preview(one('/api/assistant/reassessments', 'POST'), 'request_reassessment');
      await run;
      expect(fixture.componentInstance.problem()).toBeNull();
    });

    it('explains why an ineligible report cannot be reassessed and offers no button', async () => {
      const fixture = await open(reportFact('ROUTED'), history());
      const el: HTMLElement = fixture.nativeElement;
      expect(buttons(el).some((b) => b.includes('Request new AI assessment'))).toBe(false);
      expect(el.textContent).toContain(
        'This report is routed. Only reports waiting for Maintenance Review can be reassessed.',
      );
    });

    it('shows processing state, attempt history and a cancel control for a running job', async () => {
      const fixture = await open(
        reportFact(),
        history([{ status: 'PROCESSING', attemptCount: 2 }, { status: 'SUPERSEDED' }]),
      );
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Processing');
      expect(el.textContent).toContain('current one stays reviewable');
      expect(el.textContent).toContain('Human decisions always win');
      expect(el.textContent).toContain('Attempt 1');
      expect(buttons(el)).toContain('Cancel…');
      expect(buttons(el).some((b) => b.includes('Request new AI assessment'))).toBe(false);
      fixture.destroy(); // clears the job poll; a leaked timer would send an unexpected request (verify())
    });

    it('a worker gets neither review-note drafts nor reassessment on a report', async () => {
      session.user.set({ id: 'u1', role: 'WORKER' } as never);
      store.catalog.set(
        catalog('WORKER', ['save_draft', 'discard_draft', 'create_reminder', 'cancel_reminder']),
      );
      const fixture = TestBed.createComponent(AssistantRecordComponent);
      fixture.componentRef.setInput('context', { type: 'report', id: ID });
      fixture.detectChanges();
      one(`/api/assistant/tools/records/report/${ID}`).flush(
        { error: { code: 'FORBIDDEN', message: 'No access.' } },
        { status: 403, statusText: 'F' },
      );
      await settle(fixture);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('No access.');
      expect(el.textContent).not.toContain('AI reassessment');
      expect(el.querySelector('#sf-draft-text')).toBeNull();
    });

    it('renders no approval, routing, completion, rework or procurement control', async () => {
      const fixture = await open(
        reportFact(),
        history([{ status: 'FAILED' }, { status: 'CANCELLED' }]),
      );
      const labels = buttons(fixture.nativeElement);
      expect(labels.length).toBeGreaterThan(1);
      for (const label of labels) expect(label).not.toMatch(APPROVAL);
    });
  });

  describe('reminders tab', () => {
    async function open() {
      const fixture = TestBed.createComponent(AssistantRemindersComponent);
      one('/api/assistant/reminders').flush({
        items: [
          {
            id: 'r1',
            title: 'Call vendor',
            message: null,
            dueAt: '2026-10-20T01:00:00Z',
            timeZone: 'Asia/Manila',
            status: 'SCHEDULED',
          },
          {
            id: 'r2',
            title: 'Old one',
            message: null,
            dueAt: '2026-10-10T01:00:00Z',
            timeZone: 'Asia/Manila',
            status: 'SENT',
          },
        ],
      });
      await settle(fixture);
      return fixture;
    }

    it('lists reminders in their own time zone and only offers cancel while not sent', async () => {
      const fixture = await open();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Call vendor');
      expect(el.textContent).toMatch(/GMT\+8|PHT|PST/);
      expect(buttons(el).filter((b) => b === 'Cancel…')).toHaveLength(1);
    });

    it('creates a reminder only after confirming the preview, with the local time and zone', async () => {
      const fixture = await open();
      const comp = fixture.componentInstance;
      comp.form.setValue({
        title: 'Follow up',
        message: '',
        dueAt: '2099-01-02T09:30',
        attach: true,
      });

      confirm.mockResolvedValueOnce(false);
      let run = comp.create();
      const pre = one('/api/assistant/reminders', 'POST');
      expect(pre.request.body).toEqual({
        title: 'Follow up',
        dueAt: '2099-01-02T09:30',
        timeZone: comp.timeZone,
      });
      preview(pre, 'create_reminder');
      await run;

      confirm.mockResolvedValueOnce(true);
      run = comp.create();
      preview(one('/api/assistant/reminders', 'POST'), 'create_reminder');
      await flush();
      const commit = one('/api/assistant/reminders', 'POST');
      expect(commit.request.body).toMatchObject({
        confirm: true,
        idempotencyKey: expect.stringMatching(UUID),
        timeZone: comp.timeZone,
      });
      commit.flush(
        { status: 'DONE', action: 'create_reminder', reminder: { id: 'r3' } },
        { status: 201, statusText: 'Created' },
      );
      await run;
      const reload = one('/api/assistant/reminders');
      expect(reload.request.params.get('scope')).toBe('created');
      reload.flush({ items: [] });
    });

    it('rejects a past time without calling the API, and explains a 409 on cancel', async () => {
      const fixture = await open();
      const comp = fixture.componentInstance;
      comp.form.setValue({
        title: 'Too late',
        message: '',
        dueAt: '2001-01-01T09:00',
        attach: true,
      });
      await comp.create();
      expect(comp.problem()).toBe('Pick a time in the future.');

      confirm.mockResolvedValueOnce(true);
      const run = comp.cancel({ id: 'r1' } as never);
      preview(one('/api/assistant/reminders/r1/cancel', 'POST'), 'cancel_reminder');
      await flush();
      const commit = one('/api/assistant/reminders/r1/cancel', 'POST');
      expect(commit.request.body).toEqual({ confirm: true });
      commit.flush(
        { error: { code: 'REMINDER_ALREADY_SENT', message: 'x' } },
        { status: 409, statusText: 'Conflict' },
      );
      await run;
      expect(comp.problem()).toContain('already sent');
    });
  });

  describe('launcher and panel', () => {
    async function mount() {
      const fixture = TestBed.createComponent(AssistantLauncherComponent);
      fixture.detectChanges();
      one('/api/assistant/tools').flush(catalog('MAINTENANCE_STAFF'));
      await flush();
      one('/api/assistant/tools/action-queue').flush({
        items: [
          {
            entityType: 'REPORT',
            entityId: ID,
            action: 'PENDING_REVIEW',
            reference: 'RPT-1',
            summary: 'Leak',
            priority: 5,
            since: null,
            route: `/reports/${ID}`,
          },
        ],
      });
      await settle(fixture);
      return fixture;
    }
    const fab = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button.fab');

    it('is hidden when the API has no assistant for this account', async () => {
      const fixture = TestBed.createComponent(AssistantLauncherComponent);
      fixture.detectChanges();
      one('/api/assistant/tools').flush(
        { error: { code: 'FORBIDDEN', message: 'x' } },
        { status: 403, statusText: 'F' },
      );
      await settle(fixture);
      expect(fab(fixture.nativeElement)).toBeNull();
    });

    it('opens an accessible dialog, minimizes on Escape and returns focus, keeping the chat', async () => {
      const fixture = await mount();
      const el: HTMLElement = fixture.nativeElement;
      expect(fab(el)!.getAttribute('aria-label')).toBe('Open SEEFIX Assistant, 1 queue hint');

      fab(el)!.click();
      await settle(fixture);
      const dialog = el.querySelector('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-labelledby')).toBe('sf-assistant-title');
      expect(el.querySelector('[role="log"]')).toBeTruthy();
      expect(document.activeElement?.id).toBe('sf-assistant-q');
      expect(el.textContent).toContain('hint only');

      store.send('What needs my attention?');
      await settle(fixture);
      expect(el.querySelector('.msg.bot')!.getAttribute('aria-busy')).toBe('true');
      expect(el.textContent).toContain('Thinking…');
      one('/api/assistant/ask', 'POST').flush({
        status: 'FALLBACK',
        answer: 'RPT-1 waits for review.',
        citedFactIds: [`report:${ID}`],
        navigation: [{ factId: `report:${ID}`, path: `/reports/${ID}`, label: 'RPT-1' }],
      });
      await settle(fixture);
      expect(el.textContent).toContain('The AI model was unavailable');
      expect(buttons(el)).toContain('open_in_newRPT-1');
      for (const label of buttons(el)) expect(label).not.toMatch(APPROVAL);

      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle(fixture);
      expect(el.querySelector('[role="dialog"]')).toBeNull();
      const restore = el.querySelector('[role="region"] button') as HTMLElement;
      expect(document.activeElement).toBe(restore);

      restore.click();
      await settle(fixture);
      expect(el.textContent).toContain('RPT-1 waits for review.');
      (el.querySelector('button[aria-label="Close assistant"]') as HTMLElement).click();
      await settle(fixture);
      expect(document.activeElement).toBe(fab(el));
      expect(store.messages()).toHaveLength(2);
    });

    it('disappears and forgets the chat on sign-out', async () => {
      const fixture = await mount();
      store.open();
      store.messages.set([{ id: 1, role: 'user', text: 'private question', status: 'done' }]);
      session.end();
      await settle(fixture);
      expect(fab(fixture.nativeElement)).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('private question');
      expect(store.messages()).toEqual([]);
    });
  });
});
