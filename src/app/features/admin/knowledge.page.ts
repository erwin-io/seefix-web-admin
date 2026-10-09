import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable, firstValueFrom, forkJoin, of } from 'rxjs';
import { Api } from '../../core/api';
import { load } from '../../core/load';
import { Category, Items, Row, URGENCIES } from '../../core/models';
import { Ui } from '../../core/ui';
import { SHARED } from '../../shared/ui';

const CATEGORY_FIELDS = [
  'description', 'defaultUrgency', 'urgencyGuidance', 'defaultMinHours', 'defaultMaxHours', 'defaultRequiredService',
  'defaultRequiredCapability', 'safetyGuidance', 'preferredTrade', 'requiresMaintenanceReview', 'isActive', 'sortOrder',
] as const;

/** Reference knowledge the Agent uses for drafts. PUT endpoints replace the whole link list. */
@Component({
  selector: 'app-knowledge-page',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatListModule,
    MatSelectModule, MatSlideToggleModule, MatTabsModule, ...SHARED,
  ],
  styles: `
    .layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .cats { padding: 8px 0; max-height: 70vh; overflow: auto; }
    .cats .active { background: var(--sf-accent-soft); }
    .row { display: grid; grid-template-columns: 1fr 1.5fr 0.8fr 0.8fr auto auto auto; gap: 8px; align-items: center; }
    .row.mat { grid-template-columns: 1fr 1.5fr 0.7fr 0.7fr 0.7fr auto auto; }
    @media (max-width: 1200px) { .row, .row.mat { grid-template-columns: 1fr 1fr; } }
    .tab-body { padding-top: 16px; }
  `,
  template: `
    <div class="page-head">
      <div>
        <h1>AI Knowledge</h1>
        <p>Damage categories, required skills and reference materials used to prepare Maintenance Request drafts.</p>
      </div>
    </div>
    <app-state [loading]="cats.loading() && !cats.value()" [error]="cats.value() ? null : cats.error()" (retry)="cats.reload()" />
    @if (cats.value(); as list) {
      <div class="layout">
        <div class="card cats">
          <mat-nav-list>
            @for (c of list.items; track c.code) {
              <a mat-list-item [class.active]="c.code === selected()?.code" (click)="select(c)">
                <span matListItemTitle>{{ c.name }}</span>
                <span matListItemLine>{{ c.code }}{{ c.isActive ? '' : ' · inactive' }}</span>
              </a>
            }
          </mat-nav-list>
        </div>

        @if (selected(); as c) {
          <div class="card">
            <header><h2>{{ c.name }} <span class="muted">({{ c.code }})</span></h2></header>
            <mat-tab-group animationDuration="0">
              <mat-tab label="Category">
                <form [formGroup]="catForm" (ngSubmit)="saveCategory()" class="form-grid tab-body">
                  <mat-form-field class="span-all"><mat-label>Description</mat-label><textarea matInput rows="2" formControlName="description"></textarea></mat-form-field>
                  <mat-form-field>
                    <mat-label>Default urgency</mat-label>
                    <mat-select formControlName="defaultUrgency">
                      <mat-option [value]="null">None</mat-option>
                      @for (u of urgencies; track u) {
                        <mat-option [value]="u">{{ u }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field><mat-label>Default min hours</mat-label><input matInput type="number" formControlName="defaultMinHours" /></mat-form-field>
                  <mat-form-field><mat-label>Default max hours</mat-label><input matInput type="number" formControlName="defaultMaxHours" /></mat-form-field>
                  <mat-form-field><mat-label>Sort order</mat-label><input matInput type="number" formControlName="sortOrder" /></mat-form-field>
                  <mat-form-field><mat-label>Required service</mat-label><input matInput formControlName="defaultRequiredService" /></mat-form-field>
                  <mat-form-field><mat-label>Required capability</mat-label><input matInput formControlName="defaultRequiredCapability" /></mat-form-field>
                  <mat-form-field><mat-label>Preferred trade</mat-label><input matInput formControlName="preferredTrade" /></mat-form-field>
                  <mat-form-field class="span-all"><mat-label>Urgency guidance</mat-label><textarea matInput rows="2" formControlName="urgencyGuidance"></textarea></mat-form-field>
                  <mat-form-field class="span-all"><mat-label>Safety guidance</mat-label><textarea matInput rows="2" formControlName="safetyGuidance"></textarea></mat-form-field>
                  <mat-slide-toggle formControlName="requiresMaintenanceReview">Requires maintenance review</mat-slide-toggle>
                  <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
                  <div class="span-all" style="margin-top: 12px"><button mat-flat-button type="submit" [disabled]="busy() || catForm.pristine">Save category</button></div>
                </form>
              </mat-tab>

              <mat-tab label="Skills">
                <div class="tab-body">
                  <app-state [loading]="links.loading()" [error]="links.error()" (retry)="links.reload()" />
                  @for (g of skills.controls; track g; let i = $index) {
                    <div class="row" [formGroup]="g">
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Code</mat-label><input matInput formControlName="code" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Min level 1–5</mat-label><input matInput type="number" min="1" max="5" formControlName="minimumProficiencyLevel" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Notes</mat-label><input matInput formControlName="notes" /></mat-form-field>
                      <mat-checkbox formControlName="isRequired">Required</mat-checkbox>
                      <mat-checkbox formControlName="isLeadSkill">Lead</mat-checkbox>
                      <button mat-icon-button type="button" (click)="skills.removeAt(i); skills.markAsDirty()" aria-label="Remove skill"><mat-icon>delete</mat-icon></button>
                    </div>
                  }
                  <div style="display: flex; gap: 8px; margin-top: 12px">
                    <button mat-stroked-button type="button" (click)="addSkill()"><mat-icon>add</mat-icon>Add skill</button>
                    <button mat-flat-button (click)="saveSkills()" [disabled]="busy() || skills.pristine">Save skills</button>
                  </div>
                </div>
              </mat-tab>

              <mat-tab label="Materials">
                <div class="tab-body">
                  <app-state [loading]="links.loading()" [error]="links.error()" (retry)="links.reload()" />
                  @for (g of materials.controls; track g; let i = $index) {
                    <div class="row mat" [formGroup]="g">
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Code</mat-label><input matInput formControlName="code" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Unit</mat-label><input matInput formControlName="unit" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Qty min</mat-label><input matInput type="number" formControlName="defaultQtyMin" /></mat-form-field>
                      <mat-form-field subscriptSizing="dynamic"><mat-label>Qty max</mat-label><input matInput type="number" formControlName="defaultQtyMax" /></mat-form-field>
                      <mat-checkbox formControlName="isCommon">Common</mat-checkbox>
                      <button mat-icon-button type="button" (click)="materials.removeAt(i); materials.markAsDirty()" aria-label="Remove material"><mat-icon>delete</mat-icon></button>
                    </div>
                  }
                  <div style="display: flex; gap: 8px; margin-top: 12px">
                    <button mat-stroked-button type="button" (click)="addMaterial()"><mat-icon>add</mat-icon>Add material</button>
                    <button mat-flat-button (click)="saveMaterials()" [disabled]="busy() || materials.pristine">Save materials</button>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>
        } @else {
          <div class="card state"><mat-icon class="state-icon">psychology</mat-icon><p>Select a category.</p></div>
        }
      </div>
    }
  `,
})
export class KnowledgePage {
  private readonly api = inject(Api);
  private readonly ui = inject(Ui);
  private readonly fb = inject(FormBuilder);
  readonly urgencies = URGENCIES;
  readonly busy = signal(false);
  readonly code = signal<string | null>(null);

