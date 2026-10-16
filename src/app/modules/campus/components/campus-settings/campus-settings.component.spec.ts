import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UiService } from '@app/shared/services/ui.service';
import { LEAFLET } from '../../campus.service';
import { FakeLeaflet } from '../../testing/fake-leaflet';
import { CAMPUS_DEFAULT, CampusSettingsComponent, campusErrors } from './campus-settings.component';

const settle = async (fixture: { whenStable(): Promise<unknown> }) => {
  await new Promise((r) => setTimeout(r));
  await fixture.whenStable();
};

describe('campusErrors', () => {
  it('mirrors the API limits', () => {
    expect(campusErrors(CAMPUS_DEFAULT)).toEqual({});
    expect(Object.keys(campusErrors({ ...CAMPUS_DEFAULT, centerLng: 483.9 }))).toEqual(['centerLat']);
    expect(Object.keys(campusErrors({ ...CAMPUS_DEFAULT, radiusMeters: 50, minZoom: 22 }))).toEqual(['radiusMeters', 'minZoom']);
    expect(Object.keys(campusErrors({ centerLat: null, centerLng: null, radiusMeters: 600.5, minZoom: null }))).toEqual(['centerLat', 'radiusMeters', 'minZoom']);
  });
});

describe('CampusSettingsComponent', () => {
  async function setup() {
    const fake = new FakeLeaflet();
    TestBed.configureTestingModule({
      imports: [CampusSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LEAFLET, useValue: async () => fake.module() }],
    });
    const confirm = vi.spyOn(TestBed.inject(UiService), 'confirm').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CampusSettingsComponent);
    await fixture.whenStable();
    http.expectOne('/api/admin/campus-settings').flush({ campus: { ...CAMPUS_DEFAULT, isDefault: true }, updatedAt: null, updatedBy: null });
    await settle(fixture);
    await settle(fixture);
    return { fake, http, fixture, confirm, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('previews the area as a ring, moves the centre by drag or click, and saves exactly the form', async () => {
    const { fake, http, fixture, cmp, el } = await setup();
    expect(el.textContent).toContain('Using the default area');
    expect(fake.campusCircles.at(-1)!.opts).toMatchObject({ radius: 600 });
    expect(fake.map!.minZoom).toBeUndefined(); // the preview is not bounded, so the admin can look around

    fake.handles.at(-1)!.dragTo([10.3271, 123.9551]);
    await settle(fixture);
    expect([cmp.form().centerLat, cmp.form().centerLng]).toEqual([10.3271, 123.9551]);
    cmp.patch({ radiusMeters: 800 });
    await settle(fixture);
    expect(fake.campusCircles.at(-1)!.opts).toMatchObject({ radius: 800 });
    fake.map!.fire('click', { latlng: { lat: 10.32601234567, lng: 483.95499 } }); // a click on a world copy
    await settle(fixture);
    expect([cmp.form().centerLat, cmp.form().centerLng]).toEqual([10.326012, 123.95499]);

    const saving = cmp.save();
    await settle(fixture); // confirmed first
    const req = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/admin/campus-settings');
    expect(req.request.body).toEqual({ centerLat: 10.326012, centerLng: 123.95499, radiusMeters: 800, minZoom: 16 });
    req.flush({ campus: { ...req.request.body, isDefault: false } });
    await saving;
    expect(cmp.dirty()).toBe(false);
  });

  it('does not save an invalid area and shows the API message on refusal', async () => {
    const { http, fixture, cmp, el } = await setup();
    cmp.patch({ radiusMeters: 20 });
    await settle(fixture);
    expect(cmp.valid()).toBe(false);
    await cmp.save();
    http.expectNone((r) => r.method === 'PUT');
    cmp.patch({ radiusMeters: 700 });
    const saving = cmp.save();
    await settle(fixture);
    http.expectOne((r) => r.method === 'PUT').flush({ error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403, statusText: 'Forbidden' });
    await saving;
    await settle(fixture);
    expect(el.textContent).toContain('Admins only.');
  });

  it('asks before saving and before resetting to the default; Cancel writes nothing', async () => {
    const { http, fixture, cmp, confirm } = await setup();
    cmp.patch({ radiusMeters: 900 });
    confirm.mockResolvedValue(false);
    await cmp.save();
    await settle(fixture);
    http.expectNone((r) => r.method === 'PUT');
    expect(confirm.mock.calls[0][0]).toMatchObject({ title: 'Save the campus map area?', confirm: 'Save campus area' });
    expect(confirm.mock.calls[0][0].message).toContain('900 m');
    await cmp.useDefault();
    expect(cmp.form().radiusMeters).toBe(900); // reset cancelled: the edit stays
    expect(confirm.mock.calls[1][0]).toMatchObject({ title: 'Use the default campus area?', confirm: 'Use default' });
    confirm.mockResolvedValue(true);
    await cmp.useDefault();
    expect(cmp.form()).toEqual(CAMPUS_DEFAULT);
    http.expectNone((r) => r.method === 'PUT'); // "Use default" only fills the form
  });
});
