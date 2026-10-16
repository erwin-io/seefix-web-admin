import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { WorkOrderDetailPage } from './work-order-detail.page';

describe('WorkOrderDetailPage completion assessment', () => {
  it('turns the stored AI assessment into readable rows', () => {
    TestBed.configureTestingModule({
      imports: [WorkOrderDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(WorkOrderDetailPage);
    fixture.componentRef.setInput('id', 'wo1');
    const page = fixture.componentInstance;

    // Shape written by seefix-agents (CompletionAssessmentResult) and returned by GET /completion-status.
    page.completion.value.set({
      assessment: {
        visual_result: 'VISIBLE_IMPROVEMENT',
        model_response: { summary: 'Debris removed.', observed_changes: [], limitations: ['Images cannot establish hidden repair quality.'] },
        planned_vs_actual: {
          durationDays: { label: 'Duration days', planned: 10, actual: 11, difference: 1 },
          crewSize: { label: 'Crew size', planned: null, actual: 4, difference: null },
          plannedMaterialCount: 2,
          actualMaterialCount: 1,
        },
      },
    });

    expect(page.assessment()?.model_response?.summary).toBe('Debris removed.');
    expect(page.plannedVsActual()).toEqual([
      { label: 'Duration days', planned: 10, actual: 11, difference: 1 },
      { label: 'Crew size', planned: null, actual: 4, difference: null },
      { label: 'Material items', planned: 2, actual: 1, difference: -1 },
    ]);
  });
});

describe('WorkOrderDetailPage reassign form', () => {
  const assigned = (lead: string, id: string) => ({
    workOrder: {
      Id: 'wo1', WorkOrderNo: 'WO-2026-000010', Status: 'ASSIGNED', AssignedPartyName: 'Worker',
      ResponsibleLeadUserId: id, ResponsibleLeadName: lead, ResponsibleLeadContact: null, ResponsibleLeadEmail: 'lead@seefix.local',
    },
    assignments: [], people: [], materials: [], images: [], updates: [],
  });

  function setup() {
    TestBed.configureTestingModule({
      imports: [WorkOrderDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(SessionService).user.set({ id: 's', role: 'MAINTENANCE_STAFF' } as never);
    const fixture = TestBed.createComponent(WorkOrderDetailPage);
    fixture.componentRef.setInput('id', 'wo1');
    return { fixture, page: fixture.componentInstance };
  }

  it('shows the saved assignment when the page loads (no need to press Use current)', () => {
    const { fixture, page } = setup();
    page.data.value.set(assigned('Acceptance Worker B', 'u-b') as never);
    fixture.detectChanges();
    expect(page.assignForm.getRawValue()).toMatchObject({
      assignedPartyName: 'Worker', responsibleLeadUserId: 'u-b', responsibleLeadName: 'Acceptance Worker B', responsibleLeadEmail: 'lead@seefix.local',
    });
    expect(page.assignForm.pristine).toBe(true);
  });

  it('a refresh never overwrites a reassignment being typed; a pristine form follows the server', () => {
    const { fixture, page } = setup();
    page.data.value.set(assigned('Acceptance Worker B', 'u-b') as never);
    fixture.detectChanges();
    page.assignForm.controls.assignedPartyName.setValue('Contractor X');
    page.assignForm.markAsDirty();
    page.data.value.set(assigned('Someone Else', 'u-c') as never);
    fixture.detectChanges();
    expect(page.assignForm.controls.assignedPartyName.value).toBe('Contractor X'); // edit kept
    page.assignForm.markAsPristine(); // e.g. after a successful reassign
    page.data.value.set(assigned('Someone Else', 'u-c') as never);
    fixture.detectChanges();
    expect(page.assignForm.getRawValue()).toMatchObject({ assignedPartyName: 'Worker', responsibleLeadUserId: 'u-c' });
  });
});
