import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { tap } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { DatasetStore } from '../data/dataset.store';
import { SKIP_AUTH, isOwnApi } from './api.service';
import { SESSION_ENDING } from './app-error';

/** Attaches the JWT to seefix-api requests only (never Cloudinary or Pusher). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionService).token();
  if (!token || req.context.get(SKIP_AUTH) || !isOwnApi(req.url)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/** Own writes that cannot change a cached list (assistant writes touch only drafts, reminders and its job queue). */
const NO_LIST_EFFECT = /\/api\/(auth|notifications|uploads|assistant)\//;

/** After the user's own successful write, cached lists are revalidated (reloaded now if on screen, else on next view). */
export const revalidateInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || !isOwnApi(req.url) || NO_LIST_EFFECT.test(req.url)) return next(req);
  const store = inject(DatasetStore);
  return next(req).pipe(
    tap((e) => {
      if (e.type === HttpEventType.Response && e.ok) store.invalidate();
    }),
  );
};

/** Ends the session once when the server proves the JWT unusable. Plain 403s never sign out. */
export const sessionEndInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const session = inject(SessionService);
  if (!isOwnApi(req.url) || !session.token()) return next(req);
  return next(req).pipe(
    tap({
      error: (e: unknown) => {
        if (!(e instanceof HttpErrorResponse) || e.status !== 401) return;
        const code = (e.error as { error?: { code?: string } } | null)?.error?.code ?? null;
        if (code === null || SESSION_ENDING.has(code)) {
          injector
            .get(SessionService)
            .end(code === 'SESSION_REVOKED' ? 'Your account security details changed. Please sign in again.' : 'Your session has expired. Please sign in again.');
        }
      },
    }),
  );
};
