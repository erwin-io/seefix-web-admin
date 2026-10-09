import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { Session } from './session';

/** Public auth endpoints: do not attach the bearer token. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export type ErrorKind = 'OFFLINE' | 'TIMEOUT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'SERVER';

/** Normalized error. `message` is always safe to show. */
export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly code: string | null = null,
    readonly status = 0,
  ) {
    super(message);
  }
}

/** 401 codes meaning the token is unusable (unlike CURRENT_PASSWORD_INCORRECT). */
export const SESSION_ENDING = new Set(['AUTH_REQUIRED', 'INVALID_TOKEN', 'SESSION_REVOKED', 'INACTIVE_ACCOUNT']);

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TimeoutError) return new AppError('TIMEOUT', 'The server took too long to respond. Please try again.', 'TIMEOUT');
  if (!(error instanceof HttpErrorResponse)) return new AppError('SERVER', 'Something went wrong. Please try again.');
  const { status } = error;
  const body = error.error as { error?: { code?: string; message?: string } } | null;
  const code = body?.error?.code ?? null;
  // seefix-api messages are authored, user-facing strings; 5xx bodies are generic.
  const msg = body?.error?.message;
  if (status === 0) return new AppError('OFFLINE', "You're offline or the API is unreachable.", 'NETWORK');
  if (status === 401) return new AppError('UNAUTHORIZED', msg ?? 'Your session has expired. Please sign in again.', code, status);
  if (status === 403) return new AppError('FORBIDDEN', msg ?? "You don't have access to this.", code, status);
  if (status === 404) return new AppError('NOT_FOUND', msg ?? 'Not found.', code, status);
  if (status === 409) return new AppError('CONFLICT', msg ?? 'This item changed. Refresh and try again.', code, status);
  if (status >= 400 && status < 500) return new AppError('VALIDATION', msg ?? 'Please check the form and try again.', code, status);
  if (status === 504) return new AppError('TIMEOUT', 'The server took too long to respond.', code, status);
  return new AppError('SERVER', 'Something went wrong on our side. Please try again.', code, status);
}

type Params = Record<string, string | number | boolean | null | undefined>;

/** Single entry point to seefix-api: base URL, timeouts, error normalization. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Params): Observable<T> {
    return this.http.get<T>(url(path), { params: toParams(params) }).pipe(normalize(environment.requestTimeoutMs));
  }

  post<T>(path: string, body: unknown = {}, opts: { skipAuth?: boolean } = {}): Observable<T> {
    const context = opts.skipAuth ? new HttpContext().set(SKIP_AUTH, true) : undefined;
    return this.http.post<T>(url(path), body, { context }).pipe(normalize(environment.requestTimeoutMs));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(url(path), body).pipe(normalize(environment.requestTimeoutMs));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(url(path), body).pipe(normalize(environment.requestTimeoutMs));
  }

  /** Multipart: the browser sets the boundary header. */
  upload<T>(path: string, form: FormData): Observable<T> {
    return this.http.post<T>(url(path), form).pipe(normalize(environment.uploadTimeoutMs));
  }
}

export function url(path: string): string {
  return `${environment.apiBaseUrl}${path}`;
}

function toParams(params?: Params): HttpParams | undefined {
  if (!params) return undefined;
  let out = new HttpParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') out = out.set(k, String(v));
  return out;
}

function normalize<T>(ms: number) {
  return (source: Observable<T>) =>
    source.pipe(
      timeout(ms),
      catchError((e: unknown) => throwError(() => toAppError(e))),
    );
}

export function isOwnApi(requestUrl: string): boolean {
  return requestUrl.startsWith(`${environment.apiBaseUrl}/api/`);
}

/** Attaches the JWT to seefix-api requests only (never Cloudinary or Pusher). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Session).token();
  if (!token || req.context.get(SKIP_AUTH) || !isOwnApi(req.url)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/** Ends the session once when the server proves the JWT unusable. Plain 403s never sign out. */
export const sessionEndInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const session = inject(Session);
  if (!isOwnApi(req.url) || !session.token()) return next(req);
  return next(req).pipe(
    tap({
      error: (e: unknown) => {
        if (!(e instanceof HttpErrorResponse) || e.status !== 401) return;
        const code = (e.error as { error?: { code?: string } } | null)?.error?.code ?? null;
        if (code === null || SESSION_ENDING.has(code)) {
          injector.get(Session).end(code === 'SESSION_REVOKED' ? 'Your account security details changed. Please sign in again.' : 'Your session has expired. Please sign in again.');
        }
      },
    }),
  );
};
