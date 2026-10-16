import { AppError, toAppError } from '../http/app-error';

/** One page of a paged seefix-api list (`?page&pageSize`). */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** A page plus its `X-Data-Versions` stamp (null when the API sent none, e.g. before the cache migration). */
export interface PageResponse<T> {
  body: Page<T>;
  versions: string | null;
}

export interface FetchAllOptions<T> {
  signal: AbortSignal;
  /** Parallel page requests after page 1. */
  concurrency?: number;
  /** Extra attempts per page for network/timeout/5xx errors. */
  retries?: number;
  retryDelayMs?: number;
  /** Rows of the contiguous pages loaded so far (server order, deduped): lets the table show page 1 early. */
  onProgress?: (rows: T[]) => void;
}

export interface FetchAllResult<T> {
  rows: T[];
  pages: number;
  /** The domain versions moved during the load and it was fetched again. */
  restarted: boolean;
  /** `X-Data-Versions` of page 1 of the kept pass: the oldest stamp in the result (null when the API sent none). */
  versions: string | null;
}

/** Some pages failed after retries: `rows` holds the contiguous pages that did load. */
export class PartialLoadError<T> extends AppError {
  constructor(
    readonly rows: T[],
    cause: AppError,
  ) {
    super(cause.kind, cause.message, cause.code, cause.status);
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/**
 * Loads EVERY page (no row cap) until `hasMore` is false. Page 1 alone (most lists fit in it), then `concurrency`
 * pages at a time. Pages are joined in page order whatever order they arrive in, and rows deduped by id (offset
 * paging can repeat a row when one is inserted mid-load). If `X-Data-Versions` changes between pages the snapshot is
 * mixed, so it starts over once; a second change is accepted (still deduped, next refresh fixes it).
 */
export async function fetchAll<T>(
  fetchPage: (page: number, signal: AbortSignal) => Promise<PageResponse<T>>,
  idOf: (row: T) => string,
  opts: FetchAllOptions<T>,
): Promise<FetchAllResult<T>> {
  const first = await attempt(fetchPage, idOf, opts, true);
  if (!first.versionsChanged) return { rows: first.rows, pages: first.pages, restarted: false, versions: first.stamp };
  // The retry always runs to the last page, even if versions move again: never a truncated list.
  const second = await attempt(fetchPage, idOf, opts, false);
  return { rows: second.rows, pages: second.pages, restarted: true, versions: second.stamp };
}

async function attempt<T>(
  fetchPage: (page: number, signal: AbortSignal) => Promise<PageResponse<T>>,
  idOf: (row: T) => string,
  opts: FetchAllOptions<T>,
  stopOnChange: boolean,
) {
  const { signal, concurrency = 3, retries = 2, retryDelayMs = 400, onProgress } = opts;
  const pages = new Map<number, T[]>();
  let last = Infinity; // first page with hasMore=false
  let next = 1;
  let stamp: string | null = null;
  let versionsChanged = false;
  let failure: AppError | null = null;
  let shown = 0;

  const join = () => {
    const seen = new Set<string>();
    const rows: T[] = [];
    for (let p = 1; pages.has(p) && p <= last; p++) {
      for (const row of pages.get(p)!) {
        const id = idOf(row);
        if (!seen.has(id)) {
          seen.add(id);
          rows.push(row);
        }
      }
    }
    return rows;
  };

  const take = async (page: number) => {
    const res = await withRetry(() => fetchPage(page, signal), retries, retryDelayMs, signal);
    if (res.versions !== null) {
      if (stamp === null) stamp = res.versions;
      else if (stamp !== res.versions) versionsChanged = stopOnChange;
    }
    pages.set(page, res.body.items);
    if (!res.body.hasMore) last = Math.min(last, page);
    if (onProgress) {
      let contiguous = 0;
      while (pages.has(contiguous + 1) && contiguous < last) contiguous++;
      if (contiguous > shown) {
        shown = contiguous;
        onProgress(join());
      }
    }
  };

  const worker = async () => {
    while (!failure && !versionsChanged && next <= last) {
      const page = next++;
      try {
        await take(page);
      } catch (e) {
        if (isAbort(e)) throw e;
        // A page past the end may fail harmlessly once `last` is known.
        if (page <= last) failure ??= toAppError(e);
      }
    }
  };

  next = 2;
  await take(1);
  if (last > 1) await Promise.all(Array.from({ length: concurrency }, worker));
  if (signal.aborted) throw abortError();
  if (failure && !versionsChanged) throw new PartialLoadError(join(), failure);
  return { rows: join(), pages: Math.min(last, pages.size), versionsChanged, stamp: stamp as string | null };
}

async function withRetry<R>(run: () => Promise<R>, retries: number, delayMs: number, signal: AbortSignal): Promise<R> {
  for (let i = 0; ; i++) {
    if (signal.aborted) throw abortError();
    try {
      return await run();
    } catch (e) {
      if (signal.aborted || isAbort(e)) throw abortError();
      const err = toAppError(e);
      const transient = err.kind === 'OFFLINE' || err.kind === 'TIMEOUT' || err.kind === 'SERVER';
      if (!transient || i >= retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

function abortError(): DOMException {
  return new DOMException('Load cancelled', 'AbortError');
}
