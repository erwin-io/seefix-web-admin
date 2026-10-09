import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

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
