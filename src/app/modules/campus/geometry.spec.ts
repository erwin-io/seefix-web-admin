import { MapMarker, MarkerLocation } from './campus.models';
import { NO_FILTER, SOURCE_LABEL, filterMarkers, parsePoints, perimeterError, pinError, pinned, provenance, rawGpsText, toleranceError, wrapLng, campusBounds, outsideCampus, metresBetween } from './geometry';

describe('wrapLng', () => {
  it('maps clicks on repeated world copies back to −180…180', () => {
    expect(wrapLng(483.94968)).toBeCloseTo(123.94968, 6);
    expect(wrapLng(-236.05)).toBeCloseTo(123.95, 6);
    expect(wrapLng(123.9)).toBeCloseTo(123.9, 6);
    expect(wrapLng(-179.5)).toBeCloseTo(-179.5, 6);
  });
});

const square: [number, number][] = [
  [14.6, 121.0],
  [14.6, 121.001],
  [14.601, 121.001],
  [14.601, 121.0],
];

describe('perimeter validation (same rules as seefix-api validatePerimeter)', () => {
  it('accepts 3–200 valid points, with or without a repeated closing point', () => {
    expect(perimeterError(square)).toBeNull();
    expect(perimeterError([...square, square[0]])).toBeNull();
    expect(perimeterError(Array.from({ length: 200 }, (_, i) => [14 + i / 1000, 121 + (i % 7) / 1000]))).toBeNull();
  });

  it('rejects too few, too many, non-numeric, out-of-range and degenerate perimeters', () => {
    expect(perimeterError(square.slice(0, 2))).toMatch(/3 to 200/);
    expect(perimeterError(Array.from({ length: 201 }, (_, i) => [14, 121 + i / 1000]))).toMatch(/3 to 200/);
    expect(perimeterError([[14.6, 121], [14.6, NaN], [14.7, 121]])).toMatch(/Point 2/);
    expect(perimeterError([[14.6, 121], [91, 121], [14.7, 121.1]])).toMatch(/Point 2 is out of range/);
    expect(perimeterError([[14.6, 121], [14.6, 181], [14.7, 121.1]])).toMatch(/out of range/);
    // Three points, two distinct (the third closes the ring): not a polygon.
    expect(perimeterError([[14.6, 121], [14.7, 121], [14.6, 121]])).toMatch(/3 different points/);
    expect(perimeterError([[1, 2], [1, 2], [1, 2], [3, 4]])).toMatch(/3 different points/);
    expect(perimeterError(null)).toMatch(/3 to 200/);
  });

  it('checks the default pin and tolerance like the API', () => {
    expect(pinError(null, null)).toBeNull();
    expect(pinError(14.6, 121)).toBeNull();
    expect(pinError(14.6, null)).toMatch(/both/);
    expect(pinError(95, 121)).toMatch(/valid/);
    expect(toleranceError(0)).toBeNull();
    expect(toleranceError(1000)).toBeNull();
    expect(toleranceError(1001)).toMatch(/0 to 1000/);
    expect(toleranceError(2.5)).toMatch(/whole number/);
    expect(toleranceError(null)).toMatch(/whole number/);
  });

  it('reads pasted JSON or line pairs, rounding to 6 decimals', () => {
    expect(parsePoints('[[14.6, 121.0], [14.7, 121.1], [14.8, 121.2]]')).toEqual([[14.6, 121], [14.7, 121.1], [14.8, 121.2]]);
    expect(parsePoints('14.60000049, 121\n14.7 121.1\n\n14.8,121.2')).toEqual([[14.6, 121], [14.7, 121.1], [14.8, 121.2]]);
    expect(parsePoints('[[14.6]]')).toBeNull();
    expect(parsePoints('not coordinates')).toBeNull();
    expect(parsePoints('[oops')).toBeNull();
  });
});

