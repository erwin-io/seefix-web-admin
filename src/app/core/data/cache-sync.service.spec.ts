import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { ApiService } from '../http/api.service';
import { authInterceptor, revalidateInterceptor, sessionEndInterceptor } from '../http/interceptors';
import { NotificationService } from '../notifications/notification.service';
import { CacheSyncService, SYNC_DEBOUNCE_MS, SYNC_FALLBACK_MS, SYNC_LIVE_MS, SYNC_MAX_BACKOFF_MS, SYNC_POLL_MS } from './cache-sync.service';
import { Dataset, DatasetDef, DatasetStore } from './dataset.store';

interface Row {
  id: string;
}

const REPORTS: DatasetDef<Row> = { key: 'reports', path: '/api/maintenance/reports', idOf: (r) => r.id, domains: ['reports', 'reference'] };
const USERS: DatasetDef<Row> = { key: 'users', path: '/api/admin/users', idOf: (r) => r.id, domains: ['users'] };
const VERSIONS = '/api/sync/versions';

describe('CacheSyncService', () => {
  let http: HttpTestingController;
  let sync: CacheSyncService;
  let store: DatasetStore;
  let session: SessionService;
  let hint: () => void;
  const live = signal(false);
  /** Server state: current domain versions. */
  let server: Record<string, number>;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    live.set(false);
    server = { reports: 1, reference: 1, users: 1 };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor, sessionEndInterceptor, revalidateInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: { live, onDataChanged: (fn: () => void) => (hint = fn) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.token.set('jwt-1');
    session.user.set({ id: 'u1', role: 'ADMIN' } as never);
    store = TestBed.inject(DatasetStore);
    sync = TestBed.inject(CacheSyncService);
  });
  afterEach(() => vi.useRealTimers());

  const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);
  const stamp = (domains: string[]) => domains.map((d) => `${d}:${server[d]}`).join('|');
  const listCalls = (def: DatasetDef<Row>) => http.match((r) => r.url === def.path);
  /** Answers every pending list page (one page each) with the server's current stamp. */
  function serveLists(): number {
    let n = 0;
    for (const def of [REPORTS, USERS]) {
      for (const req of listCalls(def)) {
        req.flush({ items: [{ id: 'a' }], page: 1, pageSize: 500, hasMore: false }, { headers: { 'X-Data-Versions': stamp(def.domains) } });
        n++;
      }
    }
    return n;
  }
  const answerVersions = (body: object = { available: true, versions: { ...server } }) => http.expectOne(VERSIONS).flush(body);

  /** A list page on screen (attached) or a module the user left (hidden). */
  async function loaded(def: DatasetDef<Row>, onScreen: boolean): Promise<Dataset<Row>> {
    const set = store.get(def);
    if (onScreen) set.attach({ onDestroy: () => () => undefined } as unknown as DestroyRef);
    const done = set.ensure();
    await tick();
    serveLists();
    await done;
    return set;
  }

  /** Advances time until the scheduler sends the next versions check. */
  async function nextCheck() {
    for (let i = 0; i < 1000; i++) {
      const [req] = http.match(VERSIONS);
      if (req) return req;
      await tick(1000);
    }
    throw new Error('no versions check');
  }

  async function started() {
    sync.start();
    await tick(0);
    answerVersions();
    await tick(0);
  }

  it('healthy but silent socket: one versions check per 60 s and zero list calls while nothing changes', async () => {
    live.set(true);
    await loaded(REPORTS, true);
    await started();
    for (let i = 0; i < 5; i++) {
      await tick(SYNC_LIVE_MS - 1);
      http.expectNone(VERSIONS);
      await tick(1);
      answerVersions();
    }
    await tick();
    expect(listCalls(REPORTS)).toHaveLength(0);
  });

  it('publisher crash behind a live socket: another user’s write is still found by the poll and the visible list reloads once', async () => {
    live.set(true);
    const reports = await loaded(REPORTS, true);
    const users = await loaded(USERS, false);
    await started();
    server['reports'] = 7; // committed by another user / Agent; no data.changed arrives
    await tick(SYNC_LIVE_MS);
    answerVersions();
    await tick();
    expect(serveLists()).toBe(1); // Reports only; Users' domain did not move
    await tick();
    expect(reports.versions).toEqual({ reports: 7, reference: 1 });
    expect(users.settled).toBe(true);
  });

  it('disconnected socket polls every 30 s', async () => {
    await started();
    await tick(SYNC_POLL_MS);
    answerVersions();
    await tick(SYNC_POLL_MS);
    answerVersions();
  });

  it('other-user mutation via data.changed hint: visible list reloads now, hidden module only on entry', async () => {
    live.set(true);
    const users = await loaded(USERS, false);
    await loaded(REPORTS, true);
    await started();
    server['users'] = 5;
    server['reports'] = 5;
    hint();
    await tick(SYNC_DEBOUNCE_MS);
    answerVersions();
    await tick();
    expect(listCalls(REPORTS)).toHaveLength(1); // on screen: reloaded at once
    expect(listCalls(USERS)).toHaveLength(0); // hidden: lazy
    serveLists();
    expect(users.settled).toBe(false);
    const entry = users.ensure();
    await tick();
    expect(serveLists()).toBe(1);
    await entry;
  });

  it('rapid bursts of hints cost one check, plus one follow-up for hints that arrive while it is in flight', async () => {
    await loaded(REPORTS, true);
    await started();
    for (let i = 0; i < 50; i++) hint();
    await tick(SYNC_DEBOUNCE_MS);
    const req = http.expectOne(VERSIONS);
    for (let i = 0; i < 50; i++) hint(); // during the request
    server['reports'] = 2;
    req.flush({ available: true, versions: { reports: 1, reference: 1, users: 1 } });
    await tick(SYNC_DEBOUNCE_MS);
    answerVersions(); // the follow-up sees the change
    await tick();
    expect(serveLists()).toBe(1);
    await tick(SYNC_DEBOUNCE_MS * 10);
    http.expectNone(VERSIONS);
  });

  it('module entry and manual refresh ask for a check (debounced into one)', async () => {
    const reports = await loaded(REPORTS, true);
    await started();
    store.onActivity();
    void reports.reload();
    await tick();
    serveLists();
    await tick(SYNC_DEBOUNCE_MS);
    answerVersions();
    await tick(SYNC_DEBOUNCE_MS);
    http.expectNone(VERSIONS);
  });

  it('own mutation reloads at once; the next poll sees the new stamp and does not reload again', async () => {
    await loaded(REPORTS, true);
    await started();
    const api = TestBed.inject(ApiService);
    const write = firstValueFrom(api.post('/api/maintenance/reports/a/approve'));
    server['reports'] = 3;
    http.expectOne('/api/maintenance/reports/a/approve').flush({});
    await write;
    await tick();
    expect(serveLists()).toBe(1);
    await tick(SYNC_POLL_MS);
    answerVersions();
    await tick();
    expect(listCalls(REPORTS)).toHaveLength(0);
  });

  it('no infinite loop: a server that keeps answering an older stamp costs at most one reload per poll', async () => {
    await loaded(REPORTS, true);
    await started();
    server['reports'] = 9;
    let reloads = 0;
    for (let i = 0; i < 10; i++) {
      await tick(SYNC_POLL_MS);
      answerVersions({ available: true, versions: { ...server } });
      await tick();
      for (const req of listCalls(REPORTS)) {
        req.flush({ items: [], page: 1, pageSize: 500, hasMore: false }, { headers: { 'X-Data-Versions': 'reports:1|reference:1' } });
        reloads++;
      }
      await tick(1000);
      expect(listCalls(REPORTS)).toHaveLength(0);
    }
    expect(reloads).toBe(10);
  });

  it('available:false falls back to time-based refresh of lists older than the fallback window', async () => {
    await loaded(REPORTS, true);
    sync.start();
    await tick();
    answerVersions({ available: false, versions: {} });
    await tick();
    expect(sync.available()).toBe(false);
    let elapsed = 0;
    while (elapsed + SYNC_POLL_MS < SYNC_FALLBACK_MS) {
      await tick(SYNC_POLL_MS);
      elapsed += SYNC_POLL_MS;
      answerVersions({ available: false, versions: {} });
      await tick();
      expect(listCalls(REPORTS)).toHaveLength(0);
    }
    await tick(SYNC_POLL_MS);
    answerVersions({ available: false, versions: {} });
    await tick();
    expect(serveLists()).toBe(1);
  });

  it('database outage: keeps the rows, flags offline, backs off, and recovers', async () => {
    const reports = await loaded(REPORTS, true);
    await started();
    const delays: number[] = [];
    let last = Date.now();
    for (let i = 0; i < 6; i++) {
      const req = await nextCheck();
      delays.push(Date.now() - last);
      last = Date.now();
      req.flush({ error: { code: 'DATABASE_UNAVAILABLE' } }, { status: 503, statusText: 'x' });
      await tick();
    }
    expect(sync.offline()).toBe(true);
    expect(reports.rows()).toEqual([{ id: 'a' }]);
    expect(Math.max(...delays)).toBeLessThanOrEqual(SYNC_MAX_BACKOFF_MS);
    expect(delays[3]).toBeGreaterThan(delays[1]);
    (await nextCheck()).flush({ available: true, versions: { ...server } });
    await tick();
    expect(sync.offline()).toBe(false);
    expect(listCalls(REPORTS)).toHaveLength(0);
  });

  it('account switch race: the old user’s versions answer is dropped and nothing private survives', async () => {
    await loaded(REPORTS, true);
    sync.start();
    await tick();
    const old = http.expectOne(VERSIONS);
    session.end(); // logout while the check is in flight
    expect(store.get(REPORTS).rows()).toEqual([]);
    session.token.set('jwt-2');
    session.user.set({ id: 'u2', role: 'WORKER' } as never);
    sync.start();
    await tick();
    const fresh = http.expectOne(VERSIONS);
    expect(fresh.request.headers.get('Authorization')).toBe('Bearer jwt-2');
    old.flush({ available: true, versions: { reports: 99, users: 99 } });
    await tick();
    expect(sync.available()).toBe(null); // u1's answer did not land in u2's state
    fresh.flush({ available: true, versions: { work_orders: 1, reports: 1, reference: 1 } });
    await tick();
    expect(sync.available()).toBe(true);
    expect(listCalls(REPORTS)).toHaveLength(0);
  });

  it('after logout nothing polls', async () => {
    await started();
    session.end();
    await tick(SYNC_MAX_BACKOFF_MS * 2);
    http.expectNone(VERSIONS);
    hint();
    store.onActivity();
    await tick(SYNC_DEBOUNCE_MS * 2);
    http.expectNone(VERSIONS);
  });
});
