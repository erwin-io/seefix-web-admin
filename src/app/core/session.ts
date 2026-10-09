import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, AppError, SESSION_ENDING } from './api';
import { Role, STAFF_ROLES, User } from './models';

const TOKEN_KEY = 'seefix.admin.token';

/**
 * Session state + sign-in/out. The JWT lives in sessionStorage: it survives a
 * reload but not closing the tab. Server RBAC stays authoritative.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly resets = new Set<() => void>();
  private boot?: Promise<void>;

  readonly token = signal<string | null>(read());
  readonly user = signal<User | null>(null);
  /** One-shot message for the login page (expired, revoked, signed out). */
  readonly notice = signal<string | null>(null);
  readonly role = computed(() => this.user()?.role ?? null);

  has(...roles: Role[]): boolean {
    const role = this.role();
    return !!role && roles.includes(role);
  }

  /** Resolves once a stored token has been checked against /api/auth/me. */
  ready(): Promise<void> {
    return (this.boot ??= this.restore());
  }

  async login(identifier: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.api.post<{ user: User; accessToken: string }>('/api/auth/login', { identifier, password }, { skipAuth: true }),
    );
    if (!STAFF_ROLES.includes(res.user.role)) throw denied();
    this.set(res.user, res.accessToken);
    return res.user;
  }

  async refresh(): Promise<void> {
    const { user } = await firstValueFrom(this.api.get<{ user: User }>('/api/auth/me'));
    this.user.set(user);
  }

  /** Feature state that must not leak to the next account (lists, pollers, sockets). */
  onReset(fn: () => void): void {
    this.resets.add(fn);
  }

  end(notice: string | null = null): void {
    if (!this.token() && !this.user()) return;
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
    this.user.set(null);
    this.notice.set(notice);
    this.resets.forEach((fn) => fn());
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private set(user: User, token: string): void {
    if (this.user() && this.user()?.id !== user.id) this.resets.forEach((fn) => fn());
    sessionStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
    this.user.set(user);
    this.notice.set(null);
  }

  private async restore(): Promise<void> {
    if (!this.token()) return;
    try {
      const { user } = await firstValueFrom(this.api.get<{ user: User }>('/api/auth/me'));
      if (!STAFF_ROLES.includes(user.role)) {
        this.end(denied().message);
        return;
      }
      this.user.set(user);
    } catch (e) {
      const err = e as AppError;
      // Only a proven-bad token is discarded; an outage keeps it so the user can retry.
      if (err.kind === 'UNAUTHORIZED' && (err.code === null || SESSION_ENDING.has(err.code))) {
        sessionStorage.removeItem(TOKEN_KEY);
        this.token.set(null);
        this.notice.set('Your session has expired. Please sign in again.');
      } else {
        this.boot = undefined;
        throw err;
      }
    }
  }
}

function read(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function denied(): AppError {
  return new AppError('FORBIDDEN', 'The web admin is for SEEFIX staff accounts. Reporters use the mobile app.', 'ROLE_DENIED', 403);
}
