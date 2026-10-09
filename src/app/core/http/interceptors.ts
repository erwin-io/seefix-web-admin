import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { tap } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { SKIP_AUTH, isOwnApi } from './api.service';
import { SESSION_ENDING } from './app-error';

/** Attaches the JWT to seefix-api requests only (never Cloudinary or Pusher). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionService).token();
  if (!token || req.context.get(SKIP_AUTH) || !isOwnApi(req.url)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
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
