import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, firstValueFrom } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { Row } from '@app/core/models/api.model';
import { PROCUREMENT_ACTORS, SUPERVISOR } from '@app/core/models/user.model';
import { load } from '@app/core/utils/load';
import { UiService } from '@app/shared/services/ui.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { DOCUMENT_TYPES, EXECUTION_TYPES } from '../../procurement.models';
import { ProcurementService } from '../../procurement.service';

@Component({
  selector: 'app-handoff-detail-page',
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatExpansionModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, ...SHARED_IMPORTS,
  ],
  templateUrl: './handoff-detail.page.html',
  styleUrl: './handoff-detail.page.scss',
})
export class HandoffDetailPage {
  private readonly procurement = inject(ProcurementService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  readonly session = inject(SessionService);
  readonly id = input.required<string>();
  readonly documentTypes = DOCUMENT_TYPES;
  readonly executionTypes = EXECUTION_TYPES;

  readonly data = load(() => this.procurement.handoff(this.id()));
  readonly busy = signal(false);
  readonly file = signal<File | null>(null);

  readonly h = computed(() => this.data.value()?.handoff ?? null);
  readonly status = computed(() => this.h()?.['Status'] as string | undefined);
  readonly isActor = computed(() => this.session.has(...PROCUREMENT_ACTORS));
  readonly isSupervisor = computed(() => this.session.has(...SUPERVISOR));
  readonly open = computed(() => !['COMPLETED', 'CANCELLED'].includes(this.status() ?? ''));
  readonly openClarifications = computed(() => (this.data.value()?.clarifications ?? []).filter((c) => c['Status'] === 'OPEN').length);

  readonly startForm = this.fb.group({ externalSystemReference: [''], externalSystemUrl: [''] });
  readonly docForm = this.fb.group({ documentType: ['PROCUREMENT_REFERENCE'], clarificationId: [''] });
  readonly outcomeForm = this.fb.group({
    executionType: ['CONTRACTOR', Validators.required],
    assignedPartyName: ['', Validators.required],
    responsibleLeadName: ['', Validators.required],
    responsibleLeadContact: [''],
    responsibleLeadEmail: ['', Validators.email],
    procurementReferenceNo: [''],
    plannedStartAt: [''],
    plannedDeadlineAt: [''],
    agreedDurationDays: [null as number | null, Validators.min(0)],
    plannedCrewSize: [null as number | null, Validators.min(0)],
    referenceDocumentId: [''],
    notes: [''],
  });

  async acknowledge(): Promise<void> {
    if (!(await this.ui.confirm({ title: 'Acknowledge handoff?', message: 'Confirms Procurement has received this request.', confirm: 'Acknowledge' }))) return;
    await this.run(() => this.procurement.acknowledge(this.id()), 'Handoff acknowledged.');
  }

  async start(): Promise<void> {
    const v = this.startForm.getRawValue();
    await this.run(
      () => this.procurement.start(this.id(), { externalSystemReference: v.externalSystemReference || null, externalSystemUrl: v.externalSystemUrl || null }),
      'Marked in process.',
    );
  }

  async askClarification(): Promise<void> {
    const question = await this.ui.confirm({
      title: 'Request technical clarification',
      message: 'The Maintenance Supervisor is notified. Recording the outcome is blocked until every clarification is answered.',
      confirm: 'Send question',
      input: { label: 'Question', required: true },
    });
    if (typeof question !== 'string') return;
    await this.run(() => this.procurement.askClarification(this.id(), question), 'Clarification requested.');
  }

  async respond(c: Row): Promise<void> {
    const response = await this.ui.confirm({
      title: 'Respond to clarification',
      message: `Q: ${c['Question']}${c['AiResponseDraft'] ? '\n\nAI draft (advisory, edit before sending):\n' + c['AiResponseDraft'] : ''}`,
      confirm: 'Send response',
      input: { label: 'Your response', required: true },
    });
    if (typeof response !== 'string') return;
    await this.run(() => this.procurement.answerClarification(c['Id'], response), 'Response sent.');
  }

  pickFile(input: HTMLInputElement): void {
    this.file.set(input.files?.[0] ?? null);
  }

  async upload(input: HTMLInputElement): Promise<void> {
    const file = this.file();
    if (!file) return this.ui.toast('Choose a file first.');
    if (file.size > 10 * 1024 * 1024) return this.ui.toast('Files must be 10 MB or smaller.');
    const v = this.docForm.getRawValue();
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('documentType', v.documentType ?? 'OTHER');
    if (v.clarificationId) form.append('clarificationId', v.clarificationId);
    await this.run(() => this.procurement.uploadDocument(this.id(), form), 'Document uploaded.', () => {
      this.file.set(null);
      input.value = '';
    });
  }

  async recordOutcome(): Promise<void> {
    if (this.outcomeForm.invalid) return this.outcomeForm.markAllAsTouched();
    if (this.openClarifications()) return this.ui.toast('Answer all open clarifications first.');
    const v = this.outcomeForm.getRawValue();
    const ok = await this.ui.confirm({
      title: 'Record final outcome?',
      message: `This completes the handoff and creates a Work Order for ${v.assignedPartyName}, ready for Maintenance dispatch.`,
      confirm: 'Record outcome',
    });
    if (!ok) return;
    const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== null));
    await this.run(() => this.procurement.recordOutcome(this.id(), body), 'Outcome recorded. Work Order created.');
  }

  private async run(call: () => Observable<unknown>, done: string, after?: () => void): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(call());
      this.ui.toast(done);
      after?.();
    } catch (e) {
      this.ui.error(e);
    } finally {
      this.busy.set(false);
      await this.data.reload();
    }
  }
}
