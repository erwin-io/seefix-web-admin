import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { ApiService } from '../http/api.service';
import { authInterceptor, revalidateInterceptor, sessionEndInterceptor } from '../http/interceptors';
import { DatasetDef, DatasetStore } from './dataset.store';

interface Row {
  id: string;
}

@Component({ template: '' })
class BlankPage {}

const rows = (n: number, from = 0): Row[] => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));
const REPORTS: DatasetDef<Row> = { key: 'reports', path: '/api/maintenance/reports', idOf: (r) => r.id, domains: ['reports'] };
const USERS: DatasetDef<Row> = { key: 'users', path: '/api/admin/users', idOf: (r) => r.id, domains: ['users'] };
const settle = () => new Promise((r) => setTimeout(r));

describe('DatasetStore', () => {
  let http: HttpTestingController;
  let store: DatasetStore;
  let session: SessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankPage }]),
        provideHttpClient(withInterceptors([authInterceptor, sessionEndInterceptor, revalidateInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(DatasetStore);
    session = TestBed.inject(SessionService);
    session.token.set('jwt-1');
    session.user.set({ id: 'u1', role: 'ADMIN' } as never);
  });

  const pending = (path: string) => http.match((r) => r.url === path);
  const page = (req: TestRequest, items: Row[], hasMore: boolean, versions = 'reports:1') =>
    req.flush({ items, page: Number(req.request.params.get('page')), pageSize: 500, hasMore }, { headers: { 'X-Data-Versions': versions } });

  /** Answers every page request of `data` until the load settles. */
  async function serve(path: string, data: Row[]) {
    for (let i = 0; i < 50; i++) {
      await settle();
      const reqs = pending(path);
      if (!reqs.length) return;
      for (const req of reqs) {
        const p = Number(req.request.params.get('page'));
        page(req, data.slice((p - 1) * 500, p * 500), data.length > p * 500);
      }
    }
  }

  it('current production API shape: legacy { items } without headers is one complete page', async () => {
    const set = store.get(REPORTS);
    const done = set.ensure();
    http.expectOne((r) => r.url === REPORTS.path).flush({ items: rows(200) }); // no page/pageSize/hasMore, no X-Data-Versions
    await done;
    await settle();
    http.expectNone((r) => r.url === REPORTS.path); // no second page request
    expect(set.rows().length).toBe(200);
    expect(set.error()).toBeNull();
    expect(set.partial()).toBe(false);
    expect(set.loading()).toBe(false);
  });

  it('fetches every page with ?page&pageSize=500, then serves later views from memory', async () => {
    const set = store.get(REPORTS);
    const done = set.ensure();
    const first = http.expectOne((r) => r.url === REPORTS.path);
    expect(first.request.params.get('page')).toBe('1');
    expect(first.request.params.get('pageSize')).toBe('500');
    expect(first.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    page(first, rows(500), true);
    await serve(REPORTS.path, rows(1234));
    await done;
    expect(set.rows().length).toBe(1234);
    expect(set.loading()).toBe(false);

    await set.ensure();
    await settle();
    http.expectNone((r) => r.url === REPORTS.path); // zero list calls on the next view
  });

  it('logout mid-load cancels the pages in flight and never stores them for the next user', async () => {
    const set = store.get(REPORTS);
    void set.ensure();
    page(http.expectOne((r) => r.url === REPORTS.path), rows(500), true);
    await settle();
    const inFlight = pending(REPORTS.path);
    expect(inFlight.length).toBeGreaterThan(0);

    session.end();
    expect(inFlight.every((r) => r.cancelled)).toBe(true);
    const next = store.get(REPORTS);
    expect(next).not.toBe(set);
    expect(next.rows()).toEqual([]);
  });

  it('account switch clears the previous user’s datasets', async () => {
    const set = store.get(USERS);
    void set.ensure();
    http.expectOne((r) => r.url === USERS.path).flush({ items: rows(3), page: 1, pageSize: 500, hasMore: false });
    await settle();
    expect(set.rows().length).toBe(3);

    const login = session.login('other', 'pw');
    http.expectOne('/api/auth/login').flush({ user: { id: 'u2', role: 'ADMIN' }, accessToken: 'jwt-2' });
    await login;
    expect(store.get(USERS)).not.toBe(set);
  });

  it('cancels an unfinished load when the last page using it is destroyed (navigation)', async () => {
    let destroy = () => {};
    const ref = { onDestroy: (fn: () => void) => (destroy = fn) } as unknown as DestroyRef;
    const set = store.get(REPORTS);
    set.attach(ref);
    void set.ensure();
    page(http.expectOne((r) => r.url === REPORTS.path), rows(500), true);
    await settle();
    const inFlight = pending(REPORTS.path);
    destroy();
    expect(inFlight.every((r) => r.cancelled)).toBe(true);

    void set.ensure(); // the next view starts over
    expect(pending(REPORTS.path).length).toBe(1);
  });

  it('own writes revalidate the lists; notification/auth writes do not', async () => {
    const api = TestBed.inject(ApiService);
    const set = store.get(REPORTS);
    void set.ensure();
    await serve(REPORTS.path, rows(2));

    const read = firstValueFrom(api.post('/api/notifications/n1/read'));
    http.expectOne('/api/notifications/n1/read').flush({});
    await read;
    await set.ensure();
    http.expectNone((r) => r.url === REPORTS.path);

    const start = firstValueFrom(api.post('/api/work-orders/w1/start'));
    http.expectOne('/api/work-orders/w1/start').flush({});
    await start;
    void set.ensure();
    expect(pending(REPORTS.path).length).toBe(1);
  });

  it('invalidate(domains) only touches datasets watching those domains (hook for #18)', async () => {
    const reports = store.get(REPORTS);
    const users = store.get(USERS);
    void reports.ensure();
    void users.ensure();
    await serve(REPORTS.path, rows(1));
    await serve(USERS.path, rows(1));

    store.invalidate(['users']);
    void reports.ensure();
    void users.ensure();
    expect(pending(REPORTS.path).length).toBe(0);
    expect(pending(USERS.path).length).toBe(1);
  });

  it('a partial failure keeps the loaded rows, flags them and retries on refresh', async () => {
    const set = store.get(REPORTS);
    const done = set.ensure();
    page(http.expectOne((r) => r.url === REPORTS.path), rows(500), true);
    await settle();
    for (const req of pending(REPORTS.path)) req.flush({ error: { code: 'NOPE', message: 'Not allowed.' } }, { status: 403, statusText: 'Forbidden' });
    await done;
    expect(set.partial()).toBe(true);
    expect(set.rows().length).toBe(500);
    expect(set.error()).toContain('Only 500 rows loaded');

    void set.refresh();
    await serve(REPORTS.path, rows(600));
    expect(set.partial()).toBe(false);
    expect(set.error()).toBeNull();
    expect(set.rows().length).toBe(600);
  });
});
