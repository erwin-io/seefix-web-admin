import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, AppError, authInterceptor, sessionEndInterceptor, toAppError } from './api';
import { Session } from './session';

describe('toAppError', () => {
  const http = (status: number, code?: string, message?: string) =>
    new HttpErrorResponse({ status, error: code ? { error: { code, message } } : null });

  it('maps network failure to OFFLINE', () => {
    expect(toAppError(http(0)).kind).toBe('OFFLINE');
  });

  it('keeps the API code and authored message', () => {
    const e = toAppError(http(409, 'INVALID_WORK_ORDER_STATE', 'Only ASSIGNED Work Orders can be started.'));
    expect(e).toBeInstanceOf(AppError);
    expect(e.kind).toBe('CONFLICT');
    expect(e.code).toBe('INVALID_WORK_ORDER_STATE');
    expect(e.message).toBe('Only ASSIGNED Work Orders can be started.');
  });

  it('never shows 5xx server text', () => {
    expect(toAppError(http(500, 'INTERNAL_ERROR', 'stack trace here')).message).not.toContain('stack');
  });
});

describe('interceptors', () => {
  let api: Api;
  let ctrl: HttpTestingController;
  let session: Session;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, sessionEndInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(Api);
    ctrl = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.token.set('jwt-1');
    session.user.set({ id: 'u1', role: 'ADMIN' } as never);
  });

  it('attaches the bearer token to /api requests', async () => {
    const p = firstValueFrom(api.get('/api/work-orders'));
    const req = ctrl.expectOne('/api/work-orders');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    req.flush({ items: [] });
    await p;
  });

  it('skips the token for public auth calls', async () => {
    const p = firstValueFrom(api.post('/api/auth/login', {}, { skipAuth: true }));
    const req = ctrl.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await p;
  });

  it('ends the session on 401 SESSION_REVOKED', async () => {
    const p = firstValueFrom(api.get('/api/auth/me')).catch((e) => e);
    ctrl.expectOne('/api/auth/me').flush({ error: { code: 'SESSION_REVOKED' } }, { status: 401, statusText: 'Unauthorized' });
    await p;
    expect(session.token()).toBeNull();
    expect(session.notice()).toContain('security');
  });

  it('keeps the session on 401 CURRENT_PASSWORD_INCORRECT and on 403', async () => {
    const a = firstValueFrom(api.post('/api/auth/me/change-password', {})).catch((e) => e);
    ctrl.expectOne('/api/auth/me/change-password').flush({ error: { code: 'CURRENT_PASSWORD_INCORRECT' } }, { status: 401, statusText: 'x' });
    await a;
    const b = firstValueFrom(api.get('/api/work-orders/x')).catch((e) => e);
    ctrl.expectOne('/api/work-orders/x').flush({ error: { code: 'FORBIDDEN' } }, { status: 403, statusText: 'x' });
    await b;
    expect(session.token()).toBe('jwt-1');
  });
});
