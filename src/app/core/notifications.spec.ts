import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { load } from './load';
import { Notifications } from './notifications';

describe('Notifications', () => {
  let inbox: Notifications;
  let http: HttpTestingController;
  const n = (id: string, isRead = false) => ({ id, isRead, title: id }) as never;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    inbox = TestBed.inject(Notifications);
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
