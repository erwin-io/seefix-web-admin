import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { MapMarker, MapResponse } from '../../campus.models';
import { LEAFLET } from '../../campus.service';
import { FakeLeaflet } from '../../testing/fake-leaflet';
import { CacheSyncService } from '@app/core/data/cache-sync.service';
import { CampusMapPage, MAP_LIVE_MS } from './campus-map.page';

const OLD = {
  id: 'b1', code: 'OLD', name: 'Old Building', defaultLat: 14.6, defaultLng: 121.0, toleranceMeters: 25, geometryRevision: 2,
  perimeter: [[14.6, 121.0], [14.6, 121.001], [14.601, 121.001]] as [number, number][], counts: { reports: 2, workOrders: 1 },
};
const NEW = { ...OLD, id: 'b2', code: 'NEW', name: 'New Building', perimeter: null, defaultLat: null, defaultLng: null, counts: { reports: 1, workOrders: 0 } };

const marker = (over: Partial<MapMarker>): MapMarker => ({
  kind: 'REPORT', id: 'r1', no: 'RPT-1', status: 'PENDING_REVIEW', category: 'PLUMBING', urgency: 'High', buildingId: 'b1', buildingName: 'Old Building',
  buildingMatch: 'LOCATION', route: '/reports/r1',
  location: { source: 'GPS', lat: 14.6004, lng: 121.0004, rawGps: { lat: 14.6004, lng: 121.0004 }, gpsCheck: 'INSIDE' },
  ...over,
});

const MAP: MapResponse = {
  buildings: [OLD, NEW],
  markers: [
    marker({}),
    marker({
      id: 'r2', no: 'RPT-2', category: 'ELECTRICAL', urgency: 'Low',
      location: { source: 'BUILDING_DEFAULT', lat: 14.6, lng: 121.0, rawGps: { lat: 14.7123456, lng: 121.1 }, gpsCheck: 'OUTSIDE', gpsDistanceMeters: 1234.5 },
    }),
    marker({
      id: 'r3', no: 'RPT-3', buildingId: 'b2', buildingName: 'New Building', buildingMatch: 'NAME',
      location: { source: 'NONE', lat: null, lng: null, rawGps: null, gpsCheck: 'NO_GPS' },
    }),
    marker({ kind: 'WORK_ORDER', id: 'w1', no: 'WO-1', status: 'ASSIGNED', route: '/work-orders/w1' }),
  ],
};

const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
  await new Promise((r) => setTimeout(r));
  await fixture.whenStable();
};

