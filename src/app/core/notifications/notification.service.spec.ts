import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import { of, throwError } from 'rxjs';
import { SessionService } from '../auth/session.service';
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

  describe('Pusher lifecycle (mocked client)', () => {
    type Handler = (data?: unknown) => void;
    // Minimal stand-in for pusher-js: records handlers so tests can emit lifecycle events.
    class FakePusher {
      readonly handlers = new Map<string, Handler[]>();
      readonly channel = { name: '', subscribed: false, bind: (e: string, cb: Handler) => this.on(`ch:${e}`, cb) };
      readonly connection = { state: 'connecting', bind: (e: string, cb: Handler) => this.on(`conn:${e}`, cb) };
      disconnected = false;
      constructor(readonly key: string, readonly options: { channelAuthorization: { endpoint: string; headersProvider: () => Record<string, string> } }) {}
      on(e: string, cb: Handler) { this.handlers.set(e, [...(this.handlers.get(e) ?? []), cb]); }
      emit(e: string, data?: unknown) { this.handlers.get(e)?.forEach((cb) => cb(data)); }
      subscribe(name: string) { this.channel.name = name; return this.channel; }
      disconnect() { this.disconnected = true; }
      // Simulated server-side transitions.
      connected() { this.connection.state = 'connected'; this.emit('conn:state_change', { current: 'connected' }); }
      dropped() { this.connection.state = 'unavailable'; this.emit('conn:state_change', { current: 'unavailable' }); }
      authorized() { this.channel.subscribed = true; this.emit('ch:pusher:subscription_succeeded'); }
      rejected(status = 403) { this.channel.subscribed = false; this.emit('ch:pusher:subscription_error', { type: 'AuthError', status }); }
    }

    let fake: FakePusher;
    const list = () => http.expectOne('/api/notifications').flush({ items: [] });

    beforeEach(async () => {
      vi.useFakeTimers();
      const saved = environment.realtime;
      environment.realtime = true;
      onTestFinished(() => void (environment.realtime = saved));
      TestBed.inject(SessionService).token.set('tok-1');
      const seam = inbox as unknown as { createPusher: (key: string, options: FakePusher['options']) => Promise<unknown> };
      vi.spyOn(seam, 'createPusher').mockImplementation(async (key, options) => (fake = new FakePusher(key, options)));
      const p = inbox.start();
      list();
      await vi.advanceTimersByTimeAsync(0);
      http.expectOne('/api/realtime/config').flush({ enabled: true, key: 'k', cluster: 'ap1', userChannel: 'private-user-u' });
      await p;
    });
    afterEach(() => vi.useRealTimers());

    it('subscribes to the private user channel and authorizes with the current session token', () => {
      expect(fake.key).toBe('k');
      expect(fake.channel.name).toBe('private-user-u');
      expect(fake.options.channelAuthorization.endpoint).toBe('/api/realtime/auth');
      expect(fake.options.channelAuthorization.headersProvider()).toEqual({ Authorization: 'Bearer tok-1' });
    });

    it('goes live only after subscription_succeeded on a connected socket, then pauses polling', async () => {
      fake.connected();
      expect(inbox.live()).toBe(false); // connected but not yet authorized
      fake.authorized();
      expect(inbox.live()).toBe(true);
      list(); // catch-up read on going live
      await vi.advanceTimersByTimeAsync(environment.pollMs * 2);
      http.expectNone('/api/notifications');
    });

    it('refetches the list when notification.created arrives', () => {
      fake.connected();
      fake.authorized();
      list();
      fake.emit('ch:notification.created', { notificationId: 'n1', eventId: 'e1' });
      list();
    });

    it('stays on polling when channel authorization is rejected', async () => {
      fake.connected();
      fake.rejected(403);
      expect(inbox.live()).toBe(false);
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      list();
    });

    it('falls back to polling on disconnect and recovers missed notifications on reconnect', async () => {
      fake.connected();
      fake.authorized();
      list();
      fake.dropped();
      expect(inbox.live()).toBe(false);
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      list(); // polling resumed while offline
      fake.connected(); // pusher-js re-subscribes; channel still authorized
      expect(inbox.live()).toBe(true);
      list(); // missed-notification recovery read
      await vi.advanceTimersByTimeAsync(environment.pollMs);
      http.expectNone('/api/notifications');
    });

    it('disconnects and clears the inbox when the session ends', () => {
      fake.connected();
      fake.authorized();
      list();
      TestBed.inject(SessionService).end();
      expect(fake.disconnected).toBe(true);
      expect(inbox.live()).toBe(false);
      expect(inbox.items()).toEqual([]);
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
