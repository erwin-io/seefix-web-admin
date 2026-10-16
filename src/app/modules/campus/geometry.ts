import { LatLng, MapMarker, MarkerLocation } from './campus.models';

/** Same limits as seefix-api `validatePerimeter` / the building PATCH. */
export const MIN_VERTICES = 3;
export const MAX_VERTICES = 200;
export const MAX_TOLERANCE_M = 1000;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Client copy of the API's perimeter rules so the form can explain a problem before saving (the API still
 * validates): 3–200 [lat, lng] numbers in range, at least 3 distinct points. A repeated closing point is fine.
 * Returns null when valid.
 */
export function perimeterError(points: unknown): string | null {
  if (!Array.isArray(points) || points.length < MIN_VERTICES || points.length > MAX_VERTICES) {
    return `A perimeter needs ${MIN_VERTICES} to ${MAX_VERTICES} points.`;
  }
  for (const [i, p] of points.entries()) {
    if (!Array.isArray(p) || p.length !== 2 || !finite(p[0]) || !finite(p[1])) return `Point ${i + 1} needs a latitude and a longitude.`;
    if (Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180) return `Point ${i + 1} is out of range (latitude ±90, longitude ±180).`;
  }
  const pts = points as LatLng[];
  const [first, last] = [pts[0], pts[pts.length - 1]];
  const open = first[0] === last[0] && first[1] === last[1] ? pts.slice(0, -1) : pts;
  if (new Set(open.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`)).size < MIN_VERTICES) {
    return `A perimeter needs at least ${MIN_VERTICES} different points.`;
  }
  return null;
}

/** Default pin: both or neither, valid lat/lng. */
export function pinError(lat: number | null, lng: number | null): string | null {
  if (lat === null && lng === null) return null;
  if (lat === null || lng === null) return 'Enter both latitude and longitude for the default pin, or neither.';
  if (!finite(lat) || !finite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return 'The default pin must be a valid latitude/longitude.';
  return null;
}

export function toleranceError(t: number | null): string | null {
  return t !== null && Number.isInteger(t) && t >= 0 && t <= MAX_TOLERANCE_M ? null : `Tolerance must be a whole number from 0 to ${MAX_TOLERANCE_M} m.`;
}

/**
 * Reads pasted coordinates: JSON `[[lat, lng], …]`, or one `lat, lng` pair per line. Null when unreadable.
 * Rounds to 6 decimals (~0.1 m) like the API.
 */
export function parsePoints(text: string): LatLng[] | null {
  const t = text.trim();
  if (!t) return [];
  let raw: unknown;
  if (t.startsWith('[')) {
    try {
      raw = JSON.parse(t);
    } catch {
      return null;
    }
  } else {
    raw = t.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/[,\s]+/).filter(Boolean).map(Number));
  }
  if (!Array.isArray(raw)) return null;
  const out: LatLng[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2 || !finite(p[0]) || !finite(p[1])) return null;
    out.push([round6(p[0]), round6(p[1])]);
  }
  return out;
}

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const SOURCE_LABEL: Record<MarkerLocation['source'], string> = {
  GPS: 'Submitted GPS',
  BUILDING_DEFAULT: 'Building default pin',
  NONE: 'Not pinned',
};

/** Why the pin is where it is, in words (from the API's `gpsCheck`; nothing is recomputed here). */
export function provenance(loc: MarkerLocation): string {
  const d = loc.gpsDistanceMeters;
  switch (loc.gpsCheck) {
    case 'INSIDE':
      return 'GPS is inside the building perimeter';
    case 'WITHIN_TOLERANCE':
      return 'GPS is just outside the perimeter, within its tolerance';
    case 'NO_PERIMETER':
      return 'GPS shown as submitted: the building has no perimeter';
    case 'NO_BUILDING':
      return 'GPS shown as submitted: no linked building';
    case 'OUTSIDE':
      return loc.source === 'BUILDING_DEFAULT'
        ? `GPS is ${d ?? '?'} m outside the building perimeter; shown at the building's default pin`
        : `GPS is ${d ?? '?'} m outside the building perimeter and the building has no default pin`;
    case 'NO_GPS':
      return loc.source === 'BUILDING_DEFAULT' ? "No GPS submitted; shown at the building's default pin" : 'No GPS submitted and no default pin';
  }
}

/** Raw coordinates exactly as stored, or a clear "none". */
export function rawGpsText(loc: MarkerLocation): string {
  return loc.rawGps ? `${loc.rawGps.lat}, ${loc.rawGps.lng}` : 'No GPS submitted';
}

export function pinned(m: MapMarker): boolean {
  return m.location.source !== 'NONE' && finite(m.location.lat) && finite(m.location.lng);
}

export interface MarkerFilter {
  kind: MapMarker['kind'] | null;
  status: string | null;
  category: string | null;
  urgency: string | null;
  buildingId: string | null;
}

export const NO_FILTER: MarkerFilter = { kind: null, status: null, category: null, urgency: null, buildingId: null };

/** Display filter over the returned markers (it never changes a report or its building). */
export function filterMarkers(markers: MapMarker[], f: MarkerFilter): MapMarker[] {
  return markers.filter(
    (m) =>
      (!f.kind || m.kind === f.kind) &&
      (!f.status || m.status === f.status) &&
      (!f.category || m.category === f.category) &&
      (!f.urgency || m.urgency === f.urgency) &&
      (!f.buildingId || m.buildingId === f.buildingId),
  );
}

/** Distinct non-empty values for a filter menu, sorted. */
export function options(markers: MapMarker[], pick: (m: MapMarker) => string | null): string[] {
  return [...new Set(markers.map(pick).filter((v): v is string => !!v))].sort();
}
