import type * as Leaflet from 'leaflet';

type Handler = (e?: unknown) => void;

/** Just enough of Leaflet for CampusMapViewComponent in jsdom (no canvas there). Records what was drawn. */
export class FakeLeaflet {
  readonly circles: FakeLayer[] = [];
  readonly polygons: FakeLayer[] = [];
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
    };
    return api as unknown as typeof Leaflet;
  }
}

export class FakeLayer {
  readonly handlers = new Map<string, Handler>();
  children: FakeLayer[] = [];
  tooltip?: string;

  constructor(
    readonly latlng?: unknown,
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
    return this.latlng;
  }
  bringToFront() {
    return this;
  }
  setView() {
    return this;
  }
  fitBounds() {
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
