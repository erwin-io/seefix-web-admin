import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { toAppError } from '@app/core/http/app-error';
import { load } from '@app/core/utils/load';
import { UiService } from '@app/shared/services/ui.service';
import { LatLng, LocationChange, MapMarker, ReportLocation } from '../../campus.models';
import { CampusService } from '../../campus.service';
import { SOURCE_LABEL, outsideCampus, pinError, provenance, rawGpsText, round6 } from '../../geometry';
import { BuildingShape, CampusMapViewComponent, DraftMove, GeometryDraft } from '../campus-map-view/campus-map-view.component';

const BASIS_LABEL: Record<NonNullable<ReportLocation['suggestion']>['basis'], string> = {
  LINKED_BUILDING: 'the report’s building',
  SIMILAR_NAME: 'matched from the building name on the report',
};

/** The report as the one marker of its mini map. */
export function reportMarker(r: ReportLocation): MapMarker {
  return {
    kind: 'REPORT', id: r.report.id, no: r.report.no, status: r.report.status, category: null, urgency: null,
    buildingId: r.building?.id ?? null, buildingName: r.building?.name ?? r.report.buildingText, buildingMatch: r.report.buildingMatch,
    location: r.location, route: `/reports/${r.report.id}`,
  };
}

/**
 * Report page: where this report is on the campus map (only this report; its building outline for context).
 * Maintenance can fix a missing or wrong position: put it at the building's location, or pick / drag a point.
 * The fix is stored apart from the report (GET/PUT/DELETE /api/map/reports/:id); raw GPS and building never change.
 */
@Component({
  selector: 'app-report-location',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, CampusMapViewComponent],
  template: `
    <section class="card loc" aria-labelledby="loc-title">
      <header>
        <h2 id="loc-title">Map location</h2>
        @if (value(); as v) {
          <span class="source" [attr.data-source]="v.location.source">{{ sourceLabel[v.location.source] }}</span>
        }
      </header>
      @if (data.loading() && !value()) {
        <p class="muted">Loading the map location…</p>
      } @else if (data.error() && !value()) {
        <p class="field-error" role="alert">{{ data.error() }} <button mat-button (click)="data.reload()">Retry</button></p>
      }
      @if (value(); as v) {
        <p class="muted" data-field="provenance">{{ provenance(v.location) }}.</p>
        <p class="muted">Raw GPS: <span data-field="raw-gps">{{ rawGps(v.location) }}</span></p>
        @if (v.location.source === 'NONE' && !editing()) {
          <div class="banner info" role="status" data-banner="unpinned">
            <mat-icon>location_off</mat-icon>
            <span>This report isn't on the campus map yet{{ v.canCorrect ? '. Place it below.' : ': maintenance can place it.' }}</span>
          </div>
        }
        <app-campus-map-view
          [buildings]="shapes()"
          [markers]="editing() ? [] : [marker()]"
          [draft]="draft()"
          [campus]="v.campus"
          (mapClick)="picked($event)"
          (draftMove)="moved($event)"
          [label]="editing() ? 'Pick this report’s location: click the map or drag the purple point. The latitude and longitude fields are the keyboard alternative.' : 'Location of report ' + v.report.no"
        />
        @if (v.canCorrect) {
          @if (editing()) {
            <form class="edit" (submit)="$event.preventDefault(); savePoint()" novalidate data-form="pick">
              <p class="hint"><mat-icon inline>open_with</mat-icon> Click the map or drag the purple point. Its latitude and longitude update as you drag.</p>
              <div class="pair">
                <mat-form-field>
                  <mat-label>Latitude</mat-label>
                  <input matInput type="number" step="any" name="lat" [ngModel]="point()?.[0] ?? null" (ngModelChange)="setAxis(0, $event)" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Longitude</mat-label>
                  <input matInput type="number" step="any" name="lng" [ngModel]="point()?.[1] ?? null" (ngModelChange)="setAxis(1, $event)" />
                </mat-form-field>
              </div>
              @if (pointError()) {
                <p class="field-error" role="alert" data-error="point">{{ pointError() }}</p>
              }
              <mat-form-field class="wide">
                <mat-label>Reason (optional)</mat-label>
                <input matInput name="reason" maxlength="500" [ngModel]="reason()" (ngModelChange)="reason.set($event)" placeholder="e.g. Pinned from the photo" />
              </mat-form-field>
              <div class="row">
                <button mat-flat-button type="submit" [disabled]="busy() || !!pointError()">{{ busy() ? 'Saving…' : 'Save location' }}</button>
                <button mat-button type="button" (click)="cancel()">Cancel</button>
              </div>
            </form>
          } @else {
            <div class="row actions">
              @if (suggestion(); as s) {
                <button mat-stroked-button type="button" data-action="use-building" [disabled]="busy()" (click)="useBuilding()">
                  <mat-icon>auto_fix_high</mat-icon>Use {{ s.buildingName }}’s location
                </button>
              }
              <button mat-stroked-button type="button" data-action="pick" [disabled]="busy()" (click)="startPick()">
                <mat-icon>edit_location_alt</mat-icon>{{ v.location.source === 'NONE' ? 'Pick on map' : 'Adjust on map' }}
              </button>
              @if (v.location.source === 'CORRECTED') {
                <button mat-button type="button" data-action="clear" [disabled]="busy()" (click)="clear()">
                  <mat-icon>undo</mat-icon>Remove saved location
                </button>
              }
            </div>
            @if (suggestion(); as s) {
              <p class="muted small">"Use … location" places the report at {{ s.buildingName }} ({{ basisLabel[s.basis] }}).</p>
            }
            @if (v.location.correction; as c) {
              <p class="muted small">Saved {{ c.updatedAt | date: 'MMM d, y, h:mm a' }}{{ c.updatedBy ? ' by ' + c.updatedBy : '' }}.</p>
            }
          }
          @if (saveError()) {
            <p class="field-error" role="alert">{{ saveError() }}</p>
          }
        }
      }
    </section>
  `,
  styles: `
    .loc { --map-height: 400px; } /* owner hotfix 1: at least 400 px tall */
    .loc header { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .loc h2 { margin: 0; }
    .source { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--sf-surface-2, #eef1f5); }
    .source[data-source='NONE'] { color: var(--sf-warn); }
    .source[data-source='CORRECTED'] { color: #6d28d9; }
    .muted { color: var(--sf-muted); font-size: 13px; margin: 4px 0; }
    .small { font-size: 12px; }
    .hint { font-size: 13px; margin: 8px 0; color: #6d28d9; }
    .pair { display: flex; gap: 8px; flex-wrap: wrap; }
    .pair mat-form-field { flex: 1; min-width: 120px; }
    .wide { width: 100%; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions { margin-top: 10px; }
    .edit { margin-top: 10px; }
    .banner { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border: 1px solid currentColor; border-radius: 8px; margin: 8px 0; }
    .banner.info { color: var(--sf-info); }
    .banner span { flex: 1; }
    .field-error { color: var(--sf-danger); font-size: 13px; margin: 6px 0; }
  `,
})
export class ReportLocationComponent {
  private readonly campus = inject(CampusService);
  private readonly ui = inject(UiService);
  readonly reportId = input.required<string>();

