import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AnalyticsOverview } from '../../analytics.models';
import { AnalyticsService, lastDays, rangeError } from '../../analytics.service';
import { AnalyticsOverviewComponent } from './analytics-overview.component';

const FULL: AnalyticsOverview = {
  from: '2026-09-17',
  to: '2026-10-16',
  sections: {
    reports: { created: 1234, byStatus: { PENDING_REVIEW: 1000, RESOLVED: 234 }, byCategory: { PLUMBING: 7, Unknown: 1227 }, perDay: [{ day: '2026-10-01', count: 1234 }] },
    queueAging: { under1d: 0, d1to3: 2, d3to7: 3, over7d: 995, total: 1000 },
    workOrders: { byStatus: { ASSIGNED: 4, COMPLETED: 9 }, completed: 9, avgTurnaroundHours: 12.3, p50TurnaroundHours: 0.1, reworkRate: 33.3 },
    procurement: { byStatus: { SUBMITTED: 2 }, open: 2, overdue: 1, completed: 0, avgDaysToOutcome: null },
    agent: { byStatus: { COMPLETED: 1200, FAILED: 34 }, retried: 5, latencyP50Seconds: 41.7, latencyP95Seconds: 1803.2, failedOpen: 3 },
  },
};

describe('AnalyticsOverviewComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [AnalyticsOverviewComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AnalyticsOverviewComponent);
    const el = fixture.nativeElement as HTMLElement;
    const stat = (label: string) =>
      [...el.querySelectorAll('app-stat-card')].find((c) => c.querySelector('.label')?.textContent?.trim() === label)?.querySelector('.value')?.textContent?.replace(/\s+/g, ' ').trim();
    const sections = () => [...el.querySelectorAll('[data-section]')].map((s) => s.getAttribute('data-section'));
    const respond = async (body: AnalyticsOverview) => {
      const req = http.expectOne((r) => r.url === '/api/analytics/overview');
      req.flush(body);
      await fixture.whenStable();
      return req.request;
    };
    return { http, fixture, el, stat, sections, respond };
  }

  it('asks for the current range and renders every number exactly as returned', async () => {
    const { respond, stat, sections, el } = setup();
    const req = await respond(FULL);
    expect(req.params.get('from')).toBe(lastDays(30).from);
    expect(req.params.get('to')).toBe(lastDays(30).to);

    expect(sections()).toEqual(['reports', 'queueAging', 'workOrders', 'procurement', 'agent']);
    expect(stat('Reports created')).toBe('1234');
    expect(stat('Waiting for review')).toBe('1000');
    expect(stat('Under 1 day')).toBe('0');
    expect(stat('Average turnaround')).toBe('12.3 h');
    expect(stat('Median turnaround')).toBe('0.1 h');
    expect(stat('Rework rate')).toBe('33.3 %');
    expect(stat('Average time to outcome')).toBe('—'); // null = no data, not 0
    expect(stat('Latency p95')).toBe('1803.2 s');
    expect(stat('Failed, needs a person')).toBe('3');
    // Breakdown counts as returned (not re-summed or rounded).
    const bars = [...el.querySelectorAll('[data-section="reports"] app-bar-list li')].map((li) => `${li.querySelector('.name')?.textContent}=${li.querySelector('.num')?.textContent}`);
    expect(bars).toContain('Pending review=1000');
    expect(bars).toContain('Unknown=1227');
    expect(el.textContent).toContain('2026-09-17 to 2026-10-16');
  });

  it('shows only the procurement section for Procurement (as the API scopes it)', async () => {
    const { respond, sections, stat } = setup();
    await respond({ ...FULL, sections: { procurement: FULL.sections.procurement } });
    expect(sections()).toEqual(['procurement']);
    expect(stat('Overdue')).toBe('1');
    expect(stat('Reports created')).toBeUndefined();
  });

  it('shows only the work-order section for a Worker', async () => {
    const { respond, sections, stat } = setup();
    await respond({ ...FULL, sections: { workOrders: { ...FULL.sections.workOrders!, completed: 2 } } });
    expect(sections()).toEqual(['workOrders']);
    expect(stat('Completed in range')).toBe('2');
  });

  it('applies a preset and a valid custom range; blocks an invalid one before calling the API', async () => {
    const { respond, fixture, http, el } = setup();
    await respond(FULL);
    const cmp = fixture.componentInstance;

    cmp.usePreset(7);
    const preset = await respond(FULL);
    expect(preset.params.get('from')).toBe(lastDays(7).from);
    expect(TestBed.inject(AnalyticsService).range()).toEqual(lastDays(7));

    cmp.setDraft('from', '2026-10-10');
    cmp.setDraft('to', '2026-10-01');
    await fixture.whenStable();
    expect(el.querySelector('.range-error')?.textContent).toContain('on or before');
    cmp.applyDraft();
    http.expectNone('/api/analytics/overview');

    cmp.setDraft('to', '2026-10-12');
    cmp.applyDraft();
    const custom = await respond(FULL);
    expect([custom.params.get('from'), custom.params.get('to')]).toEqual(['2026-10-10', '2026-10-12']);
    http.verify();
  });

  it('keeps the previous figures and says so when a refresh fails', async () => {
    const { respond, fixture, http, stat, el } = setup();
    await respond(FULL);
    void fixture.componentInstance.data.reload();
    http.expectOne((r) => r.url === '/api/analytics/overview').flush({ error: { code: 'X', message: 'Bad request' } }, { status: 400, statusText: 'Bad' });
    await fixture.whenStable();
    expect(stat('Reports created')).toBe('1234');
    expect(el.querySelector('.banner.error')?.textContent).toContain('Showing the previous figures');
  });

  it('colours status bars by status (Cancelled red, Resolved green) and leaves category bars plain', async () => {
    const { respond, el } = setup();
    await respond({ ...FULL, sections: { ...FULL.sections, reports: { ...FULL.sections.reports!, byStatus: { CANCELLED: 19, RESOLVED: 6, PENDING_REVIEW: 1 } } } });
    const colours = (section: string, n = 0) =>
      Object.fromEntries([...[...el.querySelectorAll(`[data-section="${section}"] app-bar-list`)][n].querySelectorAll('li')].map((li) => [
        li.querySelector('.name')?.textContent,
        (li.querySelector('.bar') as HTMLElement).style.background,
      ]));
    expect(colours('reports')).toEqual({ Cancelled: 'var(--sf-danger)', Resolved: 'var(--sf-ok)', 'Pending review': 'var(--sf-warn)' });
    expect(Object.values(colours('reports', 1)).every((c) => c === '')).toBe(true); // by category: accent default
    expect(colours('agent')).toEqual({ Completed: 'var(--sf-ok)', Failed: 'var(--sf-danger)' });
    expect(colours('workOrders')).toEqual({ Completed: 'var(--sf-ok)', Assigned: 'var(--sf-accent)' });
  });

  it('colours tile values by urgency only when non-zero (a 0 is never an alarm)', async () => {
    const { respond, el } = setup();
    await respond(FULL);
    const color = (label: string) =>
      ([...el.querySelectorAll('app-stat-card')].find((c) => c.querySelector('.label')?.textContent?.trim() === label)?.querySelector('.value') as HTMLElement).style.color;
    expect(color('Under 1 day')).toBe(''); // 0
    expect(color('1–3 days')).toBe('rgb(180, 83, 9)');
    expect(color('3–7 days')).toBe('rgb(194, 65, 12)');
    expect(color('Over 7 days')).toBe('rgb(185, 28, 28)');
    expect(color('Waiting for review')).toBe('rgb(77, 124, 15)');
    expect(color('Completed in range')).toBe('var(--sf-ok)');
    expect(color('Rework rate')).toBe('var(--sf-danger)');
    expect(color('Average time to outcome')).toBe(''); // no data
  });

  it('picks From/To with a calendar: read-only fields, values as calendar days', async () => {
    const { respond, fixture, el } = setup();
    await respond(FULL);
    const [from, to] = [...el.querySelectorAll<HTMLInputElement>('mat-date-range-input input')];
    expect(from.readOnly && to.readOnly).toBe(true);
    expect(el.querySelector('input[type="date"]')).toBeNull();
    const cmp = fixture.componentInstance;
    expect(cmp.iso(cmp.asDate('2026-02-28'))).toBe('2026-02-28');
    expect(cmp.asDate('bad')).toBeNull();
    expect(cmp.iso(null)).toBe('');
  });
});

describe('rangeError (seefix-api dateRange rules)', () => {
  it('accepts up to 366 days and rejects rollover dates, reversed and longer ranges', () => {
    expect(rangeError({ from: '2026-01-01', to: '2026-01-01' })).toBeNull();
    expect(rangeError({ from: '2025-01-01', to: '2026-01-01' })).toBeNull(); // 366 days inclusive
    expect(rangeError({ from: '2025-01-01', to: '2026-01-02' })).toMatch(/366/);
    expect(rangeError({ from: '2026-02-30', to: '2026-03-02' })).toMatch(/both dates/);
    expect(rangeError({ from: '', to: '2026-03-02' })).toMatch(/both dates/);
    expect(rangeError({ from: '2026-03-02', to: '2026-03-01' })).toMatch(/on or before/);
  });
});
