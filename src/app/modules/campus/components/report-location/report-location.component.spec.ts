import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UiService } from '@app/shared/services/ui.service';
import { ReportLocation } from '../../campus.models';
import { LEAFLET } from '../../campus.service';
import { FakeLeaflet } from '../../testing/fake-leaflet';
import { ReportLocationComponent } from './report-location.component';

const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
  await new Promise((r) => setTimeout(r));
  await fixture.whenStable();
};

const CAMPUS = { centerLat: 10.326321, centerLng: 123.954995, radiusMeters: 600, minZoom: 16 };
const OLD = {
  id: 'b1', code: 'OLD', name: 'Old Building', defaultLat: null, defaultLng: null, toleranceMeters: 25, geometryRevision: 3,
  perimeter: [[10.325021, 123.953553], [10.324783, 123.953885], [10.325337, 123.954368]] as [number, number][], counts: { reports: 1, workOrders: 0 },
};
const UNPINNED: ReportLocation = {
  report: { id: 'r1', no: 'RPT-1', status: 'PENDING_REVIEW', buildingText: 'old bldg', buildingMatch: 'NAME' },
  building: null,
  location: { source: 'NONE', lat: null, lng: null, rawGps: null, gpsCheck: 'NO_GPS' },
  suggestion: { lat: 10.325047, lng: 123.953935, buildingId: 'b1', buildingName: 'Old Building', basis: 'SIMILAR_NAME' },
  campus: CAMPUS,
  canCorrect: true,
};

describe('ReportLocationComponent', () => {
  async function setup(answer: ReportLocation = UNPINNED, confirm = true) {
    const fake = new FakeLeaflet();
    TestBed.configureTestingModule({
      imports: [ReportLocationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LEAFLET, useValue: async () => fake.module() }],
    });
    const ui = TestBed.inject(UiService);
    vi.spyOn(ui, 'confirm').mockResolvedValue(confirm);
    vi.spyOn(ui, 'toast').mockImplementation(() => undefined);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReportLocationComponent);
    fixture.componentRef.setInput('reportId', 'r1');
    await fixture.whenStable();
    http.expectOne('/api/map/reports/r1').flush(answer);
    await settle(fixture);
    await settle(fixture);
    return { fake, http, fixture, ui, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows only this report on a campus-bounded map', async () => {
    const pinned: ReportLocation = {
      ...UNPINNED, building: OLD, suggestion: null, canCorrect: false,
      location: { source: 'BUILDING_DEFAULT', lat: 10.325047, lng: 123.953935, rawGps: null, gpsCheck: 'NO_GPS', defaultFrom: 'PERIMETER_CENTER' },
    };
    const { fake, el } = await setup(pinned);
    expect(fake.circles.filter((c) => c.tooltip?.includes('·')).map((c) => c.tooltip)).toEqual(['RPT-1 · Building location']);
    expect(fake.polygons.map((p) => p.tooltip)).toEqual(['Old Building']);
    expect(fake.map!.minZoom).toBe(16);
    expect(el.querySelector('[data-field="provenance"]')?.textContent).toContain("centre of the building's outline");
    expect(el.querySelector('[data-action="pick"]')).toBeNull(); // read-only for roles that can't correct
  });

  it('places an unpinned report at the matched building after confirming', async () => {
    const { http, fixture, ui, el } = await setup();
    expect(el.querySelector('[data-banner="unpinned"]')?.textContent).toContain("isn't on the campus map yet");
    el.querySelector<HTMLButtonElement>('[data-action="use-building"]')!.click();
    await settle(fixture);
    expect(ui.confirm).toHaveBeenCalled();
    const req = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/map/reports/r1/location');
    expect(req.request.body).toEqual({ lat: 10.325047, lng: 123.953935, source: 'BUILDING', buildingId: 'b1', reason: 'Placed at Old Building' });
    req.flush({
      ...UNPINNED, building: OLD,
      location: { ...UNPINNED.location, source: 'CORRECTED', lat: 10.325047, lng: 123.953935, correction: { source: 'BUILDING', reason: 'Placed at Old Building', updatedAt: null, updatedBy: 'Staff' } },
    });
    await settle(fixture);
    expect(el.querySelector('.source')?.textContent).toBe('Set by maintenance');
    expect(el.querySelector('[data-action="clear"]')).not.toBeNull();
  });

  it('a cancelled confirmation changes nothing', async () => {
    const { http, fixture, el } = await setup(UNPINNED, false);
    el.querySelector<HTMLButtonElement>('[data-action="use-building"]')!.click();
    await settle(fixture);
    http.expectNone((r) => r.method === 'PUT');
  });

  it('picks a point by click or drag, refuses one outside the campus, then saves it with the reason', async () => {
    const { http, fixture, fake, cmp, el } = await setup();
    el.querySelector<HTMLButtonElement>('[data-action="pick"]')!.click();
    await settle(fixture);
    expect(cmp.point()).toEqual([10.325047, 123.953935]); // starts at the suggestion
    fake.map!.fire('click', { latlng: { lat: 10.4, lng: 123.95 } });
    await settle(fixture);
    expect(el.querySelector('[data-error="point"]')?.textContent).toContain('outside the campus map area');
    fake.handles.at(-1)!.dragTo([10.3262, 123.955]);
    await settle(fixture);
    expect(el.querySelector('[data-error="point"]')).toBeNull();
    cmp.reason.set('Pinned from the photo');
    const saving = cmp.savePoint();
    const req = http.expectOne((r) => r.method === 'PUT');
    expect(req.request.body).toEqual({ lat: 10.3262, lng: 123.955, source: 'MANUAL', reason: 'Pinned from the photo' });
    req.flush({ ...UNPINNED, location: { ...UNPINNED.location, source: 'CORRECTED', lat: 10.3262, lng: 123.955 } });
    await saving;
    expect(cmp.editing()).toBe(false);
  });

  it('removes a saved location after confirming', async () => {
    const corrected: ReportLocation = {
      ...UNPINNED,
      location: { source: 'CORRECTED', lat: 10.3262, lng: 123.955, rawGps: null, gpsCheck: 'NO_GPS', correction: { source: 'MANUAL', reason: null, updatedAt: null, updatedBy: 'Staff' } },
    };
    const { http, fixture, el } = await setup(corrected);
    el.querySelector<HTMLButtonElement>('[data-action="clear"]')!.click();
    await settle(fixture);
    http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/map/reports/r1/location').flush(UNPINNED);
    await settle(fixture);
    expect(el.querySelector('.source')?.textContent).toBe('Not pinned');
  });
});
