import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
