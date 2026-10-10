import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { UiService } from '@app/shared/services/ui.service';
import { ReportDetailPage } from './report-detail.page';

const DETAIL = {
  report: {
    Id: 'r1', ReportNo: 'RPT-1', Status: 'PENDING_REVIEW', AgentStatus: 'COMPLETED', ScopeDecision: 'Facility Issue',
    AiCategory: 'Electrical', AiRecommendedUrgency: 'High', screening: { title: 't', message: 'm' }, canCancel: false,
  },
  images: [],
  maintenanceRequest: { Id: 'mr1', Status: 'DRAFT', EffectiveCategory: 'Electrical', EffectiveUrgency: 'High', ScopeOfWork: 'Fix it' },
  maintenanceReview: null,
  procurementHandoff: null,
  workOrder: null,
  duplicateCandidates: [{ Id: 'd', CandidateReportId: 'r0' }],
  statusHistory: [],
};

/** The page, not the API, decides which review fields are sent; these are the rules from seefix-api maintenance.js. */
describe('ReportDetailPage review decision', () => {
  let http: HttpTestingController;
  let toasts: string[];

  async function setup() {
    toasts = [];
    TestBed.configureTestingModule({
      imports: [ReportDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UiService, useValue: { confirm: async () => true, toast: (m: string) => toasts.push(m), error: () => undefined } },
      ],
    });
    TestBed.inject(SessionService).user.set({ id: 's', role: 'MAINTENANCE_STAFF' } as never);
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReportDetailPage);
    fixture.componentRef.setInput('id', 'r1');
    fixture.detectChanges();
    http.expectOne('/api/reference/categories').flush({ items: [{ code: 'E', name: 'Electrical' }, { code: 'P', name: 'Plumbing' }] });
    http.expectOne('/api/reports/r1').flush(DETAIL);
    await fixture.whenStable();
    fixture.detectChanges(); // runs the effect that pre-fills the form from the AI draft
    return fixture.componentInstance;
  }

  async function submitAndCapture(page: ReportDetailPage) {
    const done = page.submitReview();
    await new Promise((r) => setTimeout(r));
    const req = http.expectOne('/api/maintenance/reports/r1/review');
    req.flush({ nextStep: { type: 'NONE', automatic: false } });
    await new Promise((r) => setTimeout(r));
    http.expectOne('/api/reports/r1').flush(DETAIL); // always re-reads server state after a write
    await done;
    return req.request.body;
  }

  it('INTERNAL without changes sends the AI category/urgency and no override or draft edits', async () => {
    const page = await setup();
    page.form.patchValue({ decision: 'INTERNAL' });
    expect(await submitAndCapture(page)).toEqual({ decision: 'INTERNAL', notes: undefined, finalCategory: 'Electrical', finalUrgency: 'High' });
  });

  it('requires an override reason when category or urgency changes, then sends only edited draft fields', async () => {
    const page = await setup();
    page.form.patchValue({ decision: 'PROCUREMENT', finalUrgency: 'Critical', scopeOfWork: 'Replace panel' });
    await page.submitReview();
    expect(toasts.at(-1)).toContain('reason');
    http.expectNone('/api/maintenance/reports/r1/review');

    page.form.patchValue({ overrideReason: 'Exposed live wires' });
    expect(await submitAndCapture(page)).toEqual({
      decision: 'PROCUREMENT', notes: undefined, finalCategory: 'Electrical', finalUrgency: 'Critical',
      overrideReason: 'Exposed live wires', scopeOfWork: 'Replace panel',
    });
  });

  it('DUPLICATE needs a reason and the original report id', async () => {
    const page = await setup();
    page.form.patchValue({ decision: 'DUPLICATE', decisionReason: 'Same leak' });
    await page.submitReview();
    expect(toasts.at(-1)).toContain('original report');
    page.form.patchValue({ duplicateReportId: 'r0' });
    expect(await submitAndCapture(page)).toEqual({ decision: 'DUPLICATE', notes: undefined, decisionReason: 'Same leak', duplicateReportId: 'r0' });
  });
});
