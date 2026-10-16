/** seefix-api docs/V2_SEARCH_ANALYTICS_MAP.md §3–§4. Coordinates are [lat, lng]. */
export type LatLng = [number, number];

/** `GET/POST/PATCH /api/admin/buildings` (ADMIN). */
export interface Building {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  defaultLat: number | null;
  defaultLng: number | null;
  /** 3–200 vertices, stored open (first point not repeated). */
  perimeter: LatLng[] | null;
  toleranceMeters: number;
  geometryRevision: number;
  geometryUpdatedAt: string | null;
  updatedAt: string | null;
}

/** Body of POST (code + name required) and PATCH (any subset). */
export interface BuildingChanges {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  defaultLat?: number | null;
  defaultLng?: number | null;
  perimeter?: LatLng[] | null;
  toleranceMeters?: number;
  /** Optimistic check for geometry edits: 409 GEOMETRY_CONFLICT when the server's revision differs. */
  geometryRevision?: number;
  reason?: string;
}

/** `GET /api/admin/buildings/:id/geometry-history`, newest first. */
export interface GeometryRevision {
  revision: number;
  defaultLat: number | null;
  defaultLng: number | null;
  perimeter: LatLng[] | null;
  toleranceMeters: number | null;
  reason: string | null;
  changedAt: string;
  changedBy: string | null;
}

/** `GET /api/map` building: active buildings with active report / work order counts. */
export interface MapBuilding {
  id: string;
  code: string;
  name: string;
  defaultLat: number | null;
  defaultLng: number | null;
  perimeter: LatLng[] | null;
  toleranceMeters: number;
  geometryRevision: number;
  counts: { reports: number; workOrders: number };
}

/** Where the pin is drawn: saved by maintenance, submitted GPS, the building's location, or not pinned (table only). */
export type LocationSource = 'CORRECTED' | 'GPS' | 'BUILDING_DEFAULT' | 'NONE';
export type GpsCheck = 'INSIDE' | 'WITHIN_TOLERANCE' | 'OUTSIDE' | 'NO_GPS' | 'NO_PERIMETER' | 'NO_BUILDING';

export interface MarkerLocation {
  source: LocationSource;
  lat: number | null;
  lng: number | null;
  /** The report's untouched coordinates (null: none submitted). */
  rawGps: { lat: number; lng: number } | null;
  gpsCheck: GpsCheck;
  gpsDistanceMeters?: number;
  /** BUILDING_DEFAULT: the building's pin, or the centre of its perimeter when it has no pin. */
  defaultFrom?: 'PIN' | 'PERIMETER_CENTER';
  /** CORRECTED: who saved the map location and why (raw GPS is unchanged). */
  correction?: { source: 'MANUAL' | 'BUILDING'; reason: string | null; updatedAt: string | null; updatedBy: string | null };
}

export interface MapMarker {
  kind: 'REPORT' | 'WORK_ORDER';
  id: string;
  no: string;
  status: string;
  category: string | null;
  urgency: string | null;
  buildingId: string | null;
  buildingName: string | null;
  /** How the building was linked, for display only (never written back to the report). */
  buildingMatch: 'LOCATION' | 'NAME' | 'NONE';
  location: MarkerLocation;
  route: string;
}

/** Campus map area (`campus` of GET /api/map, GET/PUT /api/admin/campus-settings): the map stays inside it. */
export interface CampusArea {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  /** Furthest the map can zoom out. */
  minZoom: number;
  /** true until an admin saves the settings. */
  isDefault?: boolean;
}

export interface MapResponse {
  buildings: MapBuilding[];
  markers: MapMarker[];
  campus?: CampusArea;
}

/** "Use building location": the linked building, or the one building whose name loosely matches (never AI). */
export interface LocationSuggestion {
  lat: number;
  lng: number;
  buildingId: string;
  buildingName: string;
  basis: 'LINKED_BUILDING' | 'SIMILAR_NAME';
}

/** GET /api/map/reports/:id (and the PUT/DELETE …/location answers): one report, no other markers. */
export interface ReportLocation {
  report: { id: string; no: string; status: string; buildingText: string | null; buildingMatch: MapMarker['buildingMatch'] };
  building: MapBuilding | null;
  location: MarkerLocation;
  suggestion: LocationSuggestion | null;
  campus: CampusArea;
  canCorrect: boolean;
}

export interface LocationChange {
  lat: number;
  lng: number;
  source: 'MANUAL' | 'BUILDING';
  buildingId?: string;
  reason?: string;
}