  readonly data = load(() => this.campus.reportLocation(this.reportId()));
  /** The latest answer (a save returns the new state without a reload). */
  private readonly latest = signal<ReportLocation | null>(null);
  readonly value = computed(() => this.latest() ?? this.data.value() ?? null);
  readonly sourceLabel = SOURCE_LABEL;
  readonly basisLabel = BASIS_LABEL;
  readonly provenance = provenance;
  readonly rawGps = rawGpsText;

  readonly editing = signal(false);
  readonly point = signal<LatLng | null>(null);
  readonly reason = signal('');
  readonly busy = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly marker = computed(() => reportMarker(this.value()!));
  /** "Use … location", unless the report is already placed exactly there. */
  readonly suggestion = computed(() => {
    const v = this.value();
    const s = v?.suggestion;
    if (!v || !s) return null;
    return v.location.source === 'CORRECTED' && v.location.lat === s.lat && v.location.lng === s.lng ? null : s;
  });
  readonly shapes = computed<BuildingShape[]>(() => (this.value()?.building ? [this.value()!.building!] : []));
  readonly draft = computed<GeometryDraft | null>(() =>
    this.editing() && this.point() ? { perimeter: [], pin: this.point(), moving: 'pin', pinLabel: 'Report location' } : null,
  );
  readonly pointError = computed(() => {
    const p = this.point();
    const v = this.value();
    if (!p) return 'Click the map to place the report.';
    const bad = pinError(p[0], p[1]);
    if (bad) return bad;
    return v && outsideCampus(v.campus, p) ? 'That point is outside the campus map area.' : null;
  });

  startPick(): void {
    const v = this.value()!;
    const l = v.location;
    const start: LatLng = l.lat !== null && l.lng !== null ? [l.lat, l.lng] : v.suggestion ? [v.suggestion.lat, v.suggestion.lng] : [v.campus.centerLat, v.campus.centerLng];
    this.point.set([round6(start[0]), round6(start[1])]);
    this.reason.set(l.correction?.reason ?? '');
    this.saveError.set(null);
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
    this.saveError.set(null);
  }

  picked(p: LatLng): void {
    if (this.editing()) this.point.set(p);
  }

  moved(e: DraftMove): void {
    this.point.set(e.point);
  }

  setAxis(axis: 0 | 1, value: number | null): void {
    const p: LatLng = [...(this.point() ?? [NaN, NaN])] as LatLng;
    p[axis] = typeof value === 'number' ? value : NaN;
    this.point.set(p);
  }

  async savePoint(): Promise<void> {
    if (this.pointError()) return;
    const [lat, lng] = this.point()!;
    const reason = this.reason().trim();
    if (await this.put({ lat, lng, source: 'MANUAL', ...(reason ? { reason } : {}) })) this.editing.set(false);
  }

  async useBuilding(): Promise<void> {
    const s = this.value()?.suggestion;
    if (!s) return;
    const ok = await this.ui.confirm({
      title: `Place at ${s.buildingName}?`,
      message: `The campus map will show ${this.value()!.report.no} at ${s.buildingName}'s location (${BASIS_LABEL[s.basis]}). The report's own GPS and building are not changed.`,
      confirm: 'Place report',
    });
    if (ok) await this.put({ lat: s.lat, lng: s.lng, source: 'BUILDING', buildingId: s.buildingId, reason: `Placed at ${s.buildingName}` });
  }

  async clear(): Promise<void> {
    const ok = await this.ui.confirm({
      title: 'Remove saved location?',
      message: 'The map goes back to the report’s GPS or its building’s location.',
      confirm: 'Remove',
      danger: true,
    });
    if (!ok) return;
    await this.run(() => this.campus.clearReportLocation(this.reportId()), 'Saved map location removed.');
  }

  private put(body: LocationChange): Promise<boolean> {
    return this.run(() => this.campus.setReportLocation(this.reportId(), body), 'Map location saved.');
  }

  private async run(call: () => ReturnType<CampusService['reportLocation']>, done: string): Promise<boolean> {
    this.busy.set(true);
    this.saveError.set(null);
    try {
      this.latest.set(await firstValueFrom(call()));
      this.ui.toast(done);
      return true;
    } catch (e) {
      this.saveError.set(toAppError(e).message);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
