import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { Observable, firstValueFrom } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { MAINTENANCE } from '@app/core/models/user.model';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { humanize } from '@app/shared/pipes/humanize.pipe';
import { UiService } from '@app/shared/services/ui.service';
import { CategoryRef, Decision, URGENCIES } from '../../maintenance.models';
import { MaintenanceService } from '../../maintenance.service';

const RISKS: [string, string][] = [
  ['RiskImmediateDanger', 'Immediate danger'],
  ['RiskElectricalExposure', 'Electrical exposure'],
  ['RiskFireOrSmokeIndicator', 'Fire or smoke'],
  ['RiskStructuralInstabilityIndicator', 'Structural instability'],
  ['RiskActiveFlooding', 'Active flooding'],
  ['RiskBlockedAccessOrExit', 'Blocked access/exit'],
  ['RiskPublicAccessExposure', 'Public exposure'],
];

/** Draft fields a reviewer may edit; only changed ones are sent. */
const DRAFT_FIELDS = [
  ['requiredService', 'RequiredService', 'Required service'],
  ['requiredCapability', 'RequiredCapability', 'Required capability'],
  ['scopeOfWork', 'ScopeOfWork', 'Scope of work'],
  ['safetyRequirements', 'SafetyRequirements', 'Safety requirements'],
] as const;

@Component({
  selector: 'app-report-detail-page',
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatRadioModule, MatSelectModule, ...SHARED_IMPORTS,
  ],
  templateUrl: './report-detail.page.html',
  styleUrl: './report-detail.page.scss',
})
export class ReportDetailPage {
  private readonly maintenance = inject(MaintenanceService);
  private readonly ui = inject(UiService);
  readonly session = inject(SessionService);
  readonly id = input.required<string>();

  readonly data = load(() => this.maintenance.report(this.id()));
  readonly categories = signal<CategoryRef[]>([]);
  /** Set when GET /api/reference/categories is unavailable (requires seefix-api web-admin support). */
  readonly categoriesError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly urgencies = URGENCIES;
  readonly draftFields = DRAFT_FIELDS;

  readonly r = computed(() => this.data.value()?.report ?? null);
  readonly mr = computed(() => this.data.value()?.maintenanceRequest ?? null);
  readonly isStaff = computed(() => this.session.has(...MAINTENANCE));
  readonly risks = computed(() => RISKS.filter(([k]) => this.r()?.[k]).map(([, label]) => label));
  readonly photos = computed(() => this.data.value()?.images.map((i) => i.secureUrl) ?? []);
  readonly facility = computed(() => this.r()?.['ScopeDecision'] === 'Facility Issue');
  /** Server checks everything again; this only decides whether to show the form. */
  readonly canReview = computed(
    () => this.isStaff() && this.r()?.['Status'] === 'PENDING_REVIEW' && this.r()?.['AgentStatus'] === 'COMPLETED',
  );
  readonly canRoute = computed(() => this.facility() && this.mr()?.['Status'] === 'DRAFT');
  readonly canRegenerate = computed(
    () => this.isStaff() && this.facility() && this.r()?.['AgentStatus'] === 'COMPLETED' && (!this.mr() || this.mr()?.['Status'] === 'DRAFT'),
  );

  readonly form = inject(FormBuilder).group({
    decision: ['' as Decision | '', Validators.required],
    finalCategory: [''],
    finalUrgency: [''],
    overrideReason: [''],
    decisionReason: [''],
    duplicateReportId: [''],
    notes: [''],
    requiredService: [''],
    requiredCapability: [''],
    scopeOfWork: [''],
    safetyRequirements: [''],
  });
  readonly decision = signal<Decision | ''>('');

