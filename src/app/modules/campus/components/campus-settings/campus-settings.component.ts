import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { toAppError } from '@app/core/http/app-error';
import { UiService } from '@app/shared/services/ui.service';
import { CampusArea, LatLng } from '../../campus.models';
import { CampusService } from '../../campus.service';
import { round6 } from '../../geometry';
import { CampusMapViewComponent, DraftMove, GeometryDraft } from '../campus-map-view/campus-map-view.component';

/** Same limits as seefix-api `validateCampus`. */
export const CAMPUS_RADIUS_M: [number, number] = [100, 5000];
export const CAMPUS_MIN_ZOOM: [number, number] = [10, 18];
/** The owner's campus centre (2026-10-17); "Use default" restores it with the API's default radius and zoom. */
export const CAMPUS_DEFAULT: CampusArea = { centerLat: 10.326321, centerLng: 123.954995, radiusMeters: 600, minZoom: 16 };

type CampusForm = { centerLat: number | null; centerLng: number | null; radiusMeters: number | null; minZoom: number | null };

/** Field → problem, mirroring the API (it validates again). */
export function campusErrors(f: CampusForm): Partial<Record<keyof CampusForm, string>> {
  const e: Partial<Record<keyof CampusForm, string>> = {};
  const ok = (n: number | null, max: number) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max;
  if (!ok(f.centerLat, 90) || !ok(f.centerLng, 180)) e.centerLat = 'The centre must be a valid latitude (±90) and longitude (±180).';
  const [rMin, rMax] = CAMPUS_RADIUS_M;
  if (!Number.isInteger(f.radiusMeters) || f.radiusMeters! < rMin || f.radiusMeters! > rMax) e.radiusMeters = `A whole number from ${rMin} to ${rMax} m.`;
  const [zMin, zMax] = CAMPUS_MIN_ZOOM;
  if (!Number.isInteger(f.minZoom) || f.minZoom! < zMin || f.minZoom! > zMax) e.minZoom = `A whole number from ${zMin} (far) to ${zMax} (close).`;
  return e;
}

/**
 * Admin: the campus map area (Buildings page). Every campus map stays inside this circle and can't zoom out past
 * the minimum zoom. Drag the centre on the preview or click to place it; the radius ring updates as you type.
 */
@Component({
  selector: 'app-campus-settings',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, CampusMapViewComponent],
  template: `
    <section class="card campus" aria-labelledby="campus-title">
      <header>
        <div>
          <h2 id="campus-title">Campus map area</h2>
          <p class="muted">
            Maps open here, can't be panned outside the circle and can't zoom out further than the minimum zoom.
            @if (saved(); as s) {
              @if (s.isDefault) { Using the default area (not saved yet). }
              @else if (updatedAt()) { Last saved {{ updatedAt() | date: 'MMM d, y, h:mm a' }}{{ updatedBy() ? ' by ' + updatedBy() : '' }}. }
            }
          </p>
        </div>
      </header>
      @if (loadError()) {
        <p class="field-error" role="alert">{{ loadError() }}</p>
      }
      <div class="grid">
        <form class="fields" (submit)="$event.preventDefault(); save()" novalidate>
          <div class="pair">
            <mat-form-field>
              <mat-label>Centre latitude</mat-label>
              <input matInput type="number" step="any" name="centerLat" [ngModel]="form().centerLat" (ngModelChange)="patch({ centerLat: $event })" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Centre longitude</mat-label>
              <input matInput type="number" step="any" name="centerLng" [ngModel]="form().centerLng" (ngModelChange)="patch({ centerLng: $event })" />
            </mat-form-field>
          </div>
          @if (errors().centerLat) {
            <p class="field-error" role="alert">{{ errors().centerLat }}</p>
          }
          <div class="pair">
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Radius (metres)</mat-label>
              <input matInput type="number" step="50" [min]="radius[0]" [max]="radius[1]" name="radius" [ngModel]="form().radiusMeters" (ngModelChange)="patch({ radiusMeters: $event })" />
              <mat-hint>How far from the centre the map can be panned.</mat-hint>
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Minimum zoom</mat-label>
              <input matInput type="number" step="1" [min]="zoom[0]" [max]="zoom[1]" name="minZoom" [ngModel]="form().minZoom" (ngModelChange)="patch({ minZoom: $event })" />
              <mat-hint>Furthest zoom-out ({{ zoom[0] }} far – {{ zoom[1] }} close).</mat-hint>
            </mat-form-field>
          </div>
          @if (errors().radiusMeters) {
            <p class="field-error" role="alert">{{ errors().radiusMeters }}</p>
          }
          @if (errors().minZoom) {
            <p class="field-error" role="alert">{{ errors().minZoom }}</p>
          }
          @if (saveError()) {
            <p class="field-error" role="alert">{{ saveError() }}</p>
          }
          <div class="row">
            <button mat-flat-button type="submit" [disabled]="!valid() || !dirty() || saving()">{{ saving() ? 'Saving…' : 'Save campus area' }}</button>
            <button mat-button type="button" (click)="useDefault()">Use default</button>
            @if (dirty()) {
              <button mat-button type="button" (click)="revert()">Undo changes</button>
            }
          </div>
        </form>
        <div class="preview">
          <app-campus-map-view
            [campus]="preview()"
            [bounded]="false"
            [showCampus]="true"
            [draft]="draft()"
            (mapClick)="setCentre($event)"
            (draftMove)="moved($event)"
            label="Campus area preview. Drag the centre or click the map to place it; the fields are the keyboard alternative."
          />
          <p class="muted">Purple ring: the campus area. Drag the centre, or click the map to move it there.</p>
        </div>
      </div>
    </section>
  `,
  styles: `
    .campus { margin-bottom: 16px; }
    .campus h2 { margin: 0 0 4px; }
    .grid { display: grid; grid-template-columns: minmax(280px, 380px) minmax(0, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } }
    .pair { display: flex; gap: 8px; flex-wrap: wrap; }
    .pair mat-form-field { flex: 1; min-width: 140px; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .preview { --map-height: 320px; }
    .muted { color: var(--sf-muted); font-size: 13px; }
    .field-error { color: var(--sf-danger); font-size: 13px; margin: 0 0 8px; }
  `,
})
export class CampusSettingsComponent {
  private readonly campus = inject(CampusService);
  private readonly ui = inject(UiService);
  readonly radius = CAMPUS_RADIUS_M;
  readonly zoom = CAMPUS_MIN_ZOOM;

