import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { DatasetStore } from '@app/core/data/dataset.store';
import {
  authInterceptor,
  revalidateInterceptor,
  sessionEndInterceptor,
} from '@app/core/http/interceptors';
import { AskResponse, ToolCatalog } from './assistant.model';
import { AssistantStore, MAX_PENDING, recordContextOf } from './assistant.store';

const REPORT_ID = '11111111-2222-4333-8444-555555555555';
const CATALOG: ToolCatalog = {
  role: 'MAINTENANCE_STAFF',
  tools: ['summary', 'action-queue', 'trends', 'records', 'navigation'],
  actions: {
    allowed: [
      'save_draft',
      'discard_draft',
      'create_reminder',
      'cancel_reminder',
      'request_reassessment',
      'cancel_reassessment',
    ],
    prohibited: [
      'review_report',
      'approve_routing',
      'complete_work_order',
      'rework_work_order',
      'submit_procurement_handoff',
    ],
  },
  navigation: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/maintenance/action-center', label: 'Action Center' },
  ],
};
const answer = (text: string, extra: Partial<AskResponse> = {}): AskResponse => ({
  status: 'ANSWERED',
  answer: text,
  citedFactIds: [],
  navigation: [],
  ...extra,
});

describe('AssistantStore', () => {
  let http: HttpTestingController;
  let store: AssistantStore;
  let session: SessionService;
  let router: Router;
  let announce: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(
          withInterceptors([authInterceptor, sessionEndInterceptor, revalidateInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
    session.token.set('jwt-1');
    session.user.set({ id: 'u1', role: 'MAINTENANCE_STAFF' } as never);
    store = TestBed.inject(AssistantStore);
    await ready();
  });
  afterEach(() => http.verify());

  const flush = () => new Promise((r) => setTimeout(r));
  async function ready(catalog = CATALOG): Promise<void> {
    const init = store.init();
    http.expectOne('/api/assistant/tools').flush(catalog);
    await init;
    http.expectOne((r) => r.url === '/api/assistant/tools/action-queue').flush({ items: [] });
    await flush();
  }
  const asks = () => http.match('/api/assistant/ask');

  it('shows the launcher for an internal role once the API serves the catalog', () => {
    expect(store.visible()).toBe(true);
    expect(store.availability()).toBe('ready');
    expect(store.canReassess()).toBe(true);
  });

  it('hides the launcher when the API has no assistant (404) and offers retry on an outage', async () => {
    store.purge();
    let init = store.init();
    http
      .expectOne('/api/assistant/tools')
      .flush(
        { error: { code: 'ROUTE_NOT_FOUND', message: 'x' } },
        { status: 404, statusText: 'NF' },
      );
    await init;
    expect(store.visible()).toBe(false);

    store.purge();
    init = store.init();
    http.expectOne('/api/assistant/tools').error(new ProgressEvent('error'), { status: 0 });
    await init;
    expect(store.visible()).toBe(true);
    expect(store.availability()).toBe('error');
    expect(store.catalogError()).toContain('offline');
  });

  it('never shows the launcher to a reporter', () => {
    session.user.set({ id: 'u1', role: 'REPORTER' } as never);
    expect(store.visible()).toBe(false);
  });

  it('keeps the conversation through close, reopen, minimize and in-app navigation', async () => {
    store.open();
    expect(store.send('What needs my attention?')).toBe(true);
    asks()[0].flush(answer('Two reports wait for review.'));
    await flush();
    store.minimize();
    store.close();
    await router.navigateByUrl('/work-orders');
    store.open(); // hints are fresh (< TTL): no new request
    expect(store.view()).toBe('open');
    expect(store.messages().map((m) => m.text)).toEqual([
      'What needs my attention?',
      'Two reports wait for review.',
    ]);
    expect(announce).toHaveBeenCalledWith(
      'SEEFIX Assistant: Two reports wait for review.',
      'polite',
    );
  });

  it('purges everything on sign-out and drops a reply that arrives afterwards', async () => {
    store.open();
    store.send('Summarize my work');
    store.setDraft(REPORT_ID, 'secret draft');
    const pending = asks()[0];
    session.end('signed out');
    expect(store.messages()).toEqual([]);
    expect(store.view()).toBe('closed');
    expect(store.catalog()).toBeNull();
    expect(store.draftText()).toEqual({});
    pending.flush(answer('late answer for the previous user'));
    await flush();
    expect(store.messages()).toEqual([]);
  });

  it('purges when a different account appears in the same tab', async () => {
    store.send('hello');
    asks()[0].flush(answer('hi'));
    await flush();
    session.user.set({ id: 'u2', role: 'MAINTENANCE_STAFF' } as never);
    store.open();
    expect(store.messages()).toEqual([]);
    expect(store.catalog()).toBeNull();
    http.expectOne('/api/assistant/tools').flush(CATALOG);
    await flush();
    http.expectOne((r) => r.url === '/api/assistant/tools/action-queue').flush({ items: [] });
  });

  it('runs concurrent questions side by side and keeps each answer under its own question', async () => {
    store.send('first');
    store.send('second');
    const [a, b] = asks();
    expect(store.pending()).toBe(2);
    b.flush(answer('answer two'));
    await flush();
    a.flush(answer('answer one'));
    await flush();
    expect(store.messages().map((m) => m.text)).toEqual([
      'first',
      'answer one',
      'second',
      'answer two',
    ]);
  });

  it(`refuses more than ${MAX_PENDING} questions in flight`, () => {
    for (let i = 0; i < MAX_PENDING; i++) expect(store.send(`q${i}`)).toBe(true);
    expect(store.send('one too many')).toBe(false);
    asks().forEach((r) => r.flush(answer('ok')));
  });

  it('shows offline and server errors, then retries the same question', async () => {
    store.send('Is anything overdue?');
    asks()[0].error(new ProgressEvent('error'), { status: 0 });
    await flush();
    const failed = store.messages()[1];
    expect(failed.status).toBe('error');
    expect(failed.text).toContain('offline');
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringContaining('could not answer'),
      'polite',
    );

    store.retry(failed.id);
    const retry = asks()[0];
    expect(retry.request.body).toEqual({ question: 'Is anything overdue?' });
    retry.flush(
      { error: { code: 'RATE_LIMITED', message: 'Too many.' } },
      { status: 429, statusText: 'TMR' },
    );
    await flush();
    expect(store.messages()[1].text).toContain('wait a little');

    store.retry(failed.id);
    asks()[0].flush(answer('Nothing is overdue.'));
    await flush();
    expect(store.messages()[1]).toMatchObject({ status: 'done', text: 'Nothing is overdue.' });
    expect(store.messages()).toHaveLength(2);
  });

  it('sends the record on screen as context, and explains a 403 on a record the user cannot open', async () => {
    await router.navigateByUrl(`/reports/${REPORT_ID}`);
    expect(store.context()).toEqual({ type: 'report', id: REPORT_ID });
    store.send('Summarize this report');
    const req = asks()[0];
    expect(req.request.body).toEqual({
      question: 'Summarize this report',
      context: { type: 'report', id: REPORT_ID },
    });
    req.flush(
      { error: { code: 'FORBIDDEN', message: 'You do not have access to this report.' } },
      { status: 403, statusText: 'F' },
    );
    await flush();
    expect(store.messages()[1]).toMatchObject({
      status: 'error',
      text: 'You do not have access to this report.',
    });
    expect(session.token()).toBe('jwt-1'); // a 403 never signs out

    store.useContext.set(false);
    store.send('General question');
    expect(asks()[0].request.body).toEqual({ question: 'General question' });
  });

  it('keeps only navigation the API returned to web-admin pages the role may open', async () => {
    store.send('where?');
    asks()[0].flush(
      answer('See these.', {
        navigation: [
          { factId: `report:${REPORT_ID}`, path: `/reports/${REPORT_ID}`, label: 'RPT-1' },
          { factId: 'summary:current', path: '/dashboard', label: 'Dashboard' },
          { factId: 'x', path: '/admin/users', label: 'Users' }, // not in this role's navigation
          { factId: 'y', path: 'https://agent.internal:8000/api', label: 'Agent' },
          { factId: 'z', path: '//evil.example/x', label: 'Evil' },
        ],
      }),
    );
    await flush();
    expect(store.messages()[1].response?.navigation.map((n) => n.path)).toEqual([
      `/reports/${REPORT_ID}`,
      '/dashboard',
    ]);

    const nav = vi.spyOn(router, 'navigateByUrl');
    store.go('https://agent.internal:8000/api');
    store.go('/admin/users');
    expect(nav).not.toHaveBeenCalled();
    store.go('/dashboard');
    expect(nav).toHaveBeenCalledWith('/dashboard');
  });

  it('keeps proactive queue hints that point at allowed pages, and refreshes them on open after the TTL', async () => {
    vi.useFakeTimers({ now: Date.now() + 120_000, toFake: ['Date'] });
    store.open();
    http
      .expectOne((r) => r.url === '/api/assistant/tools/action-queue')
      .flush({
        items: [
          {
            entityType: 'REPORT',
            entityId: REPORT_ID,
            action: 'PENDING_REVIEW',
            reference: 'RPT-1',
            summary: null,
            priority: 9,
            since: null,
            route: `/reports/${REPORT_ID}`,
          },
          {
            entityType: 'X',
            entityId: 'x',
            action: 'X',
            reference: null,
            summary: null,
            priority: null,
            since: null,
            route: 'javascript:alert(1)',
          },
        ],
      });
    vi.useRealTimers();
    await flush();
    expect(store.hints().map((h) => h.reference)).toEqual(['RPT-1']);
  });

  it('assistant writes do not reload every cached list', () => {
    const invalidate = vi.spyOn(TestBed.inject(DatasetStore), 'invalidate');
    store.send('q');
    asks()[0].flush(answer('a'));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('recognizes record pages only', () => {
    expect(recordContextOf(`/work-orders/${REPORT_ID}?tab=1`)).toEqual({
      type: 'work_order',
      id: REPORT_ID,
    });
    expect(recordContextOf(`/procurement/handoffs/${REPORT_ID}`)).toEqual({
      type: 'handoff',
      id: REPORT_ID,
    });
    expect(recordContextOf('/maintenance/reports')).toBeNull();
    expect(recordContextOf('/reports/not-a-uuid')).toBeNull();
  });
});
