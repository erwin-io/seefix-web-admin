import { HttpErrorResponse } from '@angular/common/http';
import { AppError } from '../http/app-error';
import { PageResponse, PartialLoadError, fetchAll, isAbort } from './fetch-all';

interface Row {
  id: string;
}

const rows = (n: number, from = 0): Row[] => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));
const idOf = (r: Row) => r.id;
const PAGE = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mock paged API over `data()`: offset paging + pageSize+1 lookahead, like seefix-api pageResult(). */
function server(data: () => Row[], opts: { versions?: (page: number) => string | null; delay?: (page: number) => number } = {}) {
  const calls: number[] = [];
  const fetchPage = async (page: number): Promise<PageResponse<Row>> => {
    calls.push(page);
    await sleep(opts.delay?.(page) ?? 0);
    const slice = data().slice((page - 1) * PAGE, page * PAGE + 1);
    return {
      body: { items: slice.slice(0, PAGE), page, pageSize: PAGE, hasMore: slice.length > PAGE },
      versions: opts.versions?.(page) ?? 'reports:1',
    };
  };
  return { fetchPage, calls };
}

const signal = () => new AbortController().signal;

describe('fetchAll', () => {
  it('legacy API (no paging fields, no version header): one request, every row, no error', async () => {
    const data = rows(200);
    const calls: number[] = [];
    // Production before seefix-api#22 ignores ?page&pageSize and answers { items } only.
    const fetchPage = async (page: number) => {
      calls.push(page);
      return { body: { items: data }, versions: null } as PageResponse<Row>;
    };
    const res = await fetchAll(fetchPage, idOf, { signal: signal() });
    expect(calls).toEqual([1]);
    expect(res).toEqual({ rows: data, pages: 1, restarted: false, versions: null });
  });

  for (const size of [0, 1, 250, 500, 501, 10_234]) {
    it(`loads every row exactly once in server order (${size} rows)`, async () => {
      const data = rows(size);
      const { fetchPage, calls } = server(() => data);
      const res = await fetchAll(fetchPage, idOf, { signal: signal() });
      expect(res.rows).toEqual(data);
      expect(res.restarted).toBe(false);
      const pages = Math.max(1, Math.ceil(size / PAGE));
      expect(res.pages).toBe(pages);
      // Every page once; at most concurrency-1 (2) probes past the end, never a re-fetch.
      expect(new Set(calls).size).toBe(calls.length);
      expect(calls.length).toBeLessThanOrEqual(pages + 2);
      if (pages === 1) expect(calls).toEqual([1]);
    });
  }

  it('joins out-of-order pages in page order', async () => {
    const data = rows(2000);
    // Later pages answer first.
    const { fetchPage } = server(() => data, { delay: (p) => (5 - p) * 10 });
    const res = await fetchAll(fetchPage, idOf, { signal: signal(), concurrency: 4 });
    expect(res.rows).toEqual(data);
  });

  it('dedupes rows repeated across pages (insert shifts the offset)', async () => {
    let data = rows(1200);
    const { fetchPage } = server(() => data, {
      versions: () => null, // no version header (API before the cache migration): nothing to restart on
      delay: (p) => (p === 1 ? 0 : p === 2 ? 0 : 20),
    });
    const load = fetchAll(fetchPage, idOf, { signal: signal(), concurrency: 1 });
    await sleep(10);
    data = [{ id: 'new' }, ...data]; // page 3 now repeats the last row of page 2
    const res = await load;
    expect(new Set(res.rows.map(idOf)).size).toBe(res.rows.length);
    expect(res.rows.length).toBe(1200);
  });

  it('dedupes duplicate pages', async () => {
    const data = rows(1000);
    const fetchPage = async (page: number): Promise<PageResponse<Row>> => ({
      // pages 1 and 2 both answer with page 1's rows, page 3 with the rest
      body: { items: page <= 2 ? data.slice(0, 500) : data.slice(500), page, pageSize: PAGE, hasMore: page < 3 },
      versions: null,
    });
    const res = await fetchAll(fetchPage, idOf, { signal: signal(), concurrency: 1 });
    expect(res.rows).toEqual(data);
  });

  it('starts over once when X-Data-Versions changes mid-load', async () => {
    let version = 1;
    let data = rows(1500);
    const { fetchPage, calls } = server(() => data, {
      versions: (p) => {
        if (p === 2 && version === 1) {
          version = 2; // a write lands between page 1 and page 2
          data = [{ id: 'inserted' }, ...data];
        }
        return `reports:${version}`;
      },
    });
    const res = await fetchAll(fetchPage, idOf, { signal: signal(), concurrency: 1 });
    expect(res.restarted).toBe(true);
    expect(res.rows).toEqual(data);
    expect(calls).toEqual([1, 2, 1, 2, 3, 4]);
  });

  it('accepts the second load even if versions move again (no endless loop)', async () => {
    let v = 0;
    const data = rows(1500);
    const { fetchPage, calls } = server(() => data, { versions: () => `reports:${v++}` });
    const res = await fetchAll(fetchPage, idOf, { signal: signal(), concurrency: 1 });
    expect(res.restarted).toBe(true);
    expect(res.rows).toEqual(data);
    expect(calls).toEqual([1, 2, 1, 2, 3]); // 1500 rows = 3 pages; the retry ignores the moving versions
  });

  it('cancels: rejects with AbortError and asks for no more pages', async () => {
    const data = rows(5000);
    const { fetchPage, calls } = server(() => data, { delay: () => 5 });
    const ctrl = new AbortController();
    const load = fetchAll(fetchPage, idOf, { signal: ctrl.signal, concurrency: 2 });
    await sleep(8);
    ctrl.abort();
    const err = await load.catch((e: unknown) => e);
    expect(isAbort(err)).toBe(true);
    const after = calls.length;
    await sleep(30);
    expect(calls.length).toBe(after);
    expect(after).toBeLessThan(10);
  });

  it('retries transient failures, then succeeds', async () => {
    const data = rows(700);
    const inner = server(() => data);
    let failures = 0;
    const fetchPage = (page: number) => {
      if (page === 2 && failures++ < 2) return Promise.reject(new HttpErrorResponse({ status: 503 }));
      return inner.fetchPage(page);
    };
    const res = await fetchAll(fetchPage, idOf, { signal: signal(), retryDelayMs: 1 });
    expect(res.rows).toEqual(data);
    expect(failures).toBe(3);
  });

  it('reports a partial failure with the rows that did load (no silent truncation)', async () => {
    const data = rows(1700);
    const inner = server(() => data);
    const fetchPage = (page: number) => (page === 3 ? Promise.reject(new HttpErrorResponse({ status: 403 })) : inner.fetchPage(page));
    const err = await fetchAll(fetchPage, idOf, { signal: signal(), retryDelayMs: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialLoadError);
    expect((err as PartialLoadError<Row>).rows).toEqual(data.slice(0, 1000));
    expect((err as PartialLoadError<Row>).kind).toBe('FORBIDDEN');
  });

  it('a failing first page is a plain error', async () => {
    const fetchPage = () => Promise.reject(new HttpErrorResponse({ status: 0 }));
    const err = await fetchAll(fetchPage, idOf, { signal: signal(), retries: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).not.toBeInstanceOf(PartialLoadError);
    expect((err as AppError).kind).toBe('OFFLINE');
  });

  it('reports progress: page 1 first, then the growing contiguous prefix', async () => {
    const data = rows(1600);
    const { fetchPage } = server(() => data, { delay: (p) => (p === 2 ? 20 : 0) });
    const seen: number[] = [];
    await fetchAll(fetchPage, idOf, { signal: signal(), onProgress: (r) => seen.push(r.length) });
    expect(seen[0]).toBe(500);
    expect(seen.at(-1)).toBe(1600);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('benchmark: 10k rows at 20 ms per page (time-to-first-view vs total fetch)', async () => {
    const data = rows(10_000);
    const { fetchPage, calls } = server(() => data, { delay: () => 20 });
    const t0 = performance.now();
    let firstView = 0;
    const res = await fetchAll(fetchPage, idOf, {
      signal: signal(),
      onProgress: () => (firstView ||= performance.now() - t0),
    });
    const total = performance.now() - t0;
    console.log(`[bench] 10k rows / ${res.pages} pages / ${calls.length} requests: first view ${firstView.toFixed(0)} ms, total ${total.toFixed(0)} ms`);
    expect(res.rows.length).toBe(10_000);
    // Sanity bound only (CI timers vary); the logged numbers are the benchmark.
    expect(total).toBeLessThan(2000);
    expect(firstView).toBeLessThan(total);
  });
});
