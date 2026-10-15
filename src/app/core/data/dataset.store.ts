import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, firstValueFrom, fromEvent, map, takeUntil, timeout } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { apiUrl } from '../http/api.service';
import { toAppError } from '../http/app-error';
import { Page, PageResponse, PartialLoadError, fetchAll, isAbort } from './fetch-all';

/** seefix-api's maximum page size. */
export const PAGE_SIZE = 500;
/** Above this many rows the table warns about browser memory (no cap: every authorized row stays loaded). */
export const MEMORY_WARNING_ROWS = 25000;

/** Cache-version domains (seefix-api docs/V2_CACHE_SYNC.md §5). */
export type Domain = 'reports' | 'work_orders' | 'procurement' | 'action_items' | 'users' | 'reference';

export interface DatasetDef<T> {
  /** Cache key, unique per endpoint. */
  key: string;
  path: string;
  idOf: (row: T) => string;
  /** Domains whose version change makes this dataset stale. */
  domains: Domain[];
}

/**
 * One fully loaded list kept in memory for the signed-in user. Sorting/filtering/paging happen in the table on
 * `rows()`; the API is only called again on refresh(), staleness or after the user's own mutations.
 */
export class Dataset<T> {
  readonly rows = signal<T[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** The last load ended with some pages missing (rows are incomplete). */
  readonly partial = signal(false);
  readonly loadedAt = signal<number | null>(null);
  private stale = true;
  private users = 0;
  private abort?: AbortController;
  private pending?: Promise<void>;

  constructor(
    readonly def: DatasetDef<T>,
    private readonly fetchPage: (page: number, signal: AbortSignal) => Promise<PageResponse<T>>,
  ) {}

  /** Loads once; later calls reuse memory until stale. */
  ensure(): Promise<void> {
    return this.stale ? (this.pending ?? this.refresh()) : (this.pending ?? Promise.resolve());
  }

  refresh(): Promise<void> {
    this.abort?.abort();
    const ctrl = (this.abort = new AbortController());
    this.stale = false;
    this.loading.set(true);
    this.error.set(null);
    const run = fetchAll(this.fetchPage, this.def.idOf, {
      signal: ctrl.signal,
      // Show page 1 while the rest loads, only on a first load (a refresh keeps the full old list until done).
      onProgress: (rows) => {
        if (this.loadedAt() === null) this.rows.set(rows);
      },
    })
      .then(
        (res) => {
          if (ctrl.signal.aborted) return; // logged out / superseded between the last page and here
          this.rows.set(res.rows);
          this.partial.set(false);
          this.loadedAt.set(Date.now());
        },
        (e: unknown) => {
          if (isAbort(e)) return;
          this.stale = true; // retry on next view
          if (e instanceof PartialLoadError) {
            this.rows.set(e.rows as T[]);
            this.partial.set(true);
            this.error.set(`Only ${e.rows.length} rows loaded: ${e.message}`);
          } else {
            this.error.set(toAppError(e).message);
          }
        },
      )
      .finally(() => {
        if (this.abort !== ctrl) return;
        this.loading.set(false);
        this.pending = undefined;
        this.abort = undefined;
      });
    this.pending = run;
    return run;
  }

  /** Staleness hook (own mutations now, Pusher / version poll in #18): reload now if on screen, else on next view. */
  invalidate(): void {
    this.stale = true;
    if (this.users > 0) void this.refresh();
  }

  /** Page mounted. Unmounting the last one cancels an unfinished load (navigation). */
  attach(destroyRef: DestroyRef): void {
    this.users++;
    destroyRef.onDestroy(() => {
      if (--this.users === 0 && this.abort) {
        this.cancel();
        this.stale = true;
      }
    });
  }

  /** Logout / account switch: cancel and forget everything. */
  dispose(): void {
    this.cancel();
    this.users = 0;
  }

  private cancel(): void {
    this.abort?.abort();
    this.abort = undefined;
    this.pending = undefined;
    this.loading.set(false);
  }
}

/** Per-user in-memory list datasets. Cleared on logout and account switch, never shared across users. */
@Injectable({ providedIn: 'root' })
export class DatasetStore {
  private readonly http = inject(HttpClient);
  private readonly sets = new Map<string, Dataset<unknown>>();

  constructor() {
    inject(SessionService).onReset(() => this.clear());
  }

  get<T>(def: DatasetDef<T>): Dataset<T> {
    let set = this.sets.get(def.key) as Dataset<T> | undefined;
    if (!set) {
      set = new Dataset<T>(def, (page, signal) => this.page<T>(def.path, page, signal));
      this.sets.set(def.key, set as Dataset<unknown>);
    }
    return set;
  }

  /** For #18: mark datasets depending on these domains stale. No argument = all (after the user's own write). */
  invalidate(domains?: Domain[]): void {
    for (const set of this.sets.values()) if (!domains || set.def.domains.some((d) => domains.includes(d))) set.invalidate();
  }

  clear(): void {
    this.sets.forEach((s) => s.dispose());
    this.sets.clear();
  }

  private page<T>(path: string, page: number, signal: AbortSignal): Promise<PageResponse<T>> {
    const req: Observable<PageResponse<T>> = this.http
      .get<Page<T>>(apiUrl(path), { params: { page, pageSize: PAGE_SIZE }, observe: 'response' })
      .pipe(
        timeout(environment.requestTimeoutMs),
        map((res) => ({ body: res.body!, versions: res.headers.get('X-Data-Versions') })),
        takeUntil(fromEvent(signal, 'abort')),
      );
    return firstValueFrom(req);
  }
}

/** Page helper (injection context): the dataset, loaded on first view, its load cancelled when the page goes away. */
export function useDataset<T>(def: DatasetDef<T>): Dataset<T> {
  const set = inject(DatasetStore).get(def);
  set.attach(inject(DestroyRef));
  void set.ensure();
  return set;
}
