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
import { Row } from '@app/core/models/api.model';
import { load } from '@app/core/utils/load';
import { UiService } from '@app/shared/services/ui.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { URGENCIES } from '@app/modules/maintenance/maintenance.models';
import { Observable, firstValueFrom, forkJoin, of } from 'rxjs';
import { CATEGORY_FIELDS, Category, CategoryMaterial, CategorySkill } from '../../admin.models';
import { AdminService } from '../../admin.service';

/** Reference knowledge the Agent uses for drafts. PUT endpoints replace the whole link list. */
@Component({
  selector: 'app-knowledge-page',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatListModule,
    MatSelectModule, MatSlideToggleModule, MatTabsModule, ...SHARED_IMPORTS,
  ],
  styleUrl: './knowledge.page.scss',
  templateUrl: './knowledge.page.html',
})
export class KnowledgePage {
  private readonly admin = inject(AdminService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  readonly urgencies = URGENCIES;
  readonly busy = signal(false);
  readonly code = signal<string | null>(null);

  readonly cats = load(() => this.admin.categories());
  readonly selected = computed(() => this.cats.value()?.items.find((c) => c.code === this.code()) ?? null);
  readonly links = load(() => {
    const code = this.code();
    return code
      ? forkJoin([
          this.admin.categorySkills(code),
          this.admin.categoryMaterials(code),
        ])
      : of<[{ items: CategorySkill[] }, { items: CategoryMaterial[] }]>([{ items: [] }, { items: [] }]);
  });

  readonly catForm = this.fb.group(Object.fromEntries(CATEGORY_FIELDS.map((f) => [f, [null as unknown]])));
  readonly skills = this.fb.array<FormGroup>([]);
  readonly materials = this.fb.array<FormGroup>([]);

  constructor() {
    effect(() => {
      const c = this.selected();
      if (c) this.catForm.reset(Object.fromEntries(CATEGORY_FIELDS.map((f) => [f, (c as Category)[f]])));
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
    await this.run(() => this.admin.updateCategory(this.code()!, dirty), 'Category saved.', () => this.cats.reload());
  }

  async saveSkills(): Promise<void> {
    if (this.skills.invalid) return this.skills.markAllAsTouched();
    if (!(await this.confirmReplace('skills'))) return;
    await this.run(() => this.admin.replaceSkills(this.code()!, this.skills.getRawValue() as CategorySkill[]), 'Skills saved.', () =>
      this.links.reload(),
    );
  }

  async saveMaterials(): Promise<void> {
    if (this.materials.invalid) return this.materials.markAllAsTouched();
    if (!(await this.confirmReplace('materials'))) return;
    await this.run(
      () => this.admin.replaceMaterials(this.code()!, this.materials.getRawValue() as CategoryMaterial[]),
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

