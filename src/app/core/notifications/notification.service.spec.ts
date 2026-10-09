import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import { of, throwError } from 'rxjs';
import { load } from '../utils/load';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let inbox: NotificationService;
  let http: HttpTestingController;
  const n = (id: string, isRead = false) => ({ id, isRead, title: id }) as never;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    inbox = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  it('counts unread and marks one read via the API', async () => {
    const loading = inbox.load();
    http.expectOne('/api/notifications').flush({ items: [n('a'), n('b', true)] });
    await loading;
    expect(inbox.unread()).toBe(1);

    const marking = inbox.markRead(inbox.items()[0]);
    http.expectOne({ method: 'POST', url: '/api/notifications/a/read' }).flush({ id: 'a', isRead: true });
    await marking;
    expect(inbox.unread()).toBe(0);
  });

  it('does not call the API for an already-read item', async () => {
    await inbox.markRead(n('x', true));
    http.expectNone('/api/notifications/x/read');
  });

  describe('polling fallback', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    async function startWithRealtime(enabled: boolean) {
      const p = inbox.start();
      http.expectOne('/api/notifications').flush({ items: [] });
      await vi.advanceTimersByTimeAsync(0);
      http.expectOne('/api/realtime/config').flush({ enabled, key: null, cluster: null, userChannel: 'private-user-u' });
      await p;
    }

    it('keeps polling when realtime is unavailable', async () => {
      await startWithRealtime(false);
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      http.expectOne('/api/notifications').flush({ items: [] });
    });

    it('keeps polling when the realtime config request fails', async () => {
      const p = inbox.start();
      http.expectOne('/api/notifications').flush({ items: [] });
      await vi.advanceTimersByTimeAsync(0);
      http.expectOne('/api/realtime/config').flush(null, { status: 503, statusText: 'x' });
      await p;
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      http.expectOne('/api/notifications').flush({ items: [] });
    });

    it('skips polling only while realtime is actually connected', async () => {
      await startWithRealtime(false);
      inbox.live.set(true);
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      http.expectNone('/api/notifications');
      inbox.live.set(false);
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      http.expectOne('/api/notifications').flush({ items: [] });
    });
  });

  it('marks all read', async () => {
    inbox.items.set([n('a'), n('b')]);
    const p = inbox.markAllRead();
    http.expectOne({ method: 'POST', url: '/api/notifications/read-all' }).flush({ updated: 2 });
    await p;
    expect(inbox.unread()).toBe(0);
  });
});

describe('load()', () => {
  it('exposes value, then a safe error message on failure', async () => {
    TestBed.configureTestingModule({});
    let fail = false;
    const data = TestBed.runInInjectionContext(() => load(() => (fail ? throwError(() => new Error('boom')) : of(42))));
    await data.reload();
    expect(data.value()).toBe(42);
    expect(data.loading()).toBe(false);

    fail = true;
    await data.reload();
    expect(data.error()).toBeTruthy();
    expect(data.value()).toBe(42);
  });
});
