import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '../auth/session.service';
import { User } from '../models/user.model';
import { RECENT_MAX, RECENT_PREFIX, RecentSearchesService } from './recent-searches.service';
import { safeRoute, searchable } from './search.service';

const user = (id: string) => ({ id, role: 'ADMIN' }) as User;

describe('RecentSearchesService', () => {
  let session: SessionService;
  let recents: RecentSearchesService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(SessionService);
    session.token.set('jwt-a');
    session.user.set(user('a'));
    recents = TestBed.inject(RecentSearchesService);
  });

  /** Signs in as `id` through the real login path, which runs the account-switch reset. */
  async function login(id: string): Promise<void> {
    const p = session.login(`${id}@x.com`, 'pw');
    TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush({ user: user(id), accessToken: `jwt-${id}` });
    await p;
    TestBed.tick();
  }

  it('keeps distinct queries, last used first, capped at 15', () => {
    for (let i = 0; i < 20; i++) recents.add(`q${i}`);
    recents.add('  Q5 ');
    expect(recents.items()).toHaveLength(RECENT_MAX);
    expect(recents.items()[0]).toBe('Q5');
    expect(recents.items().filter((q) => q.toLowerCase() === 'q5')).toHaveLength(1);
    recents.add('   ');
    expect(recents.items()[0]).toBe('Q5');
  });

  it('removes one query or clears all', () => {
    recents.add('pump');
    recents.add('stair');
    recents.remove('pump');
    expect(recents.items()).toEqual(['stair']);
    recents.clear();
    expect(recents.items()).toEqual([]);
    expect(localStorage.getItem(RECENT_PREFIX + 'a')).toBeNull();
  });

  it('stores only query text under the signed-in user id', () => {
    recents.add('stair');
    expect(JSON.parse(localStorage.getItem(RECENT_PREFIX + 'a')!)).toEqual(['stair']);
    expect(Object.keys(localStorage).filter((k) => k.startsWith(RECENT_PREFIX))).toEqual([RECENT_PREFIX + 'a']);
  });

  it('isolates two users: switching accounts wipes the first user and shows nothing of theirs', async () => {
    recents.add('secret building');
    await login('b');
    expect(recents.items()).toEqual([]);
    expect(localStorage.getItem(RECENT_PREFIX + 'a')).toBeNull();
    recents.add('b query');
    expect(JSON.parse(localStorage.getItem(RECENT_PREFIX + 'b')!)).toEqual(['b query']);
  });

  it('drops another account’s leftovers when a different user signs in on a fresh tab', () => {
    localStorage.setItem(RECENT_PREFIX + 'old', JSON.stringify(['left behind']));
    TestBed.tick();
    expect(localStorage.getItem(RECENT_PREFIX + 'old')).toBeNull();
    expect(recents.items()).toEqual([]);
  });

  it('purges every history on sign-out', () => {
    recents.add('stair');
    session.end('You have signed out.');
    expect(recents.items()).toEqual([]);
    expect(Object.keys(localStorage).some((k) => k.startsWith(RECENT_PREFIX))).toBe(false);
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem(RECENT_PREFIX + 'c', '{not json');
    session.user.set(user('c'));
    expect(recents.items()).toEqual([]);
    localStorage.setItem(RECENT_PREFIX + 'd', JSON.stringify([1, 'ok', { q: 'no' }]));
    session.user.set(user('d'));
    expect(recents.items()).toEqual(['ok']);
  });
});

describe('search helpers', () => {
  it('mirrors the server length rule after trimming', () => {
    expect(searchable(' a ')).toBe(false);
    expect(searchable('ab')).toBe(true);
    expect(searchable('x'.repeat(100))).toBe(true);
    expect(searchable('x'.repeat(101))).toBe(false);
  });

  it('accepts only in-app absolute routes', () => {
    expect(safeRoute('/reports/1')).toBe('/reports/1');
    for (const bad of [null, undefined, '', 'reports/1', '//evil.example', 'javascript:alert(1)', 'https://x.y', '/\\evil.example']) {
      expect(safeRoute(bad)).toBeNull();
    }
  });
});
