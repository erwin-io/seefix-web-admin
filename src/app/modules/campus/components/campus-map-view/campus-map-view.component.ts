import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { LEAFLET } from '../../campus.service';
import { LatLng, MapMarker } from '../../campus.models';
import { SOURCE_LABEL, pinned } from '../../geometry';

/** Outline + default pin of one building. */
export interface BuildingShape {
  id: string;
  name: string;
  perimeter: LatLng[] | null;
  defaultLat: number | null;
  defaultLng: number | null;
}

/** Geometry being edited on the building settings page. */
export interface GeometryDraft {
  perimeter: LatLng[];
  pin: LatLng | null;
}

/** Marker colour = kind (validated pair, CVD-safe). Fill = provenance: solid GPS, hollow dashed building default. */
export const KIND_COLOR: Record<MapMarker['kind'], string> = { REPORT: '#2563eb', WORK_ORDER: '#d9480f' };
const SURFACE = '#ffffff';
const OUTLINE = '#475569';
const DRAFT = '#6d28d9';

export const markerKey = (m: MapMarker) => `${m.kind}:${m.id}`;

export function markerStyle(m: MapMarker, selected = false): Leaflet.CircleMarkerOptions {
  const color = KIND_COLOR[m.kind];
  const radius = selected ? 10 : 6;
  return m.location.source === 'GPS'
    ? { radius, color: SURFACE, weight: 2, fillColor: color, fillOpacity: 0.95 }
    : { radius, color, weight: 3, dashArray: '3 3', fillColor: SURFACE, fillOpacity: 1 };
}

/**
 * Leaflet map (OpenStreetMap tiles, canvas renderer so thousands of pins stay smooth). Leaflet is loaded lazily;
 * if it or the tiles fail, `failed` / `tilesFailed` are set and the page falls back to its table. Read-only: a click
 * only selects or reports coordinates to the page.
 */
@Component({
  selector: 'app-campus-map-view',
  template: `<div #host class="map-host" role="region" [attr.aria-label]="label()"></div>`,
  styles: `
    :host { display: block; position: relative; }
    .map-host { height: var(--map-height, 480px); border-radius: 12px; border: 1px solid var(--sf-border); background: #eef1f5; }
  `,
})
export class CampusMapViewComponent {
  readonly label = input('Campus map');
  readonly buildings = input<BuildingShape[]>([]);
  readonly markers = input<MapMarker[]>([]);
  readonly selected = input<string | null>(null);
  /** Zoom to this building (drill-down). */
  readonly focusBuilding = input<string | null>(null);
  readonly draft = input<GeometryDraft | null>(null);
  readonly markerClick = output<MapMarker>();
  readonly buildingClick = output<string>();
  readonly mapClick = output<LatLng>();

