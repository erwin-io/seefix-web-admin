import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, of } from 'rxjs';
import { useDataset } from '@app/core/data/dataset.store';
import { toAppError } from '@app/core/http/app-error';
import { load } from '@app/core/utils/load';
import { PageStateComponent } from '@app/shared/components/page-state/page-state.component';
import { UiService } from '@app/shared/services/ui.service';
import { Building, BuildingChanges, CampusArea, LatLng } from '../../campus.models';
import { BUILDINGS, CampusService } from '../../campus.service';
import { BuildingShape, CampusMapViewComponent, DraftMove, GeometryDraft } from '../../components/campus-map-view/campus-map-view.component';
import { MAX_TOLERANCE_M, MAX_VERTICES, parsePoints, perimeterError, pinError, round6, toleranceError, wrapLng } from '../../geometry';

export interface BuildingForm {
  code: string;
  name: string;
  description: string;
  sortOrder: number | null;
  isActive: boolean;
  defaultLat: number | null;
  defaultLng: number | null;
  toleranceMeters: number | null;
  perimeter: LatLng[];
  reason: string;
}

export function formOf(b: Building | null): BuildingForm {
  return {
    code: b?.code ?? '',
    name: b?.name ?? '',
    description: b?.description ?? '',
    sortOrder: b?.sortOrder ?? 0,
    isActive: b?.isActive ?? true,
    defaultLat: b?.defaultLat ?? null,
    defaultLng: b?.defaultLng ?? null,
    toleranceMeters: b?.toleranceMeters ?? 25,
    perimeter: b?.perimeter ? b.perimeter.map((p) => [p[0], p[1]] as LatLng) : [],
    reason: '',
  };
}

/** Field → problem. Mirrors the API's checks so mistakes show before saving; the API still validates. */
export function formErrors(f: BuildingForm, creating: boolean): Partial<Record<keyof BuildingForm, string>> {
  const e: Partial<Record<keyof BuildingForm, string>> = {};
  if (creating && !f.code.trim()) e.code = 'Code is required.';
  else if (f.code.trim().length > 60) e.code = 'At most 60 characters.';
  if (!f.name.trim()) e.name = 'Name is required.';
  else if (f.name.trim().length > 200) e.name = 'At most 200 characters.';
  if (f.description.length > 2000) e.description = 'At most 2000 characters.';
  if (f.sortOrder === null || !Number.isInteger(f.sortOrder)) e.sortOrder = 'Sort order must be a whole number.';
  const pin = pinError(f.defaultLat, f.defaultLng);
  if (pin) e.defaultLat = pin;
  const tol = toleranceError(f.toleranceMeters);
  if (tol) e.toleranceMeters = tol;
  if (f.perimeter.length) {
    const p = perimeterError(f.perimeter);
    if (p) e.perimeter = p;
  }
  if (f.reason.length > 500) e.reason = 'At most 500 characters.';
  return e;
}

const GEOMETRY_KEYS = ['defaultLat', 'defaultLng', 'perimeter', 'toleranceMeters'] as const;

/**
 * PATCH body: only changed fields. A geometry change carries the revision it was based on, so the API answers
 * 409 GEOMETRY_CONFLICT if someone else moved the building meanwhile.
 */
export function changesOf(base: Building, f: BuildingForm): BuildingChanges {
  const out: BuildingChanges = {};
  const was = formOf(base);
  if (f.name.trim() !== was.name) out.name = f.name.trim();
  if (f.description.trim() !== was.description) out.description = f.description.trim() || null;
  if (f.sortOrder !== was.sortOrder) out.sortOrder = f.sortOrder!;
  if (f.isActive !== was.isActive) out.isActive = f.isActive;
  if (f.defaultLat !== was.defaultLat || f.defaultLng !== was.defaultLng) {
    out.defaultLat = f.defaultLat;
    out.defaultLng = f.defaultLng;
  }
  if (JSON.stringify(f.perimeter) !== JSON.stringify(was.perimeter)) out.perimeter = f.perimeter.length ? f.perimeter : null;
  if (f.toleranceMeters !== was.toleranceMeters) out.toleranceMeters = f.toleranceMeters!;
  if (GEOMETRY_KEYS.some((k) => k in out)) {
    out.geometryRevision = base.geometryRevision;
    if (f.reason.trim()) out.reason = f.reason.trim();
  }
  return out;
}

