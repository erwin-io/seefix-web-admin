import type * as Leaflet from 'leaflet';

type Handler = (e?: unknown) => void;

/** Just enough of Leaflet for CampusMapViewComponent in jsdom (no canvas there). Records what was drawn. */
export class FakeLeaflet {
  readonly circles: FakeLayer[] = [];
  readonly polygons: FakeLayer[] = [];
  /** Draggable draft handles (L.marker) and campus circles (L.circle). */
  readonly handles: FakeLayer[] = [];
  readonly campusCircles: FakeLayer[] = [];
  tiles?: FakeLayer;
  map?: FakeLayer;

  module(): typeof Leaflet {
    const layer = (kind: 'circle' | 'polygon' | 'other', latlng?: unknown, opts?: unknown) => {
      const l = new FakeLayer(latlng, opts);
      if (kind === 'circle') this.circles.push(l);
      if (kind === 'polygon') this.polygons.push(l);
      return l;
    };
    const api = {
      map: () => (this.map = new FakeLayer()),
      canvas: () => ({}),
      tileLayer: () => (this.tiles = new FakeLayer()),
      layerGroup: () => new FakeLayer(),
      circleMarker: (latlng: unknown, opts: unknown) => layer('circle', latlng, opts),
      polygon: (latlng: unknown, opts: unknown) => layer('polygon', latlng, opts),
      polyline: (latlng: unknown, opts: unknown) => layer('other', latlng, opts),
      latLngBounds: (pts: unknown) => ({ pts }),
      marker: (latlng: unknown, opts: unknown) => {
        const l = new FakeLayer(latlng, opts);
        this.handles.push(l);
        return l;
      },
      divIcon: (opts: unknown) => opts,
      circle: (latlng: unknown, opts: unknown) => {
        const l = new FakeLayer(latlng, opts);
        this.campusCircles.push(l);
        return l;
      },
      DomEvent: { stopPropagation: () => undefined },
    };
    return api as unknown as typeof Leaflet;
  }
}

export class FakeLayer {
  readonly handlers = new Map<string, Handler>();
  children: FakeLayer[] = [];
  tooltip?: string;
  /** Map state recorded by the fake (map layer only). */
  minZoom?: number;
  maxBounds?: unknown;
  view?: { center: unknown; zoom: unknown };
  fitted?: unknown;

  constructor(
    public latlng?: unknown,
    public opts?: unknown,
  ) {}

  on(event: string, fn: Handler) {
    this.handlers.set(event, fn);
    return this;
  }
  fire(event: string, e?: unknown) {
    this.handlers.get(event)?.(e);
  }
  addTo(parent: FakeLayer) {
    parent.children.push(this);
    return this;
  }
  clearLayers() {
    this.children = [];
    return this;
  }
  bindTooltip(text: string) {
    this.tooltip = text;
    return this;
  }
  setStyle(opts: unknown) {
    this.opts = opts;
    return this;
  }
  getLatLng() {
    const [lat, lng] = this.latlng as [number, number];
    return Object.assign([lat, lng], { lat, lng });
  }
  /** Test helper: move a draggable handle like a user drag would, firing its events. */
  dragTo(point: [number, number]) {
    this.fire('dragstart');
    this.latlng = point;
    this.fire('drag');
    this.fire('dragend');
  }
  setLatLngs(pts: unknown) {
    this.latlng = pts;
    return this;
  }
  setMinZoom(z: number) {
    this.minZoom = z;
    return this;
  }
  setMaxBounds(b: unknown) {
    this.maxBounds = b;
    return this;
  }
  getZoom() {
    return 17;
  }
  bringToFront() {
    return this;
  }
  setView(center?: unknown, zoom?: unknown) {
    this.view = { center, zoom };
    return this;
  }
  fitBounds(bounds?: unknown) {
    this.fitted = bounds;
    return this;
  }
  panTo() {
    return this;
  }
  invalidateSize() {
    return this;
  }
  remove() {
    return this;
  }
}
