import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { ReportListPage } from '@app/modules/maintenance/pages/report-list/report-list.page';
import { ProcurementInboxPage } from '@app/modules/procurement/pages/procurement-inbox/procurement-inbox.page';
import { WorkOrderListPage } from '@app/modules/work-orders/pages/work-order-list/work-order-list.page';
import { todayRange } from './date-range-filter.component';

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9).toISOString();
const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 9).toISOString();

/** Owner items 10–12: each list filters its fully loaded rows by its date column, locally. */
describe('list date filters', () => {
  async function render<T>(page: Type<T>, path: string, items: unknown[]) {
    TestBed.configureTestingModule({ imports: [page], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(SessionService).user.set({ id: 'a', role: 'ADMIN', fullName: 'Ada' } as never);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(page);
    fixture.detectChanges();
    http.match((r) => r.url === path).forEach((r) => r.flush({ items, page: 1, pageSize: 500, hasMore: false }));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance as T & { rows(): unknown[] }, el: fixture.nativeElement as HTMLElement };
  }

  it('Reports: by submitted date, with Today', async () => {
    const report = (id: string, createdAt: string) => ({ id, reportNo: id, status: 'PENDING_REVIEW', createdAt, screening: { isActionable: true, title: '' } });
    const { page, el } = await render(ReportListPage, '/api/maintenance/reports', [report('A', today), report('B', lastWeek)]);
    expect(el.querySelector('app-date-range-filter mat-label')?.textContent).toBe('Submitted');
    expect(page.rows()).toHaveLength(2);
    (page as unknown as ReportListPage).submitted.set(todayRange());
    expect(page.rows().map((r) => (r as { id: string }).id)).toEqual(['A']);
  });

  it('Work Orders: by the created date the API now returns, shown in its own column', async () => {
    const wo = (id: string, createdAt: string) => ({ id, workOrderNo: id, status: 'ASSIGNED', createdAt, plannedStartAt: null, deadline: null });
    const { page, el, fixture } = await render(WorkOrderListPage, '/api/work-orders', [wo('W1', today), wo('W2', lastWeek)]);
    expect(el.querySelector('app-date-range-filter mat-label')?.textContent).toBe('Created');
    expect(el.querySelector('th.mat-column-created')?.textContent).toContain('Created');
    (page as unknown as WorkOrderListPage).created.set({ start: new Date(lastWeek), end: new Date(lastWeek) });
    fixture.detectChanges();
    expect(page.rows().map((r) => (r as { id: string }).id)).toEqual(['W2']);
  });

  it('Procurement inbox: by submitted date', async () => {
    const h = (HandoffId: string, SubmittedAt: string) => ({ HandoffId, HandoffNo: HandoffId, Status: 'SUBMITTED', SubmittedAt });
    const { page } = await render(ProcurementInboxPage, '/api/procurement/inbox', [h('H1', today), h('H2', lastWeek)]);
    (page as unknown as ProcurementInboxPage).submitted.set(todayRange());
    expect(page.rows().map((r) => (r as { HandoffId: string }).HandoffId)).toEqual(['H1']);
  });
});