type ClickMode = 'vertex' | 'pin' | null;

@Component({
  selector: 'app-building-edit-page',
  imports: [
    DatePipe, FormsModule, RouterLink, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatTooltipModule, PageStateComponent, CampusMapViewComponent,
  ],
  templateUrl: './building-edit.page.html',
  styleUrl: './building-edit.page.scss',
})
export class BuildingEditPage {
  private readonly campus = inject(CampusService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);
  /** Route param; absent on /admin/buildings/new. */
  readonly id = input<string>();
  readonly creating = computed(() => !this.id());
  readonly list = useDataset(BUILDINGS);
  readonly maxVertices = MAX_VERTICES;
  readonly maxTolerance = MAX_TOLERANCE_M;

  /** The server version the form was opened from (its revision is sent with geometry edits). */
  readonly base = signal<Building | null>(null);
  readonly form = signal<BuildingForm>(formOf(null));
  readonly errors = computed(() => formErrors(this.form(), this.creating()));
  readonly valid = computed(() => Object.keys(this.errors()).length === 0);
  readonly changes = computed(() => (this.base() ? changesOf(this.base()!, this.form()) : null));
  readonly geometryChanged = computed(() => !!this.changes() && GEOMETRY_KEYS.some((k) => k in this.changes()!));
  readonly dirty = computed(() => this.creating() || Object.keys(this.changes() ?? {}).length > 0);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  /** 409 GEOMETRY_CONFLICT: the latest server copy, once reloaded (null while loading or not found). */
  readonly conflict = signal<{ latest: Building | null } | null>(null);
  /** What a map click does. "Pan only" (null) by default once a perimeter exists, so a stray click adds nothing. */
  readonly clickMode = signal<ClickMode>('vertex');
  /** The one point that can be dragged on the map (a perimeter index or the pin); null: none. */
  readonly moving = signal<number | 'pin' | null>(null);
  /** Campus map area: keeps this map inside the campus (admin endpoint; null on an older API). */
  readonly campusArea = signal<CampusArea | null>(null);
  readonly pasteText = signal('');
  readonly pasteError = signal<string | null>(null);
  readonly missing = computed(() => !this.creating() && !!this.list.loadedAt() && !this.list.rows().some((b) => b.id === this.id()));

  readonly others = computed<BuildingShape[]>(() => this.list.rows().filter((b) => b.id !== this.id()));
  readonly draft = computed<GeometryDraft>(() => {
    const f = this.form();
    return {
      perimeter: f.perimeter,
      pin: f.defaultLat !== null && f.defaultLng !== null ? [f.defaultLat, f.defaultLng] : null,
      moving: this.moving(),
    };
  });

  readonly history = load(() => {
    const id = this.id();
    return id ? this.campus.history(id) : of(null);
  });

  constructor() {
    this.campus.campusSettings().subscribe({ next: (r) => this.campusArea.set(r.campus), error: () => this.campusArea.set(null) });
    // Open the form once from the loaded list (later list refreshes never overwrite unsaved edits).
    effect(() => {
      const id = this.id();
      const found = this.list.rows().find((b) => b.id === id) ?? null;
      untracked(() => {
        if (found && !this.base()) this.reset(found);
      });
    });
  }

  patch(changes: Partial<BuildingForm>): void {
    this.form.update((f) => ({ ...f, ...changes }));
  }

  setVertex(i: number, axis: 0 | 1, value: number | null): void {
    this.form.update((f) => {
      const perimeter = f.perimeter.map((p) => [...p] as LatLng);
      perimeter[i][axis] = value === null ? NaN : value;
      return { ...f, perimeter };
    });
  }

  removeVertex(i: number): void {
    const m = this.moving();
    if (typeof m === 'number') this.moving.set(m === i ? null : m > i ? m - 1 : m);
    this.form.update((f) => ({ ...f, perimeter: f.perimeter.filter((_, j) => j !== i) }));
  }