  readonly cats = load(() => this.api.get<Items<Category>>('/api/admin/knowledge/categories'));
  readonly selected = computed(() => this.cats.value()?.items.find((c) => c.code === this.code()) ?? null);
  readonly links = load(() => {
    const code = this.code();
    return code
      ? forkJoin([
          this.api.get<Items<Row>>(`/api/admin/knowledge/categories/${code}/skills`),
          this.api.get<Items<Row>>(`/api/admin/knowledge/categories/${code}/materials`),
        ])
      : of<[Items<Row>, Items<Row>]>([{ items: [] }, { items: [] }]);
  });

  readonly catForm = this.fb.group(Object.fromEntries(CATEGORY_FIELDS.map((f) => [f, [null as unknown]])));
  readonly skills = this.fb.array<FormGroup>([]);
  readonly materials = this.fb.array<FormGroup>([]);

  constructor() {
    effect(() => {
      const c = this.selected();
      if (c) this.catForm.reset(Object.fromEntries(CATEGORY_FIELDS.map((f) => [f, c[f]])));
    });
    effect(() => {
      const v = this.links.value();
      this.fill(this.skills, (v?.[0].items ?? []).map((s) => this.skillGroup(s)));
      this.fill(this.materials, (v?.[1].items ?? []).map((m) => this.materialGroup(m)));
    });
  }