  readonly saved = signal<CampusArea | null>(null);
  readonly updatedAt = signal<string | null>(null);
  readonly updatedBy = signal<string | null>(null);
  readonly form = signal<CampusForm>({ ...CAMPUS_DEFAULT });
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errors = computed(() => campusErrors(this.form()));
  readonly valid = computed(() => Object.keys(this.errors()).length === 0);
  readonly dirty = computed(() => {
    const s = this.saved();
    const f = this.form();
    return !s || s.isDefault || f.centerLat !== s.centerLat || f.centerLng !== s.centerLng || f.radiusMeters !== s.radiusMeters || f.minZoom !== s.minZoom;
  });
  /** The ring follows the form while it is valid. */
  readonly preview = computed<CampusArea | null>(() => (this.valid() ? (this.form() as CampusArea) : this.saved()));
  readonly draft = computed<GeometryDraft | null>(() => {
    const f = this.form();
    return this.valid() ? { perimeter: [], pin: [f.centerLat!, f.centerLng!], moving: 'pin', pinLabel: 'Campus centre' } : null;
  });

  constructor() {
    this.campus.campusSettings().subscribe({
      next: (r) => {
        this.saved.set(r.campus);
        this.updatedAt.set(r.updatedAt);
        this.updatedBy.set(r.updatedBy);
        this.form.set(pickArea(r.campus));
      },
      error: (e: unknown) => this.loadError.set(toAppError(e).message),
    });
  }

  patch(changes: Partial<CampusForm>): void {
    this.form.update((f) => ({ ...f, ...changes }));
  }

  setCentre([lat, lng]: LatLng): void {
    this.patch({ centerLat: round6(lat), centerLng: round6(lng) });
  }

  moved(e: DraftMove): void {
    this.setCentre(e.point);
  }

  async useDefault(): Promise<void> {
    const d = CAMPUS_DEFAULT;
    const ok = await this.ui.confirm({
      title: 'Use the default campus area?',
      message: `The fields are reset to centre ${d.centerLat}, ${d.centerLng}, ${d.radiusMeters} m radius and minimum zoom ${d.minZoom}. Nothing is saved until you press Save campus area.`,
      confirm: 'Use default',
    });
    if (ok) this.form.set({ ...CAMPUS_DEFAULT });
  }

  revert(): void {
    const s = this.saved();
    this.form.set(s ? pickArea(s) : { ...CAMPUS_DEFAULT });
  }

  async save(): Promise<void> {
    if (!this.valid() || this.saving()) return;
    const f = this.form();
    const ok = await this.ui.confirm({
      title: 'Save the campus map area?',
      message: `Every campus map will open at ${f.centerLat}, ${f.centerLng}, stay within ${f.radiusMeters} m of it and not zoom out past ${f.minZoom}. Report corrections outside this area are refused.`,
      confirm: 'Save campus area',
    });
    if (!ok || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const res = await firstValueFrom(this.campus.saveCampusSettings(this.form() as CampusArea));
      this.saved.set(res.campus);
      this.form.set(pickArea(res.campus));
      this.updatedAt.set(new Date().toISOString());
      this.updatedBy.set(null);
      this.ui.toast('Campus map area saved.');
    } catch (e) {
      this.saveError.set(toAppError(e).message);
    } finally {
      this.saving.set(false);
    }
  }
}

function pickArea(c: CampusArea): CampusForm {
  return { centerLat: c.centerLat, centerLng: c.centerLng, radiusMeters: c.radiusMeters, minZoom: c.minZoom };
}
