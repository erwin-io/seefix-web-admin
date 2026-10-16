import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { LEAFLET } from '../../campus.service';
import { CampusArea, LatLng, MapMarker } from '../../campus.models';
import { SOURCE_LABEL, campusBounds, pinned, round6, wrapLng } from '../../geometry';

/** Outline + default pin of one building. */
export interface BuildingShape {
  id: string;
  name: string;
  perimeter: LatLng[] | null;
  defaultLat: number | null;
  defaultLng: number | null;
}

/** Geometry being edited (building settings, a report's map location, the campus centre). */
export interface GeometryDraft {
  perimeter: LatLng[];
  pin: LatLng | null;
  /** The point that can be dragged: a perimeter index or the pin. Nothing else moves, so a stray click can't. */
  moving?: number | 'pin' | null;
  /** Tooltip of the pin (default "Default pin"). */
  pinLabel?: string;
}

/** A dragged draft point: emitted while dragging (`done: false`) and once when dropped (`done: true`). */
export interface DraftMove {
  target: number | 'pin';
  point: LatLng;
  done: boolean;
}

/** Marker colour = kind (validated pair, CVD-safe). Fill = provenance: solid GPS / set by maintenance, hollow dashed building location. */
export const KIND_COLOR: Record<MapMarker['kind'], string> = { REPORT: '#2563eb', WORK_ORDER: '#d9480f' };
const SURFACE = '#ffffff';
const OUTLINE = '#475569';
const DRAFT = '#6d28d9';
/** First view of a campus-bounded map, never further out than the campus minimum zoom. */
const CAMPUS_ZOOM = 17;

export const markerKey = (m: MapMarker) => `${m.kind}:${m.id}`;

export function markerStyle(m: MapMarker, selected = false): Leaflet.CircleMarkerOptions {
  const color = KIND_COLOR[m.kind];
  const radius = selected ? 10 : 6;
  return m.location.source === 'GPS' || m.location.source === 'CORRECTED'
    ? { radius, color: SURFACE, weight: 2, fillColor: color, fillOpacity: 0.95 }
    : { radius, color, weight: 3, dashArray: '3 3', fillColor: SURFACE, fillOpacity: 1 };
}

