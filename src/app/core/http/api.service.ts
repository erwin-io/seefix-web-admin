import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, catchError, throwError, timeout } from 'rxjs';
import { toAppError } from './app-error';

/** Public auth endpoints: do not attach the bearer token. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Single entry point to seefix-api: base URL, timeouts, error normalization. Module services build on it. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(apiUrl(path), { params: toParams(params) }).pipe(normalize(environment.requestTimeoutMs));
  }

  post<T>(path: string, body: unknown = {}, opts: { skipAuth?: boolean } = {}): Observable<T> {
    const context = opts.skipAuth ? new HttpContext().set(SKIP_AUTH, true) : undefined;
    return this.http.post<T>(apiUrl(path), body, { context }).pipe(normalize(environment.requestTimeoutMs));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(apiUrl(path), body).pipe(normalize(environment.requestTimeoutMs));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(apiUrl(path), body).pipe(normalize(environment.requestTimeoutMs));
  }

  /** Multipart: the browser sets the boundary header. */
  upload<T>(path: string, form: FormData): Observable<T> {
    return this.http.post<T>(apiUrl(path), form).pipe(normalize(environment.uploadTimeoutMs));
  }
}

export function apiUrl(path: string): string {
  return `${environment.apiBaseUrl}${path}`;
}

export function isOwnApi(requestUrl: string): boolean {
  return requestUrl.startsWith(`${environment.apiBaseUrl}/api/`);
}

function toParams(params?: QueryParams): HttpParams | undefined {
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
