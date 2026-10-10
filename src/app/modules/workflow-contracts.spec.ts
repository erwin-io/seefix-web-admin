import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AdminService } from './admin/admin.service';
import { MaintenanceService } from './maintenance/maintenance.service';
import { ProcurementService } from './procurement/procurement.service';
import { WorkOrdersService } from './work-orders/work-orders.service';

/** HTTP contract: method, path and body shape each mutation sends to seefix-api. */
describe('workflow API contracts', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function call(req: Promise<unknown>, method: string, url: string, respond: object = {}) {
    const t = http.expectOne((r) => r.url === url);
    expect(t.request.method).toBe(method);
    t.flush(respond);
    await req;
    return t.request;
  }

  it('maintenance: review decision, draft regenerate, queue triage', async () => {
    const m = TestBed.inject(MaintenanceService);
    const body = { decision: 'NO_ACTION', decisionReason: 'Not a defect' };
    const r = await call(firstValueFrom(m.submitReview('r1', body)), 'POST', '/api/maintenance/reports/r1/review');
    expect(r.body).toEqual(body);
    await call(firstValueFrom(m.regenerateDraft('r1')), 'POST', '/api/maintenance/reports/r1/maintenance-request/regenerate');
    const q = await call(firstValueFrom(m.reviewQueue('screening')), 'GET', '/api/maintenance/review-queue', { items: [] });
    expect(q.params.get('triage')).toBe('screening');
    const list = await call(firstValueFrom(m.reports('all', null)), 'GET', '/api/maintenance/reports', { items: [] });
    expect(list.params.has('status')).toBe(false);
  });

  it('work orders: assign, status, completion multipart, supervisor accept/rework', async () => {
    const w = TestBed.inject(WorkOrdersService);
    const assign = { assignedPartyName: 'Team A', responsibleLeadUserId: 'u1', responsibleLeadName: null, responsibleLeadContact: null, responsibleLeadEmail: null };
    expect((await call(firstValueFrom(w.assign('w1', assign)), 'POST', '/api/work-orders/w1/assign')).body).toEqual(assign);
    expect((await call(firstValueFrom(w.setStatus('w1', 'ON_HOLD', 'waiting')), 'POST', '/api/work-orders/w1/status')).body).toEqual({
      status: 'ON_HOLD',
      message: 'waiting',
    });

    const form = new FormData();
    form.append('images', new Blob(['x'], { type: 'image/jpeg' }), 'a.jpg');
    form.append('images', new Blob(['y'], { type: 'image/png' }), 'b.png');
    form.append('repairNotes', 'Replaced breaker');
    const sent = (await call(firstValueFrom(w.submitCompletion('w1', form)), 'POST', '/api/work-orders/w1/completion')).body as FormData;
    expect(sent.getAll('images')).toHaveLength(2);
    expect(sent.get('repairNotes')).toBe('Replaced breaker');

    await call(firstValueFrom(w.accept('w1')), 'POST', '/api/maintenance/work-orders/w1/complete');
    expect((await call(firstValueFrom(w.rework('w1', 'Leak remains')), 'POST', '/api/maintenance/work-orders/w1/rework')).body).toEqual({
      reason: 'Leak remains',
    });
  });

  it('procurement: clarification, supervisor answer, document upload, outcome', async () => {
    const p = TestBed.inject(ProcurementService);
    expect((await call(firstValueFrom(p.askClarification('h1', 'Which brand?')), 'POST', '/api/procurement/handoffs/h1/clarifications')).body).toEqual({
      question: 'Which brand?',
    });
    expect(
      (await call(firstValueFrom(p.answerClarification('c1', 'Any UL-listed')), 'POST', '/api/maintenance/procurement/clarifications/c1/respond')).body,
    ).toEqual({ response: 'Any UL-listed' });
    const doc = new FormData();
    doc.append('file', new Blob(['%PDF'], { type: 'application/pdf' }), 'po.pdf');
    doc.append('documentType', 'PROCUREMENT_REFERENCE');
    const up = (await call(firstValueFrom(p.uploadDocument('h1', doc)), 'POST', '/api/procurement/handoffs/h1/documents')).body as FormData;
    expect(up.get('documentType')).toBe('PROCUREMENT_REFERENCE');
    const outcome = { executionType: 'CONTRACTOR', assignedPartyName: 'ACME', responsibleLeadName: 'Jo' };
    expect((await call(firstValueFrom(p.recordOutcome('h1', outcome)), 'POST', '/api/procurement/handoffs/h1/outcome')).body).toEqual(outcome);
  });

  it('admin: create user and replace category links', async () => {
    const a = TestBed.inject(AdminService);
    const user = { fullName: 'Wes', email: 'w@x.test', role: 'WORKER' as const, password: 'longenough' };
    expect((await call(firstValueFrom(a.createUser(user)), 'POST', '/api/admin/users')).body).toEqual(user);
    const skills = [{ code: 'ELEC', name: 'Electrical', description: null, minimumProficiencyLevel: 2, isRequired: true, isLeadSkill: true, notes: null }];
    const put = await call(firstValueFrom(a.replaceSkills('ELECTRICAL', skills)), 'PUT', '/api/admin/knowledge/categories/ELECTRICAL/skills');
    expect(put.body).toEqual({ skills });
  });
});