describe('provenance labels (from the API gpsCheck; nothing recomputed)', () => {
  const loc = (l: Partial<MarkerLocation>): MarkerLocation => ({ source: 'GPS', lat: 14.6, lng: 121, rawGps: { lat: 14.6, lng: 121 }, gpsCheck: 'INSIDE', ...l });

  it('labels each source and explains why', () => {
    expect(SOURCE_LABEL).toEqual({ CORRECTED: 'Set by maintenance', GPS: 'Submitted GPS', BUILDING_DEFAULT: 'Building location', NONE: 'Not pinned' });
    expect(provenance(loc({}))).toBe('GPS is inside the building perimeter');
    expect(provenance(loc({ gpsCheck: 'WITHIN_TOLERANCE' }))).toMatch(/within its tolerance/);
    expect(provenance(loc({ gpsCheck: 'NO_PERIMETER' }))).toMatch(/no perimeter/);
    expect(provenance(loc({ gpsCheck: 'NO_BUILDING' }))).toMatch(/no linked building/);
    expect(provenance(loc({ source: 'BUILDING_DEFAULT', gpsCheck: 'OUTSIDE', gpsDistanceMeters: 1234.5 }))).toBe(
      "GPS is 1234.5 m outside the building perimeter; shown at the building's default pin",
    );
    expect(provenance(loc({ source: 'NONE', lat: null, lng: null, gpsCheck: 'OUTSIDE', gpsDistanceMeters: 80 }))).toMatch(/80 m outside .* the building has no location/);
    expect(provenance(loc({ source: 'BUILDING_DEFAULT', rawGps: null, gpsCheck: 'NO_GPS' }))).toMatch(/No GPS submitted; shown at the building's default pin/);
    expect(provenance(loc({ source: 'NONE', lat: null, lng: null, rawGps: null, gpsCheck: 'NO_GPS' }))).toBe('No GPS submitted and no building location to show it at');
  });

  it('shows raw GPS untouched even when the pin is the building default, and handles missing GPS', () => {
    const outside = loc({ source: 'BUILDING_DEFAULT', lat: 14.6, lng: 121, rawGps: { lat: 14.7123456, lng: 121.1 }, gpsCheck: 'OUTSIDE' });
    expect(rawGpsText(outside)).toBe('14.7123456, 121.1');
    expect(rawGpsText(loc({ rawGps: null, gpsCheck: 'NO_GPS' }))).toBe('No GPS submitted');
  });

  it('only pins markers with a usable display position', () => {
    const m = (location: MarkerLocation) => ({ location }) as MapMarker;
    expect(pinned(m(loc({})))).toBe(true);
    expect(pinned(m(loc({ source: 'NONE', lat: null, lng: null })))).toBe(false);
    expect(pinned(m(loc({ source: 'GPS', lat: null })))).toBe(false);
  });

  it('filters by kind, status, category, urgency and building', () => {
    const base = { location: loc({}), buildingMatch: 'LOCATION', route: '' } as const;
    const ms = [
      { ...base, kind: 'REPORT', id: '1', no: 'R1', status: 'PENDING_REVIEW', category: 'PLUMBING', urgency: 'High', buildingId: 'b1', buildingName: 'A' },
      { ...base, kind: 'WORK_ORDER', id: '2', no: 'W1', status: 'ASSIGNED', category: 'ELECTRICAL', urgency: 'Low', buildingId: 'b2', buildingName: 'B' },
    ] as MapMarker[];
    expect(filterMarkers(ms, NO_FILTER)).toHaveLength(2);
    expect(filterMarkers(ms, { ...NO_FILTER, kind: 'WORK_ORDER' }).map((m) => m.no)).toEqual(['W1']);
    expect(filterMarkers(ms, { ...NO_FILTER, category: 'PLUMBING', urgency: 'High' }).map((m) => m.no)).toEqual(['R1']);
    expect(filterMarkers(ms, { ...NO_FILTER, buildingId: 'b2', status: 'PENDING_REVIEW' })).toEqual([]);
  });
});

describe('campus area', () => {
  const campus = { centerLat: 10.326321, centerLng: 123.954995, radiusMeters: 600, minZoom: 16 };
  it('bounds the map to a square around the circle', () => {
    const [sw, ne] = campusBounds(campus);
    expect(metresBetween([sw[0], campus.centerLng], [ne[0], campus.centerLng])).toBeCloseTo(1200, -1);
    expect(metresBetween([campus.centerLat, sw[1]], [campus.centerLat, ne[1]])).toBeCloseTo(1200, -1);
  });
  it('says whether a point is outside the circle (same rule as the API)', () => {
    expect(outsideCampus(campus, [10.3262, 123.955])).toBe(false);
    expect(outsideCampus(campus, [10.4, 123.95])).toBe(true);
  });
  it('explains a maintenance-set location', () => {
    expect(provenance({ source: 'CORRECTED', lat: 1, lng: 2, rawGps: null, gpsCheck: 'NO_GPS', correction: { source: 'MANUAL', reason: 'From photo', updatedAt: null, updatedBy: 'Staff' } }))
      .toBe('Shown at a point picked by maintenance (Staff): From photo. Raw GPS is unchanged');
  });
});
