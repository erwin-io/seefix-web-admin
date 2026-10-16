import { DOCUMENT, DatePipe, LowerCasePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { SessionService } from '@app/core/auth/session.service';
import { CacheSyncService } from '@app/core/data/cache-sync.service';
import { DatasetStore } from '@app/core/data/dataset.store';
import { DataTableComponent } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { MapMarker } from '../../campus.models';
import { CampusService } from '../../campus.service';
import { CampusMapViewComponent, KIND_COLOR, markerKey } from '../../components/campus-map-view/campus-map-view.component';
import { MarkerFilter, NO_FILTER, SOURCE_LABEL, filterMarkers, options, pinned, provenance, rawGpsText } from '../../geometry';

export const KIND_LABEL: Record<MapMarker['kind'], string> = { REPORT: 'Report', WORK_ORDER: 'Work order' };
/** While the map is on screen it asks for changes this often (cheap version check; data reloads only on change). */
export const MAP_LIVE_MS = 15_000;
const MATCH_LABEL: Record<MapMarker['buildingMatch'], string> = {
  LOCATION: 'From the facility location',
  NAME: 'Matched by building name',
  NONE: 'No linked building',
};

/**
 * Active reports and work orders on the campus map (`GET /api/map`, role-scoped by the API). Pins show where the
 * API placed them and why (GPS vs building default vs not pinned); raw GPS is always visible. The map is display
 * only: nothing here changes a report's building or category. The table below is the accessible equivalent.
 */
@Component({
  selector: 'app-campus-map-page',
  imports: [
    DatePipe, LowerCasePipe, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatProgressBarModule, MatSelectModule,
    MatSortModule, MatTableModule, DataTableComponent, CampusMapViewComponent, ...SHARED_IMPORTS,
  ],
  templateUrl: './campus-map.page.html',
  styleUrl: './campus-map.page.scss',
})
export class CampusMapPage {
  private readonly campus = inject(CampusService);
  readonly session = inject(SessionService);
  readonly sync = inject(CacheSyncService);
  readonly view = viewChild(CampusMapViewComponent);
  readonly data = this.campus.map();
  readonly buildings = this.campus.mapBuildings;
  readonly area = this.campus.campus;
  /** The picked building has no outline or pin yet, so the map can't centre on it. */
  readonly noLocation = signal<string | null>(null);
  readonly kindLabel = KIND_LABEL;
  readonly kindColor = KIND_COLOR;
  readonly sourceLabel = SOURCE_LABEL;
  readonly matchLabel = MATCH_LABEL;
  readonly provenance = provenance;
  readonly rawGps = rawGpsText;
  readonly key = markerKey;

  readonly filter = signal<MarkerFilter>(NO_FILTER);
  readonly selectedKey = signal<string | null>(null);
  readonly markers = this.data.rows;
  readonly filtered = computed(() => filterMarkers(this.markers(), this.filter()));
  readonly unpinned = computed(() => this.filtered().filter((m) => !pinned(m)).length);
  readonly selected = computed(() => this.markers().find((m) => markerKey(m) === this.selectedKey()) ?? null);
  readonly building = computed(() => this.buildings().find((b) => b.id === this.filter().buildingId) ?? null);
  readonly statuses = computed(() => options(this.markers(), (m) => m.status));
  readonly categories = computed(() => options(this.markers(), (m) => m.category));
  readonly urgencies = computed(() => options(this.markers(), (m) => m.urgency));
  readonly kinds = computed(() => options(this.markers(), (m) => m.kind) as MapMarker['kind'][]);
  readonly filtering = computed(() => Object.values(this.filter()).some((v) => v !== null));

  readonly columns = ['ref', 'status', 'category', 'building', 'location', 'gps'];
  readonly sortBy = {
    ref: (m: MapMarker) => m.no,
    status: (m: MapMarker) => m.status,
    category: (m: MapMarker) => m.category,
    building: (m: MapMarker) => m.buildingName,
    location: (m: MapMarker) => m.location.source,
  };
  readonly searchText = (m: MapMarker) => [m.no, m.status, m.category, m.urgency, m.buildingName, SOURCE_LABEL[m.location.source]].join(' ');

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.data.attach(destroyRef);
    void this.data.ensure();
    inject(DatasetStore).onActivity();
    // Live: check for changes every MAP_LIVE_MS while this page is visible (Pusher hints still arrive sooner).
    const doc = inject(DOCUMENT);
    const timer = setInterval(() => doc.visibilityState === 'visible' && this.sync.poll(), MAP_LIVE_MS);
    destroyRef.onDestroy(() => clearInterval(timer));
  }

  // Table cells are untyped (`let m`), so they go through these.
  kindOf = (m: MapMarker) => KIND_LABEL[m.kind];
  matchOf = (m: MapMarker) => MATCH_LABEL[m.buildingMatch];
  sourceOf = (m: MapMarker) => SOURCE_LABEL[m.location.source];

  setFilter<K extends keyof MarkerFilter>(k: K, v: MarkerFilter[K]): void {
    this.filter.update((f) => ({ ...f, [k]: v }));
  }

  clearFilters(): void {
    this.filter.set(NO_FILTER);
  }

  /** Building drill-down (map outline, list or filter): filter to it and centre the map on it, every time. */
  openBuilding(id: string | null): void {
    this.setFilter('buildingId', id);
    this.selectedKey.set(null);
    const b = id ? this.buildings().find((x) => x.id === id) : null;
    // The input change centres on a new building; this also re-centres when the same one is picked again.
    const centred = id ? (this.view()?.focus(id) ?? true) : true;
    this.noLocation.set(b && !centred ? b.name : null);
  }

  select(m: MapMarker | null): void {
    this.selectedKey.set(m ? markerKey(m) : null);
  }
}