  clearPerimeter(): void {
    if (typeof this.moving() === 'number') this.moving.set(null);
    this.patch({ perimeter: [] });
  }

  clearPin(): void {
    if (this.moving() === 'pin') this.moving.set(null);
    this.patch({ defaultLat: null, defaultLng: null });
  }

  /** Make one point draggable on the map (pressing again, or Done, stops). Map clicks add nothing meanwhile. */
  toggleMove(target: number | 'pin'): void {
    this.moving.set(this.moving() === target ? null : target);
  }

  /** A drag on the map: the point's latitude and longitude follow it live. */
  draftMoved({ target, point }: DraftMove): void {
    if (target === 'pin') this.patch({ defaultLat: point[0], defaultLng: point[1] });
    else this.form.update((f) => ({ ...f, perimeter: f.perimeter.map((p, i) => (i === target ? point : p)) }));
  }

  mapClick([lat, lng]: LatLng): void {
    if (this.moving() !== null) return; // moving a point: a click on the map must not also add one
    const p: LatLng = [round6(lat), round6(wrapLng(lng))];
    if (this.clickMode() === 'pin') this.patch({ defaultLat: p[0], defaultLng: p[1] });
    else if (this.clickMode() === 'vertex' && this.form().perimeter.length < MAX_VERTICES) this.patch({ perimeter: [...this.form().perimeter, p] });
  }

  applyPaste(): void {
    const pts = parsePoints(this.pasteText());
    if (!pts) return this.pasteError.set('Use [[lat, lng], …] or one "lat, lng" pair per line.');
    this.pasteError.set(null);
    this.patch({ perimeter: pts });
  }

  async save(): Promise<void> {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      if (this.creating()) {
        const f = this.form();
        const body: BuildingChanges = {
          code: f.code.trim(),
          name: f.name.trim(),
          description: f.description.trim() || null,
          sortOrder: f.sortOrder!,
          toleranceMeters: f.toleranceMeters!,
          ...(f.defaultLat !== null ? { defaultLat: f.defaultLat, defaultLng: f.defaultLng } : {}),
          ...(f.perimeter.length ? { perimeter: f.perimeter } : {}),
          ...(f.reason.trim() ? { reason: f.reason.trim() } : {}),
        };
        const res = await firstValueFrom(this.campus.create(body));
        this.ui.toast('Building created.');
        await this.router.navigate(['/admin/buildings', res.building.id], { replaceUrl: true });
        return;
      }
      const res = await firstValueFrom(this.campus.update(this.id()!, this.changes()!));
      this.reset(res.building);
      void this.history.reload();
      this.ui.toast(`Building saved (geometry revision ${res.building.geometryRevision}).`);
    } catch (e) {
      const err = toAppError(e);
      if (err.code === 'GEOMETRY_CONFLICT') {
        this.conflict.set({ latest: null });
        void this.loadLatest();
      } else {
        this.saveError.set(err.message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Conflict choice 1: drop my location edits and start from the latest saved geometry (other fields kept). */
  useLatest(): void {
    const latest = this.conflict()?.latest;
    if (!latest) return;
    const mine = this.form();
    const theirs = formOf(latest);
    this.base.set(latest);
    this.form.set({ ...mine, ...pick(theirs, GEOMETRY_KEYS) });
    this.moving.set(null);
    this.conflict.set(null);
  }

  /** Conflict choice 2: keep my edits, now based on the latest revision; the admin saves again on purpose. */
  keepMine(): void {
    const latest = this.conflict()?.latest;
    if (!latest) return;
    this.base.set(latest);
    this.conflict.set(null);
  }

  private async loadLatest(): Promise<void> {
    await this.list.reload();
    const latest = this.list.rows().find((b) => b.id === this.id()) ?? null;
    if (this.conflict()) this.conflict.set({ latest });
  }

  private reset(b: Building): void {
    this.base.set(b);
    this.form.set(formOf(b));
    this.conflict.set(null);
    this.moving.set(null);
    // An outlined building opens in "Pan only": points are added only after choosing "Add perimeter point".
    this.clickMode.set(b.perimeter?.length ? null : 'vertex');
  }
}

function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;
}
