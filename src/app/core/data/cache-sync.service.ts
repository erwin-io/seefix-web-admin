import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { ApiService } from '../http/api.service';
import { AppError } from '../http/app-error';
import { NotificationService } from '../notifications/notification.service';
import { Domain, DatasetStore, Versions } from './dataset.store';

/** `GET /api/sync/versions` (seefix-api docs/V2_CACHE_SYNC.md §2), filtered to the caller's role. */
export interface SyncVersions {
  available: boolean;
  versions: Versions;
}

/** Initial proposal from #18: poll even while Pusher is live, because a publisher can die behind a healthy socket. */
export const SYNC_LIVE_MS = 60_000;
export const SYNC_POLL_MS = 30_000;
/** `available: false` (cache migration not applied): datasets older than this reload. */
export const SYNC_FALLBACK_MS = 300_000;
export const SYNC_MAX_BACKOFF_MS = 300_000;
/** Bursts of hints / module entries within this window cost one check. */
export const SYNC_DEBOUNCE_MS = 1_000;

/**
 * Keeps the in-memory datasets (DatasetStore) fresh for the signed-in user. One timer; one request at a time.
 * A dataset is stale when the server's version of one of its domains is newer than the `X-Data-Versions` it was
 * loaded from (or, without a stamp, when that domain moved since the last check). Stale + on screen → reloads
 * once now; stale + hidden → reloads on next view (Dataset.invalidate). Detail pages and their forms are never
 * touched. Pusher `data.changed` only means "check now"; its payload is not trusted.
 */
@Injectable({ providedIn: 'root' })
export class CacheSyncService {
  private readonly api = inject(ApiService);
  private readonly store = inject(DatasetStore);
  private readonly inbox = inject(NotificationService);
  private readonly doc = inject(DOCUMENT);

  /** null until the first answer; false = API has no versions yet (time-based refresh). */
  readonly available = signal<boolean | null>(null);
  /** The last check failed (API or database down): lists show what they have, marked possibly out of date. */
  readonly offline = signal(false);

  /** Bumped by stop(): a response from an older session/run is dropped. */
  private run = 0;
  private started = false;
  private versions: Versions | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private due = Infinity;
  private inflight: Promise<void> | null = null;
  private again = false;
  private failures = 0;
  private lastFallback = 0;

  constructor() {
    inject(SessionService).onReset(() => this.stop());
    this.store.onActivity = () => this.poll();
    this.inbox.onDataChanged(() => this.poll());
    // App resume: tab shown again or network back.
    this.doc.addEventListener('visibilitychange', () => this.doc.visibilityState === 'visible' && this.poll());
    this.doc.defaultView?.addEventListener('online', () => this.poll());
  }

  start(): void {
    this.stop();
    this.started = true;
    this.lastFallback = Date.now();
    this.schedule(0);
  }

  /** "Check soon": module entry, manual refresh, resume, Pusher hint. Debounced; never overlaps a request. */
  poll(): void {
    if (!this.started) return;
    if (this.inflight) this.again = true; // the answer in flight may predate the change
    else this.schedule(SYNC_DEBOUNCE_MS);
  }

  /** Runs one check now (shares the request in flight). */
  check(): Promise<void> {
    if (!this.started) return Promise.resolve();
    if (this.inflight) return this.inflight;
    this.clearTimer();
    const run = this.run;
    this.again = false;
    this.inflight = firstValueFrom(this.api.get<SyncVersions>('/api/sync/versions'))
      .then(
        (res) => {
          if (run === this.run) this.apply(res);
        },
        (e: unknown) => {
          if (run === this.run) this.fail(e);
        },
      )
      .finally(() => {
        if (run !== this.run) return;
        this.inflight = null;
        this.schedule(this.again ? SYNC_DEBOUNCE_MS : this.nextDelay());
      });
    return this.inflight;
  }

  private apply(res: SyncVersions): void {
    const recovered = this.offline();
    this.failures = 0;
    this.offline.set(false);
    // Lists that failed during the outage get their retry now (on screen) or on next view.
    if (recovered) this.store.invalidateWhere((set) => set.error() !== null);
    if (!res.available) {
      this.available.set(false);
      this.versions = null;
      const now = Date.now();
      if (now - this.lastFallback >= SYNC_FALLBACK_MS) {
        this.lastFallback = now;
        this.store.invalidateWhere((set) => set.settled && now - (set.loadedAt() ?? 0) >= SYNC_FALLBACK_MS);
      }
      return;
    }
    this.available.set(true);
    const prev = this.versions;
    const next = res.versions;
    this.versions = next;
    const newer = (d: Domain, own: Versions | null) => {
      const v = next[d];
      if (v === undefined) return false; // not visible to this role
      const mine = own?.[d];
      return mine !== undefined ? v > mine : prev !== null && prev[d] !== v;
    };
    // Loading datasets are skipped: their stamp is compared on the next check, so a change is never lost.
    this.store.invalidateWhere((set) => set.settled && set.def.domains.some((d) => newer(d, set.versions)));
  }

  private fail(e: unknown): void {
    // 401 ends the session elsewhere (stop() follows); any other failure keeps the data and backs off.
    if (e instanceof AppError && e.kind === 'UNAUTHORIZED') return;
    this.failures++;
    this.offline.set(true);
  }

  private nextDelay(): number {
    const base = this.inbox.live() ? SYNC_LIVE_MS : SYNC_POLL_MS;
    return this.failures ? Math.min(base * 2 ** (this.failures - 1), SYNC_MAX_BACKOFF_MS) : base;
  }

  /** The single timer: a sooner request wins, a later one never pushes an earlier check back. */
  private schedule(ms: number): void {
    if (!this.started) return;
    const at = Date.now() + ms;
    if (this.timer && at >= this.due) return;
    this.clearTimer();
    this.due = at;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.due = Infinity;
      void this.check();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.due = Infinity;
  }

  /** Logout / account switch: forget the versions and drop whatever is in flight. Datasets clear themselves. */
  private stop(): void {
    this.run++;
    this.started = false;
    this.clearTimer();
    this.inflight = null;
    this.again = false;
    this.versions = null;
    this.failures = 0;
    this.available.set(null);
    this.offline.set(false);
  }
}