  constructor() {
    this.form.controls.decision.valueChanges.subscribe((d) => this.decision.set(d ?? ''));
    // Prefill from the Agent draft each time the report (re)loads.
    effect(() => {
      const r = this.r();
      if (!r) return;
      const mr = this.mr();
      this.form.patchValue({
        finalCategory: mr?.['EffectiveCategory'] ?? r['AiCategory'] ?? '',
        finalUrgency: mr?.['EffectiveUrgency'] ?? r['AiRecommendedUrgency'] ?? '',
        ...Object.fromEntries(DRAFT_FIELDS.map(([k, col]) => [k, mr?.[col] ?? ''])),
      });
    });
    firstValueFrom(this.maintenance.categories()).then(
      (r) => this.categories.set(r.items),
      () => this.categoriesError.set('Category list unavailable; only the AI category can be kept.'),
    );
  }

  overridden(): boolean {
    const r = this.r();
    const v = this.form.value;
    return !!r && (v.finalCategory !== r['AiCategory'] || v.finalUrgency !== r['AiRecommendedUrgency']);
  }

  async regenerate(): Promise<void> {
    const ok = await this.ui.confirm({
      title: 'Regenerate AI draft?',
      message: 'The Agent will rebuild the Maintenance Request DRAFT from the assessment. This is advisory; nothing is approved.',
      confirm: 'Regenerate',
    });
    if (!ok) return;
    await this.run(() => this.maintenance.regenerateDraft(this.id()), 'AI draft regenerated.');
  }

  async submitReview(): Promise<void> {
    const v = this.form.getRawValue();
    const decision = v.decision as Decision;
    const err = this.validate(decision);
    if (err) return this.ui.toast(err);

    const body: Record<string, unknown> = { decision, notes: v.notes || undefined };
    if (decision === 'INTERNAL' || decision === 'PROCUREMENT') {
      body['finalCategory'] = v.finalCategory;
      body['finalUrgency'] = v.finalUrgency;
      if (this.overridden()) body['overrideReason'] = v.overrideReason;
      for (const [k, col] of DRAFT_FIELDS) if ((v[k] ?? '') !== (this.mr()?.[col] ?? '')) body[k] = v[k] || null;
    } else {
      body['decisionReason'] = v.decisionReason;
      if (decision === 'DUPLICATE') body['duplicateReportId'] = v.duplicateReportId?.trim();
    }

    const ok = await this.ui.confirm({
      title: `Confirm decision: ${humanize(decision)}`,
      message: `${this.r()?.['ReportNo']} will be ${CONSEQUENCE[decision]}. This human decision is recorded and cannot be undone here.`,
      confirm: 'Submit decision',
      danger: decision === 'NO_ACTION' || decision === 'DUPLICATE',
    });
    if (!ok) return;
    await this.run(
      () => this.maintenance.submitReview(this.id(), body),
      'Review decision recorded.',
    );
  }

  private validate(d: Decision): string | null {
    const v = this.form.getRawValue();
    if (!d) return 'Choose a decision.';
    if ((d === 'INTERNAL' || d === 'PROCUREMENT') && !this.canRoute()) return 'Routing needs a Facility Issue with an AI Maintenance Request draft.';
    if ((d === 'INTERNAL' || d === 'PROCUREMENT') && this.overridden() && !v.overrideReason?.trim())
      return 'Give a reason for changing the AI category or urgency.';
    if ((d === 'NO_ACTION' || d === 'DUPLICATE') && !v.decisionReason?.trim()) return 'A decision reason is required.';
    if (d === 'DUPLICATE' && !v.duplicateReportId?.trim()) return 'Select the original report this duplicates.';
    return null;
  }

  private async run(call: () => Observable<unknown>, done: string): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(call());
      this.ui.toast(done);
      this.form.controls.decision.reset('');
    } catch (e) {
      this.ui.error(e);
    } finally {
      this.busy.set(false);
      // Always re-read: a 409 means someone else changed the report.
      await this.data.reload();
    }
  }

  yes(v: unknown): string {
    return v === true ? 'Yes' : v === false ? 'No' : '—';
  }

  scroll(): void {
    document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' });
  }
}

const CONSEQUENCE: Record<Decision, string> = {
  INTERNAL: 'routed to INTERNAL maintenance and a Work Order prepared for dispatch',
  PROCUREMENT: 'handed off to Procurement',
  NO_ACTION: 'closed with no maintenance action',
  DUPLICATE: 'closed as a duplicate of the selected report',
};
