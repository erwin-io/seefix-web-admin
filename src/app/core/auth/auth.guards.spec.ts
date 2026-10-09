import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Role } from '../models/user.model';
import { roleGuard, safeReturnUrl } from './auth.guards';
import { SessionService } from './session.service';

describe('safeReturnUrl', () => {
  it('allows in-app paths only', () => {
    expect(safeReturnUrl('/work-orders/1')).toBe('/work-orders/1');
    expect(safeReturnUrl('//evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('https://evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('/login')).toBe('/dashboard');
    expect(safeReturnUrl(null)).toBe('/dashboard');
  });
});

describe('roleGuard', () => {
  const run = (roles: Role[] | undefined) =>
    TestBed.runInInjectionContext(() =>
      roleGuard({ data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('admits matching roles and redirects others to /denied', () => {
    TestBed.inject(SessionService).user.set({ id: 'w', role: 'WORKER' } as never);
    expect(run(['WORKER', 'ADMIN'])).toBe(true);
    const denied = run(['ADMIN']);
    expect(denied instanceof UrlTree && denied.toString()).toBe('/denied');
    expect(run(undefined)).toBe(true);
  });
});

describe('SessionService.login', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('rejects Reporter accounts and stores nothing', async () => {
    const session = TestBed.inject(SessionService);
    const p = session.login('rep@x.com', 'pw').catch((e) => e);
    TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush({ user: { id: 'r', role: 'REPORTER' }, accessToken: 't' });
    const err = await p;
    expect(err.code).toBe('ROLE_DENIED');
    expect(session.token()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('stores the token for staff', async () => {
    const session = TestBed.inject(SessionService);
    const p = session.login('w@x.com', 'pw');
    TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush({ user: { id: 'w', role: 'WORKER' }, accessToken: 't' });
    await p;
    expect(session.token()).toBe('t');
    expect(session.has('WORKER')).toBe(true);
  });
});
