import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../auth/session.service';

export const RECENT_PREFIX = 'seefix.admin.recentSearches.';
export const RECENT_MAX = 15;

/**
 * Recent Spotlight queries, last used first, kept in localStorage under the signed-in user's id.
 * Only the query text is stored, never result content. Every user's history is wiped on sign-out
 * and on account switch (SessionService.onReset), and other accounts' leftovers are dropped at sign-in.
 */
@Injectable({ providedIn: 'root' })
export class RecentSearchesService {
  private readonly session = inject(SessionService);
  private readonly userId = computed(() => this.session.user()?.id ?? null);
  /** Bumped on every write so `items` re-reads storage. */
  private readonly rev = signal(0);

  /** Read per user id, so a new account never sees the previous one's list. */
  readonly items = computed(() => {
    this.rev();
    const id = this.userId();
    return id ? read(id) : [];
  });

  constructor() {
    this.session.onReset(() => this.purgeAll());
    effect(() => {
      const id = this.userId();
      if (id) dropOthers(id);
    });
  }

  add(query: string): void {
    const q = query.trim();
    if (!q) return;
    this.write([q, ...this.items().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX));
  }

  remove(query: string): void {
    this.write(this.items().filter((x) => x !== query));
  }

  clear(): void {
    this.write([]);
  }

  private write(next: string[]): void {
    const id = this.userId();
    if (!id) return;
    store((s) => (next.length ? s.setItem(RECENT_PREFIX + id, JSON.stringify(next)) : s.removeItem(RECENT_PREFIX + id)));
    this.rev.update((n) => n + 1);
  }

  private purgeAll(): void {
    dropOthers(null);
    this.rev.update((n) => n + 1);
  }
}

function read(id: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_PREFIX + id) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Removes every user's history except `keep`'s. */
function dropOthers(keep: string | null): void {
  store((s) => {
    const keys = Array.from({ length: s.length }, (_, i) => s.key(i));
    for (const k of keys) if (k?.startsWith(RECENT_PREFIX) && k !== RECENT_PREFIX + keep) s.removeItem(k);
  });
}

/** Storage can throw (private mode, quota); history is a convenience, so failures are ignored. */
function store(fn: (s: Storage) => void): void {
  try {
    fn(localStorage);
  } catch {
    /* ignore */
  }
}
