import { DatePipe, JsonPipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { Observable, firstValueFrom } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { MAINTENANCE, SUPERVISOR } from '@app/core/models/user.model';
import { load } from '@app/core/utils/load';
import { humanize } from '@app/shared/pipes/humanize.pipe';
import { UiService } from '@app/shared/services/ui.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { AssignableUser, COMPLETION_UPLOAD, NEXT_STATUS } from '../../work-orders.models';
import { WorkOrdersService } from '../../work-orders.service';

const { maxFiles: MAX_FILES, maxBytes: MAX_BYTES, types: IMAGE_TYPES } = COMPLETION_UPLOAD;

@Component({
  selector: 'app-work-order-detail-page',
  imports: [
    DatePipe, JsonPipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatExpansionModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule, MatSelectModule, ...SHARED_IMPORTS,
  ],
  templateUrl: './work-order-detail.page.html',
  styleUrl: './work-order-detail.page.scss',
})
export class WorkOrderDetailPage implements OnDestroy {
  private readonly workOrders = inject(WorkOrdersService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  readonly session = inject(SessionService);
  readonly id = input.required<string>();

  readonly data = load(() => this.workOrders.get(this.id()));
  readonly completion = load(() => this.workOrders.completionStatus(this.id()));
  readonly assignees = signal<AssignableUser[]>([]);
  readonly busy = signal(false);
  readonly files = signal<{ file: File; url: string }[]>([]);

  readonly wo = computed(() => this.data.value()?.workOrder ?? null);
  readonly status = computed(() => this.wo()?.['Status'] as string | undefined);
  readonly isStaff = computed(() => this.session.has(...MAINTENANCE));
  readonly isSupervisor = computed(() => this.session.has(...SUPERVISOR));
  readonly closed = computed(() => ['COMPLETED', 'CANCELLED'].includes(this.status() ?? ''));
  readonly canAssign = computed(() => this.isStaff() && ['PENDING_ASSIGNMENT', 'ASSIGNED'].includes(this.status() ?? ''));
  readonly nextStatuses = computed(() => NEXT_STATUS[this.status() ?? ''] ?? []);
  readonly completionPhotos = computed(() =>
    (this.data.value()?.images ?? []).filter((i) => i['ImageType'] === 'COMPLETION').map((i) => i['SecureUrl'] as string),
  );
  readonly otherPhotos = computed(() =>
    (this.data.value()?.images ?? []).filter((i) => i['ImageType'] !== 'COMPLETION').map((i) => i['SecureUrl'] as string),
  );

  readonly assignForm = this.fb.group({
    assignedPartyName: ['', Validators.required],
    responsibleLeadUserId: [''],
    responsibleLeadName: [''],
    responsibleLeadContact: [''],
    responsibleLeadEmail: ['', Validators.email],
    reason: [''],
  });
  readonly updateForm = this.fb.group({
    message: ['', Validators.required],
    updateType: ['PROGRESS'],
    progressPercent: [null as number | null, [Validators.min(0), Validators.max(100)]],
  });
  readonly personForm = this.fb.group({
    fullName: ['', Validators.required],
    roleOrTrade: [''],
    contact: [''],
    isLead: [false],
    notes: [''],
  });
  readonly materialForm = this.fb.group({
    materialName: ['', Validators.required],
    unit: [''],
    quantity: [null as number | null, Validators.min(0)],
    stage: ['ACTUAL'],
    notes: [''],
  });
  readonly completionForm = this.fb.group({
    repairNotes: ['', Validators.required],
    actualLaborHours: [null as number | null, Validators.min(0)],
    actualCrewSize: [null as number | null, Validators.min(0)],
    actualDurationDays: [null as number | null, Validators.min(0)],
    actualMaterialsNotes: [''],
  });

  constructor() {
    if (this.isStaff()) {
      firstValueFrom(this.workOrders.assignableUsers()).then(
        (r) => this.assignees.set(r.items),
        () => undefined,
      );
    }
  }

  ngOnDestroy(): void {
    this.files().forEach((f) => URL.revokeObjectURL(f.url));
  }

  prefillAssign(): void {
    const w = this.wo();
    if (!w) return;
    this.assignForm.patchValue({
      assignedPartyName: w['AssignedPartyName'] ?? 'SEEFIX Maintenance',
      responsibleLeadUserId: w['ResponsibleLeadUserId'] ?? '',
      responsibleLeadName: w['ResponsibleLeadName'] ?? '',
      responsibleLeadContact: w['ResponsibleLeadContact'] ?? '',
      responsibleLeadEmail: w['ResponsibleLeadEmail'] ?? '',
    });
  }

  pickLead(id: string): void {
    const u = this.assignees().find((x) => x.id === id);
    if (u) this.assignForm.patchValue({ responsibleLeadName: u.fullName, responsibleLeadEmail: u.email, responsibleLeadContact: u.phone ?? '' });
  }

  async assign(): Promise<void> {
    const v = this.assignForm.getRawValue();
    if (this.assignForm.invalid) return this.assignForm.markAllAsTouched();
    if (!v.responsibleLeadUserId && !v.responsibleLeadName?.trim()) return this.ui.toast('Pick a responsible lead or enter a lead name.');
    const ok = await this.ui.confirm({
      title: this.status() === 'ASSIGNED' ? 'Reassign work order?' : 'Dispatch work order?',
      message: `${this.wo()?.['WorkOrderNo']} will be assigned to ${v.assignedPartyName} (lead: ${v.responsibleLeadName || 'selected user'}).`,
      confirm: 'Assign',
    });
    if (!ok) return;
    await this.run(
      () =>
        this.workOrders.assign(this.id(), {
          assignedPartyName: v.assignedPartyName ?? '',
          responsibleLeadUserId: v.responsibleLeadUserId || null,
          responsibleLeadName: v.responsibleLeadName || null,
          responsibleLeadContact: v.responsibleLeadContact || null,
          responsibleLeadEmail: v.responsibleLeadEmail || null,
          reason: v.reason || undefined,
        }),
      'Work order assigned.',
    );
  }

  async start(): Promise<void> {
    if (!(await this.ui.confirm({ title: 'Start work?', message: 'Status changes to In progress and the reporter is notified.', confirm: 'Start' }))) return;
    await this.run(() => this.workOrders.start(this.id()), 'Work started.');
  }

  async setStatus(target: string): Promise<void> {
    const message = await this.ui.confirm({
      title: `Set status: ${humanize(target)}`,
      message: 'Add a short note for the activity log.',
      confirm: 'Update status',
      input: { label: 'Note', required: false },
    });
    if (message === false) return;
    await this.run(
      () => this.workOrders.setStatus(this.id(), target, message === true ? '' : message),
      'Status updated.',
    );
  }

  async addUpdate(): Promise<void> {
    if (this.updateForm.invalid) return this.updateForm.markAllAsTouched();
    const v = this.updateForm.getRawValue();
    await this.run(() => this.workOrders.addUpdate(this.id(), v), 'Update added.', () => this.updateForm.reset({ updateType: 'PROGRESS' }));
  }

  async addPerson(): Promise<void> {
    if (this.personForm.invalid) return this.personForm.markAllAsTouched();
    await this.run(() => this.workOrders.addPerson(this.id(), this.personForm.getRawValue()), 'Crew member added.', () =>
      this.personForm.reset({ isLead: false }),
    );
  }

  async addMaterial(): Promise<void> {
    if (this.materialForm.invalid) return this.materialForm.markAllAsTouched();
    await this.run(() => this.workOrders.addMaterial(this.id(), this.materialForm.getRawValue()), 'Material recorded.', () =>
      this.materialForm.reset({ stage: 'ACTUAL' }),
    );
  }

  addFiles(input: HTMLInputElement): void {
    const picked = Array.from(input.files ?? []);
    input.value = '';
    const bad = picked.find((f) => !IMAGE_TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) return this.ui.toast(`${bad.name}: use JPEG, PNG or WebP up to 10 MB.`);
    const next = [...this.files(), ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))];
    if (next.length > MAX_FILES) {
      next.slice(MAX_FILES).forEach((f) => URL.revokeObjectURL(f.url));
      this.ui.toast(`Up to ${MAX_FILES} photos.`);
    }
    this.files.set(next.slice(0, MAX_FILES));
  }

  removeFile(i: number): void {
    URL.revokeObjectURL(this.files()[i].url);
    this.files.update((list) => list.filter((_, j) => j !== i));
  }

  async submitCompletion(): Promise<void> {
    if (!this.files().length) return this.ui.toast('Add at least one completion photo.');
    if (this.completionForm.invalid) return this.completionForm.markAllAsTouched();
    const ok = await this.ui.confirm({
      title: 'Submit completion?',
      message: 'Photos and notes go to the Maintenance Supervisor for acceptance. The AI completion check is advisory.',
      confirm: 'Submit completion',
    });
    if (!ok) return;
    const form = new FormData();
    this.files().forEach((f) => form.append('images', f.file, f.file.name));
    for (const [k, v] of Object.entries(this.completionForm.getRawValue())) if (v !== null && v !== '') form.append(k, String(v));
    await this.run(() => this.workOrders.submitCompletion(this.id(), form), 'Completion submitted.', () => {
      this.files().forEach((f) => URL.revokeObjectURL(f.url));
      this.files.set([]);
      this.completionForm.reset();
    });
  }

  async accept(): Promise<void> {
    const ok = await this.ui.confirm({
      title: 'Accept completion?',
      message: 'The work order closes as Completed and the report is Resolved. This is the final human acceptance.',
      confirm: 'Accept & close',
    });
    if (!ok) return;
    await this.run(() => this.workOrders.accept(this.id()), 'Completion accepted.');
  }

  async rework(): Promise<void> {
    const reason = await this.ui.confirm({
      title: 'Return for rework?',
      message: 'The responsible lead is notified and must resume the work.',
      confirm: 'Request rework',
      danger: true,
      input: { label: 'Rework reason', required: true },
    });
    if (typeof reason !== 'string') return;
    await this.run(() => this.workOrders.rework(this.id(), reason), 'Rework requested.');
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
      await Promise.all([this.data.reload(), this.completion.reload()]);
    }
  }
}
