import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Building, LatLng } from '../../campus.models';
import { LEAFLET } from '../../campus.service';
import { FakeLeaflet } from '../../testing/fake-leaflet';
import { BuildingEditPage, changesOf, formErrors, formOf } from './building-edit.page';

/** Dataset loads resolve outside Angular's task tracking: let them land, then render. */
const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
  await new Promise((r) => setTimeout(r));
  await fixture.whenStable();
};

const PERIMETER: LatLng[] = [
  [14.6, 121.0],
  [14.6, 121.001],
  [14.601, 121.001],
];

const building = (over: Partial<Building> = {}): Building => ({
  id: 'b1', code: 'OLD', name: 'Old Building', description: null, isActive: true, sortOrder: 1, defaultLat: 14.6005, defaultLng: 121.0005,
  perimeter: PERIMETER, toleranceMeters: 25, geometryRevision: 2, geometryUpdatedAt: '2026-10-01T00:00:00Z', updatedAt: null, ...over,
});

describe('building PATCH body', () => {
  it('sends only changed fields; a rename is not a geometry change (no revision sent)', () => {
    expect(changesOf(building(), { ...formOf(building()), name: ' New Name ' })).toEqual({ name: 'New Name' });
    expect(changesOf(building(), formOf(building()))).toEqual({});
  });

  it('sends the base geometry revision (and reason) with any location change', () => {
    const f = { ...formOf(building()), toleranceMeters: 40, reason: 'Survey' };
    expect(changesOf(building(), f)).toEqual({ toleranceMeters: 40, geometryRevision: 2, reason: 'Survey' });
    expect(changesOf(building(), { ...formOf(building()), perimeter: [] })).toEqual({ perimeter: null, geometryRevision: 2 });
    expect(changesOf(building(), { ...formOf(building()), defaultLat: null, defaultLng: null })).toEqual({
      defaultLat: null, defaultLng: null, geometryRevision: 2,
    });
  });

  it('validates required fields, the pin, tolerance and the perimeter', () => {
    const e = formErrors({ ...formOf(null), perimeter: PERIMETER.slice(0, 2), defaultLat: 14.6, toleranceMeters: 5000 }, true);
    expect(Object.keys(e).sort()).toEqual(['code', 'defaultLat', 'name', 'perimeter', 'toleranceMeters']);
    expect(formErrors({ ...formOf(building()), code: '' }, false)).toEqual({}); // code is fixed after creation
  });
});

const CAMPUS = { centerLat: 14.6005, centerLng: 121.0005, radiusMeters: 600, minZoom: 16 };