  /** Leaflet could not load (offline, blocked): the page shows only its table. */
  readonly failed = signal(false);
  readonly tilesFailed = signal(false);
  readonly ready = signal(false);
  /** Pins drawn by the last render (tests and the page's "N not pinned" note). */
  readonly drawn = signal(0);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly loadLeaflet = inject(LEAFLET);
  private L!: typeof Leaflet;
  private map?: Leaflet.Map;
  private buildingLayer?: Leaflet.LayerGroup;
  private markerLayer?: Leaflet.LayerGroup;
  private draftLayer?: Leaflet.LayerGroup;
  private layers = new Map<string, Leaflet.CircleMarker>();
  private byKey = new Map<string, MapMarker>();
  private lastSelected: string | null = null;
  private fitted = false;
  private dead = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => (this.dead = true));
    afterNextRender(() => void this.init(destroyRef));
    effect(() => {
      const buildings = this.buildings();
      if (this.ready()) untracked(() => this.drawBuildings(buildings));
    });
    effect(() => {
      const markers = this.markers();
      if (this.ready()) untracked(() => this.drawMarkers(markers));
    });
    effect(() => {
      const key = this.selected();
      if (this.ready()) untracked(() => this.highlight(key));
    });
    effect(() => {
      const draft = this.draft();
      if (this.ready()) untracked(() => this.drawDraft(draft));
    });
    effect(() => {
      const id = this.focusBuilding();
      if (this.ready() && id) untracked(() => this.zoomToBuilding(id));
    });
  }

  private async init(destroyRef: DestroyRef): Promise<void> {
    try {
      this.L = await this.loadLeaflet();
    } catch {
      this.failed.set(true);
      return;
    }
    if (this.dead) return;
    const L = this.L;
    const map = (this.map = L.map(this.host().nativeElement, { preferCanvas: true, renderer: L.canvas({ padding: 0.5 }) }));
    map.setView([0, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => this.tilesFailed.set(true))
      .addTo(map);
    this.buildingLayer = L.layerGroup().addTo(map);
    this.draftLayer = L.layerGroup().addTo(map);
    this.markerLayer = L.layerGroup().addTo(map);
    map.on('click', (e: Leaflet.LeafletMouseEvent) => this.mapClick.emit([e.latlng.lat, e.latlng.lng]));
    // Leaflet only tracks window resizes; the sidenav or a panel can resize the container too.
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.invalidateSize());
    resized?.observe(this.host().nativeElement);
    destroyRef.onDestroy(() => {
      resized?.disconnect();
      map.remove();
    });
    this.ready.set(true);
  }

  private drawBuildings(buildings: BuildingShape[]): void {
    const L = this.L;
    this.buildingLayer!.clearLayers();
    for (const b of buildings) {
      if (b.perimeter?.length) {
        L.polygon(b.perimeter, { color: OUTLINE, weight: 2, fillOpacity: 0.08 })
          .bindTooltip(b.name)
          .on('click', () => this.buildingClick.emit(b.id))
          .addTo(this.buildingLayer!);
      }
      if (b.defaultLat !== null && b.defaultLng !== null) {
        L.circleMarker([b.defaultLat, b.defaultLng], { radius: 3, color: OUTLINE, weight: 1, fillColor: OUTLINE, fillOpacity: 1, interactive: false })
          .addTo(this.buildingLayer!);
      }
    }
    this.fitOnce();
  }

  private drawMarkers(markers: MapMarker[]): void {
    const L = this.L;
    this.markerLayer!.clearLayers();
    this.layers.clear();
    this.byKey.clear();
    let n = 0;
    for (const m of markers) {
      if (!pinned(m)) continue;
      const key = markerKey(m);
      const layer = L.circleMarker([m.location.lat!, m.location.lng!], markerStyle(m, key === this.selected()))
        .bindTooltip(`${m.no} · ${SOURCE_LABEL[m.location.source]}`)
        .on('click', () => this.markerClick.emit(m));
      layer.addTo(this.markerLayer!);
      this.layers.set(key, layer);
      this.byKey.set(key, m);
      n++;
    }
    this.lastSelected = this.selected();
    this.drawn.set(n);
    this.fitOnce();
  }

  private highlight(key: string | null): void {
    const prev = this.lastSelected;
    this.lastSelected = key;
    if (prev && prev !== key && this.byKey.has(prev)) this.layers.get(prev)!.setStyle(markerStyle(this.byKey.get(prev)!));
    const m = key ? this.byKey.get(key) : undefined;
    if (!key || !m) return;
    const layer = this.layers.get(key)!;
    layer.setStyle(markerStyle(m, true));
    layer.bringToFront();
    this.map!.panTo(layer.getLatLng());
  }

  private drawDraft(draft: GeometryDraft | null): void {
    const L = this.L;
    this.draftLayer!.clearLayers();
    if (!draft) return;
    const pts = draft.perimeter;
    if (pts.length >= 3) L.polygon(pts, { color: DRAFT, weight: 2, fillOpacity: 0.15, interactive: false }).addTo(this.draftLayer!);
    else if (pts.length === 2) L.polyline(pts, { color: DRAFT, weight: 2, interactive: false }).addTo(this.draftLayer!);
    pts.forEach((p, i) =>
      L.circleMarker(p, { radius: 5, color: SURFACE, weight: 2, fillColor: DRAFT, fillOpacity: 1, interactive: false })
        .bindTooltip(String(i + 1), { permanent: pts.length <= 30, direction: 'top' })
        .addTo(this.draftLayer!),
    );
    if (draft.pin) {
      L.circleMarker(draft.pin, { radius: 8, color: DRAFT, weight: 3, fillColor: SURFACE, fillOpacity: 1, interactive: false })
        .bindTooltip('Default pin')
        .addTo(this.draftLayer!);
    }
    this.fitOnce();
  }

  private zoomToBuilding(id: string): void {
    const b = this.buildings().find((x) => x.id === id);
    if (!b) return;
    if (b.perimeter && b.perimeter.length >= 3) this.map!.fitBounds(this.L.latLngBounds(b.perimeter), { padding: [24, 24], maxZoom: 19 });
    else if (b.defaultLat !== null && b.defaultLng !== null) this.map!.setView([b.defaultLat, b.defaultLng], 18);
  }

  /** First time there is anything to show, frame all of it; later refreshes keep the user's view. */
  private fitOnce(): void {
    if (this.fitted) return;
    const pts: LatLng[] = [];
    for (const b of this.buildings()) {
      if (b.perimeter) pts.push(...b.perimeter);
      if (b.defaultLat !== null && b.defaultLng !== null) pts.push([b.defaultLat, b.defaultLng]);
    }
    for (const m of this.markers()) if (pinned(m)) pts.push([m.location.lat!, m.location.lng!]);
    const d = this.draft();
    if (d) pts.push(...d.perimeter, ...(d.pin ? [d.pin] : []));
    if (!pts.length) return;
    this.fitted = true;
    this.map!.fitBounds(this.L.latLngBounds(pts), { padding: [24, 24], maxZoom: 18 });
  }
}
