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

  const UPLOAD_URL = 'https://api.cloudinary.com/v1_1/demo/auto/upload';

  /** Answers the sign request and each Cloudinary upload; returns the upload requests. */
  async function directUploads(purpose: string, results: { public_id: string; resource_type: string }[]) {
    const sign = http.expectOne('/api/uploads/sign');
    expect(sign.request.body).toEqual({ purpose });
    sign.flush({ uploadUrl: UPLOAD_URL, fields: { timestamp: 1, signature: 'sig', api_key: 'k' } });
    const sent = [];
    for (const result of results) {
      await Promise.resolve();
      const upload = http.expectOne(UPLOAD_URL);
      expect((upload.request.body as FormData).get('signature')).toBe('sig');
      expect(upload.request.headers.has('Authorization')).toBe(false);
      upload.flush(result);
      sent.push(upload.request);
    }
    await Promise.resolve();
    return sent;
  }

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

  it('work orders: assign, status, completion via direct upload, supervisor accept/rework', async () => {
    const w = TestBed.inject(WorkOrdersService);
    const assign = { assignedPartyName: 'Team A', responsibleLeadUserId: 'u1', responsibleLeadName: null, responsibleLeadContact: null, responsibleLeadEmail: null };
    expect((await call(firstValueFrom(w.assign('w1', assign)), 'POST', '/api/work-orders/w1/assign')).body).toEqual(assign);
    expect((await call(firstValueFrom(w.setStatus('w1', 'ON_HOLD', 'waiting')), 'POST', '/api/work-orders/w1/status')).body).toEqual({
      status: 'ON_HOLD',
      message: 'waiting',
    });

    const images = [new File(['x'], 'a.jpg', { type: 'image/jpeg' }), new File(['y'], 'b.png', { type: 'image/png' })];
    const done = firstValueFrom(w.submitCompletion('w1', images, { repairNotes: 'Replaced breaker' }));
    const uploads = await directUploads('completion-image', [
      { public_id: 'img-a', resource_type: 'image' },
      { public_id: 'img-b', resource_type: 'image' },
    ]);
    expect(uploads.map((u) => ((u.body as FormData).get('file') as File).name)).toEqual(['a.jpg', 'b.png']);
    const sent = await call(done, 'POST', '/api/work-orders/w1/completion');
    expect(sent.body).toEqual({ repairNotes: 'Replaced breaker', imagePublicIds: ['img-a', 'img-b'] });

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
    const doc = new File(['%PDF'], 'po.pdf', { type: 'application/pdf' });
    const uploaded = firstValueFrom(p.uploadDocument('h1', doc, { documentType: 'PROCUREMENT_REFERENCE' }));
    await directUploads('procurement-document', [{ public_id: 'doc-1', resource_type: 'raw' }]);
    expect((await call(uploaded, 'POST', '/api/procurement/handoffs/h1/documents')).body).toEqual({
      documentType: 'PROCUREMENT_REFERENCE',
      publicId: 'doc-1',
      resourceType: 'raw',
      fileName: 'po.pdf',
      mimeType: 'application/pdf',
    });
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