/** Where to centre on a building: the middle of its outline, else its pin (null: it has no location yet). */
export function buildingCenter(b: BuildingShape): LatLng | null {
  if (b.perimeter && b.perimeter.length >= 3) {
    const lats = b.perimeter.map((p) => p[0]);
    const lngs = b.perimeter.map((p) => p[1]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  }
  return b.defaultLat !== null && b.defaultLng !== null ? [b.defaultLat, b.defaultLng] : null;
}

/**
 * Leaflet map (OpenStreetMap tiles, canvas renderer so thousands of pins stay smooth). Leaflet is loaded lazily;
 * if it or the tiles fail, `failed` / `tilesFailed` are set and the page falls back to its table. With a campus area
 * the map can't zoom out past its minimum zoom or pan outside it. Display only: a click selects or reports
 * coordinates to the page, and only the draft point named in `draft.moving` can be dragged.
 */
@Component({
  selector: 'app-campus-map-view',
  template: `<div #host class="map-host" role="region" [attr.aria-label]="label()"></div>`,
  styles: `
    :host { display: block; position: relative; }
    .map-host { height: var(--map-height, 480px); border-radius: 12px; border: 1px solid var(--sf-border); background: #eef1f5; }
    :host ::ng-deep .sf-drag-handle {
      display: grid; place-items: center; border-radius: 50%; background: ${DRAFT}; color: #fff; font: 600 12px/1 system-ui, sans-serif;
      border: 3px solid #fff; box-shadow: 0 0 0 3px ${DRAFT}, 0 2px 8px rgb(0 0 0 / 35%); cursor: grab;
    }
    :host ::ng-deep .sf-drag-handle:active { cursor: grabbing; }
  `,
})
export class CampusMapViewComponent {
  readonly label = input('Campus map');
  readonly buildings = input<BuildingShape[]>([]);
  readonly markers = input<MapMarker[]>([]);
  readonly selected = input<string | null>(null);
  /** Centre on this building (drill-down). `focus()` re-centres on the same one. */
  readonly focusBuilding = input<string | null>(null);
  readonly draft = input<GeometryDraft | null>(null);
  /** Campus area: the first view, and (when `bounded`) the zoom-out and pan limits. */
  readonly campus = input<CampusArea | null>(null);
  readonly bounded = input(true);
  /** Draw the campus circle (campus settings preview). */
  readonly showCampus = input(false);
  readonly markerClick = output<MapMarker>();
  readonly buildingClick = output<string>();
  /** Map clicks, longitude already wrapped into −180…180 and rounded to 6 decimals. */
  readonly mapClick = output<LatLng>();
  readonly draftMove = output<DraftMove>();

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
  private campusLayer?: Leaflet.LayerGroup;
  private buildingLayer?: Leaflet.LayerGroup;
  private markerLayer?: Leaflet.LayerGroup;
  private draftLayer?: Leaflet.LayerGroup;
  private draftShape?: Leaflet.Polygon | Leaflet.Polyline;
  private layers = new Map<string, Leaflet.CircleMarker>();
  private byKey = new Map<string, MapMarker>();
  private lastSelected: string | null = null;
  private fitted = false;
  private dragging = false;
  private dead = false;
  /** Campus preview: fit the ring again once the container has its real size (it can be 0×0 at first). */
  private refit: (() => void) | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => (this.dead = true));
    afterNextRender(() => void this.init(destroyRef));
    effect(() => {
      const campus = this.campus();
      const show = this.showCampus();
      const bounded = this.bounded();
      if (this.ready()) untracked(() => this.applyCampus(campus, bounded, show));
    });
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
      if (this.ready() && id) untracked(() => this.focus(id));
    });
  }

  /** Centre on a building (its outline, else its pin). Returns false when it has no location yet. */
  focus(id: string): boolean {
    const b = this.buildings().find((x) => x.id === id);
    if (!this.map || !b) return false;
    this.fitted = true; // a later data refresh must not jump away from the building the user picked
    if (b.perimeter && b.perimeter.length >= 3) {
      this.map.fitBounds(this.L.latLngBounds(b.perimeter), { padding: [32, 32], maxZoom: 19, animate: true });
      return true;
    }
    const c = buildingCenter(b);
    if (!c) return false;
    this.map.setView(c, Math.max(this.map.getZoom(), 18), { animate: true });
    return true;
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
    const map = (this.map = L.map(this.host().nativeElement, {
      preferCanvas: true,
      renderer: L.canvas({ padding: 0.5 }),
      maxBoundsViscosity: 1, // the campus edge is a hard stop, not elastic
    }));
    const c = this.campus();
    if (c) map.setView([c.centerLat, c.centerLng], Math.max(c.minZoom, CAMPUS_ZOOM));
    else map.setView([0, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => this.tilesFailed.set(true))
      .addTo(map);
    this.campusLayer = L.layerGroup().addTo(map);
    this.buildingLayer = L.layerGroup().addTo(map);
    this.draftLayer = L.layerGroup().addTo(map);
    this.markerLayer = L.layerGroup().addTo(map);
    map.on('click', (e: Leaflet.LeafletMouseEvent) => this.mapClick.emit([round6(e.latlng.lat), round6(wrapLng(e.latlng.lng))]));
    // Leaflet only tracks window resizes; the sidenav or a panel can resize the container too.
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      map.invalidateSize();
      const fit = this.refit;
      this.refit = null; // once: later resizes keep whatever view the user chose
      fit?.();
    });
    resized?.observe(this.host().nativeElement);
    destroyRef.onDestroy(() => {
      resized?.disconnect();
      map.remove();
    });
    this.ready.set(true);
  }

  private applyCampus(c: CampusArea | null, bounded: boolean, show: boolean): void {
    const map = this.map!;
    this.campusLayer!.clearLayers();
    if (!c) return;
    if (bounded) {
      map.setMinZoom(c.minZoom);
      map.setMaxBounds(this.L.latLngBounds(campusBounds(c)));
      if (!this.fitted) map.setView([c.centerLat, c.centerLng], Math.max(c.minZoom, CAMPUS_ZOOM));
    }
    if (show) {
      if (!this.fitted) {
        this.fitted = true;
        const bounds = this.L.latLngBounds(campusBounds(c));
        this.refit = () => map.fitBounds(bounds, { padding: [12, 12] });
        this.refit();
      }
      this.L.circle([c.centerLat, c.centerLng], { radius: c.radiusMeters, color: DRAFT, weight: 2, dashArray: '6 6', fillOpacity: 0.04, interactive: false })
        .addTo(this.campusLayer!);
    }
  }

  private drawBuildings(buildings: BuildingShape[]): void {
    const L = this.L;
    this.buildingLayer!.clearLayers();
    for (const b of buildings) {
      if (b.perimeter?.length) {
        L.polygon(b.perimeter, { color: OUTLINE, weight: 2, fillOpacity: 0.08 })
          .bindTooltip(b.name)
          .on('click', (e: Leaflet.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e); // a building click is not also a map click
            this.buildingClick.emit(b.id);
          })
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
    // While a point is dragged it moves itself (and the outline follows); redrawing would drop it mid-drag.
    if (this.dragging) return;
    const L = this.L;
    this.draftLayer!.clearLayers();
    this.draftShape = undefined;
    if (!draft) return;
    const pts = draft.perimeter;
    if (pts.length >= 3) this.draftShape = L.polygon(pts, { color: DRAFT, weight: 2, fillOpacity: 0.15, interactive: false }).addTo(this.draftLayer!);
    else if (pts.length === 2) this.draftShape = L.polyline(pts, { color: DRAFT, weight: 2, interactive: false }).addTo(this.draftLayer!);
    pts.forEach((p, i) => {
      if (draft.moving === i) {
        this.handle(p, i, String(i + 1), `Point ${i + 1}: drag to move`).addTo(this.draftLayer!);
        return;
      }
      L.circleMarker(p, { radius: 5, color: SURFACE, weight: 2, fillColor: DRAFT, fillOpacity: 1, interactive: false })
        .bindTooltip(String(i + 1), { permanent: pts.length <= 30, direction: 'top' })
        .addTo(this.draftLayer!);
    });
    if (draft.pin) {
      const label = draft.pinLabel ?? 'Default pin';
      if (draft.moving === 'pin') {
        this.handle(draft.pin, 'pin', '', `${label}: drag to move`).addTo(this.draftLayer!);
      } else {
        L.circleMarker(draft.pin, { radius: 8, color: DRAFT, weight: 3, fillColor: SURFACE, fillOpacity: 1, interactive: false })
          .bindTooltip(label)
          .addTo(this.draftLayer!);
      }
    }
    this.fitOnce();
  }

  /** The one draggable point: a DOM marker (canvas circles can't be dragged), keyboard-focusable via Leaflet. */
  private handle(p: LatLng, target: number | 'pin', text: string, title: string): Leaflet.Marker {
    const L = this.L;
    const size = target === 'pin' ? 22 : 28;
    const marker = L.marker(p, {
      draggable: true,
      autoPan: true,
      title,
      alt: title,
      zIndexOffset: 1000,
      icon: L.divIcon({ className: 'sf-drag-handle', html: text, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
    });
    const at = (): LatLng => {
      const ll = marker.getLatLng();
      return [round6(ll.lat), round6(wrapLng(ll.lng))];
    };
    marker.on('dragstart', () => (this.dragging = true));
    marker.on('drag', () => {
      const point = at();
      if (typeof target === 'number' && this.draftShape) {
        const pts = (this.draft()?.perimeter ?? []).map((q, i) => (i === target ? point : q));
        this.draftShape.setLatLngs(pts);
      }
      this.draftMove.emit({ target, point, done: false });
    });
    marker.on('dragend', () => {
      this.dragging = false;
      this.draftMove.emit({ target, point: at(), done: true });
      this.drawDraft(this.draft());
    });
    return marker;
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