describe('BuildingEditPage', () => {
  async function setup() {
    const fake = new FakeLeaflet();
    TestBed.configureTestingModule({
      imports: [BuildingEditPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: LEAFLET, useValue: async () => fake.module() }],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BuildingEditPage);
    fixture.componentRef.setInput('id', 'b1');
    await fixture.whenStable();
    const list = (items: Building[]) => http.expectOne((r) => r.url === '/api/admin/buildings' && r.method === 'GET').flush({ items });
    const history = () => http.expectOne('/api/admin/buildings/b1/geometry-history').flush({ items: [] });
    http.expectOne('/api/admin/campus-settings').flush({ campus: CAMPUS, updatedAt: null, updatedBy: null });
    list([building()]);
    await settle(fixture);
    history();
    await settle(fixture);
    return { http, fixture, fake, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, list, history };
  }

  it('moves one point by dragging it on the map; the coordinates follow and stray clicks add nothing', async () => {
    const { fixture, fake, page, el, http } = await setup();
    expect(fake.map!.minZoom).toBe(16); // campus area applied to the editor map
    page.toggleMove(1);
    await settle(fixture);
    expect(el.querySelector('[data-banner="moving"]')?.textContent).toContain('Moving point 2');
    expect(fake.handles).toHaveLength(1);
    const handle = fake.handles[0];
    handle.dragTo([14.60111, 121.00222]);
    await settle(fixture);
    expect(page.form().perimeter[1]).toEqual([14.60111, 121.00222]);
    const lat = el.querySelector<HTMLInputElement>('input[aria-label="Point 2 latitude"]')!;
    expect(lat.valueAsNumber).toBe(14.60111);

    page.clickMode.set('vertex');
    page.mapClick([14.7, 121.1]); // while moving, a click never adds a point
    expect(page.form().perimeter).toHaveLength(PERIMETER.length);

    page.removeVertex(0); // removing an earlier point keeps the same point selected
    expect(page.moving()).toBe(0);
    page.toggleMove(0);
    expect(page.moving()).toBeNull();
    expect(page.changes()).toEqual({ perimeter: [[14.60111, 121.00222], PERIMETER[2]], geometryRevision: 2 });
    http.verify();
  });

  it('moves the default pin by dragging', async () => {
    const { fixture, fake, page, el } = await setup();
    el.querySelector<HTMLButtonElement>('[data-action="move-pin"]')!.click();
    await settle(fixture);
    expect(page.moving()).toBe('pin');
    fake.handles.at(-1)!.dragTo([14.6007, 121.0003]);
    await settle(fixture);
    expect([page.form().defaultLat, page.form().defaultLng]).toEqual([14.6007, 121.0003]);
  });

  it('handles 409 GEOMETRY_CONFLICT: nothing saved, latest revision shown, then re-saved on purpose', async () => {
    const { http, fixture, page, el, list, history } = await setup();
    expect(page.clickMode()).toBeNull(); // an outlined building opens in "Pan only": a stray click adds nothing
    page.mapClick([14.6, 121.0]);
    expect(page.form().perimeter).toEqual(PERIMETER);
    page.clickMode.set('vertex');
    page.mapClick([14.6012345678, 121.0004]); // adds a 4th perimeter point (rounded to 6 decimals)
    page.patch({ name: 'Old Building Annex' });
    const saving = page.save();
    const first = http.expectOne((r) => r.method === 'PATCH');
    expect(first.request.url).toBe('/api/admin/buildings/b1');
    expect(first.request.body).toEqual({ name: 'Old Building Annex', perimeter: [...PERIMETER, [14.601235, 121.0004]], geometryRevision: 2 });
    first.flush({ error: { code: 'GEOMETRY_CONFLICT', message: 'Changed by someone else.' } }, { status: 409, statusText: 'Conflict' });
    await saving;
    await settle(fixture);

    // The latest copy is fetched; the banner names both revisions and saving is blocked until the admin chooses.
    const theirs: LatLng[] = [[14.7, 121.1], [14.7, 121.2], [14.8, 121.2]];
    list([building({ geometryRevision: 3, perimeter: theirs, name: 'Old Building' })]);
    await settle(fixture);
    const banner = el.querySelector('[data-banner="conflict"]')!;
    expect(banner.textContent).toContain('Nothing was saved');
    expect(banner.textContent).toContain('now revision 3');
    expect(banner.textContent).toContain('from revision 2');
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);

    page.keepMine();
    await fixture.whenStable();
    expect(el.querySelector('[data-banner="conflict"]')).toBeNull();
    expect(page.form().name).toBe('Old Building Annex'); // unsaved edits survive
    const saving2 = page.save();
    const second = http.expectOne((r) => r.method === 'PATCH');
    expect(second.request.body.geometryRevision).toBe(3);
    expect(second.request.body.perimeter).toEqual([...PERIMETER, [14.601235, 121.0004]]);
    second.flush({ building: building({ geometryRevision: 4, name: 'Old Building Annex', perimeter: second.request.body.perimeter }) });
    await saving2;
    await settle(fixture);
    history();
    expect(page.base()?.geometryRevision).toBe(4);
    expect(page.dirty()).toBe(false);
    http.verify();
  });

  it('"Load latest location" drops my geometry edits but keeps the other fields', async () => {
    const { http, fixture, page, list } = await setup();
    page.patch({ toleranceMeters: 99, sortOrder: 7 });
    const saving = page.save();
    http.expectOne((r) => r.method === 'PATCH').flush({ error: { code: 'GEOMETRY_CONFLICT', message: 'x' } }, { status: 409, statusText: 'Conflict' });
    await saving;
    await settle(fixture);
    list([building({ geometryRevision: 5, toleranceMeters: 10 })]);
    await settle(fixture);
    page.useLatest();
    expect(page.form().toleranceMeters).toBe(10);
    expect(page.form().sortOrder).toBe(7);
    expect(page.changes()).toEqual({ sortOrder: 7 });
  });

  it('does not send an invalid perimeter', async () => {
    const { http, page, fixture, el } = await setup();
    page.removeVertex(0);
    await fixture.whenStable();
    expect(el.querySelector('[data-error="perimeter"]')?.textContent).toContain('3 to 200');
    await page.save();
    http.expectNone((r) => r.method === 'PATCH');
    page.clearPerimeter(); // no perimeter at all is allowed
    expect(page.valid()).toBe(true);
  });
});