  select(c: Category): void {
    this.code.set(c.code);
  }

  addSkill(): void {
    this.skills.push(this.skillGroup({ isRequired: true, isLeadSkill: false }));
    this.skills.markAsDirty();
  }

  addMaterial(): void {
    this.materials.push(this.materialGroup({ isCommon: true }));
    this.materials.markAsDirty();
  }

  async saveCategory(): Promise<void> {
    // Send only edited fields; PATCH treats every present key as an update.
    const dirty = Object.fromEntries(
      Object.entries(this.catForm.controls)
        .filter(([, c]) => c.dirty)
        .map(([k, c]) => [k, c.value === '' ? null : c.value]),
    );
    await this.run(() => this.api.patch(`/api/admin/knowledge/categories/${this.code()}`, dirty), 'Category saved.', () => this.cats.reload());
  }

  async saveSkills(): Promise<void> {
    if (this.skills.invalid) return this.skills.markAllAsTouched();
    if (!(await this.confirmReplace('skills'))) return;
    await this.run(() => this.api.put(`/api/admin/knowledge/categories/${this.code()}/skills`, { skills: this.skills.getRawValue() }), 'Skills saved.', () =>
      this.links.reload(),
    );
  }

  async saveMaterials(): Promise<void> {
    if (this.materials.invalid) return this.materials.markAllAsTouched();
    if (!(await this.confirmReplace('materials'))) return;
    await this.run(
      () => this.api.put(`/api/admin/knowledge/categories/${this.code()}/materials`, { materials: this.materials.getRawValue() }),
      'Materials saved.',
      () => this.links.reload(),
    );
  }

  private confirmReplace(what: string) {
    return this.ui.confirm({
      title: `Replace ${what}?`,
      message: `The ${what} list for ${this.selected()?.name} is replaced with exactly what is shown. Future AI drafts use it.`,
      confirm: 'Save',
    });
  }

  // `description` is carried through: the PUT upsert overwrites it on the shared Skill/Material record.
  private skillGroup(s: Row): FormGroup {
    return this.fb.group({
      code: [s['code'] ?? '', Validators.required],
      name: [s['name'] ?? '', Validators.required],
      description: [s['description'] ?? null],
      minimumProficiencyLevel: [s['minimumProficiencyLevel'] ?? null, [Validators.min(1), Validators.max(5)]],
      isRequired: [s['isRequired'] ?? true],
      isLeadSkill: [s['isLeadSkill'] ?? false],
      notes: [s['notes'] ?? null],
    });
  }

  private materialGroup(m: Row): FormGroup {
    return this.fb.group({
      code: [m['code'] ?? '', Validators.required],
      name: [m['name'] ?? '', Validators.required],
      unit: [m['unit'] ?? null],
      description: [m['description'] ?? null],
      defaultQtyMin: [m['defaultQtyMin'] ?? null, Validators.min(0)],
      defaultQtyMax: [m['defaultQtyMax'] ?? null, Validators.min(0)],
      isCommon: [m['isCommon'] ?? true],
      notes: [m['notes'] ?? null],
    });
  }

  private fill(array: FormArray<FormGroup>, groups: FormGroup[]): void {
    array.clear();
    groups.forEach((g) => array.push(g));
    array.markAsPristine();
  }

  private async run(call: () => Observable<unknown>, done: string, after: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(call());
      this.ui.toast(done);
      await after();
    } catch (e) {
      this.ui.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}