describe('CampusMapPage', () => {
  async function setup(map: MapResponse = MAP, leafletFails = false) {
    const fake = new FakeLeaflet();
    const leaflet = async () => (leafletFails ? Promise.reject(new Error('blocked')) : fake.module());
    TestBed.configureTestingModule({
      imports: [CampusMapPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: LEAFLET, useValue: leaflet }],
    });
    TestBed.inject(SessionService).user.set({ id: 'a', role: 'ADMIN', fullName: 'Ada Admin' } as never);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CampusMapPage);
    await fixture.whenStable();
    http.expectOne('/api/map').flush(map);
    await settle(fixture);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const cells = (col: string) => [...el.querySelectorAll(`td.mat-column-${col}`)].map((td) => td.textContent?.replace(/\s+/g, ' ').trim());
    return { fake, http, fixture, el, page: fixture.componentInstance, cells };
  }

  it('labels every item by provenance and shows raw GPS, also for missing GPS', async () => {
    const { cells, el } = await setup();
    expect(cells('ref')).toEqual(['RPT-1Report', 'RPT-2Report', 'RPT-3Report', 'WO-1Work order']);
    const location = cells('location');
    expect(location[0]).toBe('Submitted GPSGPS is inside the building perimeter');
    expect(location[1]).toBe("Building locationGPS is 1234.5 m outside the building perimeter; shown at the building's default pin");
    expect(location[2]).toBe('Not pinnedNo GPS submitted and no building location to show it at');
    expect(cells('gps')).toEqual(['14.6004, 121.0004', '14.7123456, 121.1', 'No GPS submitted', '14.6004, 121.0004']);
    expect(cells('building')[2]).toBe('New BuildingMatched by building name');
    expect(el.querySelector('[data-banner="unpinned"]')?.textContent).toContain('1 shown item has no map position');
  });

  it('pins only positioned markers, solid for GPS and hollow for building default, and draws building outlines', async () => {
    const { fake } = await setup();
    const pins = fake.circles.filter((c) => c.tooltip?.includes('·'));
    expect(pins.map((c) => c.tooltip)).toEqual(['RPT-1 · Submitted GPS', 'RPT-2 · Building location', 'WO-1 · Submitted GPS']);
    expect((pins[0].opts as { fillColor: string }).fillColor).toBe('#2563eb');
    expect((pins[1].opts as { dashArray?: string }).dashArray).toBeDefined();
    expect((pins[2].opts as { fillColor: string }).fillColor).toBe('#d9480f');
    expect(fake.polygons.map((p) => p.tooltip)).toEqual(['Old Building']);
  });

  it('shows details with raw GPS for a selected marker, drills into a building with API counts, and never writes', async () => {
    const { fixture, el, page, fake, http, cells } = await setup();
    fake.circles.find((c) => c.tooltip?.startsWith('RPT-2'))!.fire('click');
    await fixture.whenStable();
    const details = el.querySelector('[data-panel="marker"]')!;
    expect(details.querySelector('[data-field="source"]')?.textContent).toBe('Building location');
    expect(details.querySelector('[data-field="raw-gps"]')?.textContent).toBe('14.7123456, 121.1');

    page.select(null);
    fake.polygons[0].fire('click'); // building outline → drill-down
    await fixture.whenStable();
    const counts = [...el.querySelectorAll('[data-panel="building"] .counts span')].map((x) => x.textContent?.replace(/\s+/g, ' ').trim());
    expect(counts).toEqual(['2 active reports', '1 active work orders']);
    expect(cells('ref')).toEqual(['RPT-1Report', 'RPT-2Report', 'WO-1Work order']);

    page.clearFilters();
    page.setFilter('category', 'ELECTRICAL');
    await fixture.whenStable();
    expect(cells('ref')).toEqual(['RPT-2Report']);
    http.verify(); // filters and drill-down are local; the map never reclassifies anything
  });

  it('keeps the map inside the campus area and centres on a picked building, every time', async () => {
    const campus = { centerLat: 14.6005, centerLng: 121.0005, radiusMeters: 600, minZoom: 16 };
    const { fake, page, fixture, el } = await setup({ ...MAP, campus });
    expect(fake.map!.minZoom).toBe(16);
    const [sw, ne] = (fake.map!.maxBounds as { pts: [number, number][] }).pts;
    expect(ne[0] - sw[0]).toBeCloseTo((2 * 600) / 111_195, 4); // 1.2 km north–south
    expect(sw[1]).toBeLessThan(121.0005);
    expect(ne[1]).toBeGreaterThan(121.0005);

    page.openBuilding('b1');
    await fixture.whenStable();
    expect((fake.map!.fitted as { pts: unknown }).pts).toEqual(OLD.perimeter);
    fake.map!.fitted = undefined;
    page.openBuilding('b1'); // same building again: still re-centres
    expect((fake.map!.fitted as { pts: unknown }).pts).toEqual(OLD.perimeter);

    page.openBuilding('b2'); // no outline, no pin
    await fixture.whenStable();
    expect(el.querySelector('[data-banner="no-location"]')?.textContent).toContain("New Building has no outline or pin yet");
    page.openBuilding(null);
    await fixture.whenStable();
    expect(el.querySelector('[data-banner="no-location"]')).toBeNull();
  });

  it('a building click on the map selects it without also counting as a map click', async () => {
    const { fake, page, fixture } = await setup();
    const outline = fake.polygons.find((p) => p.tooltip === 'Old Building')!;
    outline.fire('click', {});
    await fixture.whenStable();
    expect(page.filter().buildingId).toBe('b1');
  });

  it('asks for changes every 15 s while the page is open, and stops when it closes', async () => {
    vi.useFakeTimers();
    try {
      const fake = new FakeLeaflet();
      TestBed.configureTestingModule({
        imports: [CampusMapPage],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: LEAFLET, useValue: async () => fake.module() }],
      });
      const poll = vi.spyOn(TestBed.inject(CacheSyncService), 'poll');
      const fixture = TestBed.createComponent(CampusMapPage);
      expect(MAP_LIVE_MS).toBe(15_000);
      const entry = poll.mock.calls.length; // the module-entry check
      vi.advanceTimersByTime(MAP_LIVE_MS * 2);
      expect(poll).toHaveBeenCalledTimes(entry + 2);
      fixture.destroy();
      vi.advanceTimersByTime(MAP_LIVE_MS * 2);
      expect(poll).toHaveBeenCalledTimes(entry + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('warns when map tiles fail and still lists everything', async () => {
    const { fixture, el, fake, cells } = await setup();
    fake.tiles!.fire('tileerror');
    await fixture.whenStable();
    expect(el.querySelector('[data-banner="tiles-failed"]')?.textContent).toContain('tiles');
    expect(cells('ref')).toHaveLength(4);
  });

  it('falls back to the table when Leaflet cannot load', async () => {
    const { el, cells } = await setup(MAP, true);
    expect(el.querySelector('[data-banner="map-failed"]')?.textContent).toContain("couldn't load");
    expect(cells('ref')).toHaveLength(4);
  });

  it('handles 5,000 markers: one request, every pin drawn, table paged, filters fast', async () => {
    const markers = Array.from({ length: 5000 }, (_, i) =>
      marker({
        id: `r${i}`, no: `RPT-${i}`, status: i % 2 ? 'PENDING_REVIEW' : 'SUBMITTED', category: i % 3 ? 'PLUMBING' : 'ELECTRICAL',
        location: { source: 'GPS', lat: 14.6 + (i % 100) / 1e5, lng: 121 + i / 1e6, rawGps: { lat: 14.6, lng: 121 }, gpsCheck: 'INSIDE' },
      }),
    );
    const started = performance.now();
    const { fake, cells, page, fixture } = await setup({ buildings: [OLD], markers });
    expect(fake.circles.filter((c) => c.tooltip?.includes('·'))).toHaveLength(5000);
    expect(cells('ref')).toHaveLength(25); // MatPaginator: only one page of rows in the DOM
    const t = performance.now();
    page.setFilter('category', 'ELECTRICAL');
    await fixture.whenStable();
    expect(page.filtered()).toHaveLength(1667);
    expect(performance.now() - t).toBeLessThan(1500);
    expect(performance.now() - started).toBeLessThan(10000);
  });
});
