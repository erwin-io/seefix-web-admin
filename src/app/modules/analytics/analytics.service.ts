import { Injectable, inject, signal } from '@angular/core';
import { SessionService } from '@app/core/auth/session.service';
import { Dataset, DatasetDef, DatasetStore } from '@app/core/data/dataset.store';
import { AnalyticsOverview, DateRange } from './analytics.models';

export const ANALYTICS_OVERVIEW: DatasetDef<AnalyticsOverview> = {
  key: 'analytics-overview',
  path: '/api/analytics/overview',
  idOf: () => 'overview',
  domains: ['reports', 'work_orders', 'procurement', 'reference'],
};

const DAY_MS = 86_400_000;
export const MAX_RANGE_DAYS = 366;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The API's default: the last 30 UTC days, today included. */
export function lastDays(days: number, now = new Date()): DateRange {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { from: iso(new Date(today - (days - 1) * DAY_MS)), to: iso(new Date(today)) };
}

/** Same rules as seefix-api `dateRange`: real YYYY-MM-DD dates, from ≤ to, at most 366 days. Null = valid. */
export function rangeError({ from, to }: DateRange): string | null {
  const parse = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) || iso(d) !== v ? null : d.getTime();
  };
  const f = parse(from);
  const t = parse(to);
  if (f === null || t === null) return 'Enter both dates.';
  if (f > t) return 'The start date must be on or before the end date.';
  if (t + DAY_MS - f > MAX_RANGE_DAYS * DAY_MS) return `The range can be at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

/**
 * The analytics snapshot for the chosen range, kept as a one-row Dataset so CacheSyncService refreshes it when
 * reports, work orders or procurement change (and it is cleared on logout like every list).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly store = inject(DatasetStore);
  readonly range = signal<DateRange>(lastDays(30));

  constructor() {
    inject(SessionService).onReset(() => this.range.set(lastDays(30)));
  }

  overview(): Dataset<AnalyticsOverview> {
    return this.store.get(ANALYTICS_OVERVIEW, async (_page, signal) => {
      const { from, to } = this.range();
      const res = await this.store.request<AnalyticsOverview>(ANALYTICS_OVERVIEW.path, { from, to }, signal);
      return { body: { items: [res.body], page: 1, pageSize: 1, hasMore: false }, versions: res.versions };
    });
  }

  setRange(range: DateRange): void {
    this.range.set(range);
    void this.overview().refresh();
  }
}
