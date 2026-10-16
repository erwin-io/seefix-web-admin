import { leafletApi } from './campus.service';

describe('leafletApi', () => {
  const api = { map: () => ({}), canvas: () => ({}) } as unknown as typeof import('leaflet');

  it('unwraps the default export (production build of CommonJS Leaflet)', () => {
    expect(leafletApi({ default: api })).toBe(api);
  });

  it('keeps a module that already has named exports (dev server)', () => {
    const named = { ...api, default: api } as unknown as typeof import('leaflet');
    expect(leafletApi(named).canvas).toBe(api.canvas);
    expect(leafletApi(api)).toBe(api);
  });
});
