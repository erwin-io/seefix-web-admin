import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SessionService } from '@app/core/auth/session.service';
import { Dataset, DatasetDef, DatasetStore } from '@app/core/data/dataset.store';
import { ApiService } from '@app/core/http/api.service';
import { Items } from '@app/core/models/api.model';
import { Building, BuildingChanges, CampusArea, GeometryRevision, LocationChange, MapBuilding, MapMarker, MapResponse, ReportLocation } from './campus.models';

/** Admin building list (not paged: the loader stops after the single `{ items }` response). */
export const BUILDINGS: DatasetDef<Building> = { key: 'admin-buildings', path: '/api/admin/buildings', idOf: (b) => b.id, domains: ['reference'] };

export const MAP_MARKERS: DatasetDef<MapMarker> = {
  key: 'campus-map',
  path: '/api/map',
  idOf: (m) => `${m.kind}:${m.id}`,
  domains: ['reports', 'work_orders', 'reference'],
};

/** Leaflet, loaded only when a map is shown (keeps it out of the initial bundle). Tests provide a fake. */
export const LEAFLET = new InjectionToken<() => Promise<typeof import('leaflet')>>('LEAFLET', {
  providedIn: 'root',
  factory: () => () => import('leaflet').then(leafletApi),
});

type LeafletApi = typeof import('leaflet');
/** Leaflet is CommonJS: production builds expose it only as the default export; the dev server also adds named ones. */
export function leafletApi(module: LeafletApi | { default: LeafletApi }): LeafletApi {
  return 'default' in module && typeof module.default?.map === 'function' ? module.default : (module as LeafletApi);
}

@Injectable({ providedIn: 'root' })
export class CampusService {
  private readonly api = inject(ApiService);
  private readonly store = inject(DatasetStore);
  /** Buildings from the same `/api/map` response as the markers. */
  readonly mapBuildings = signal<MapBuilding[]>([]);
  /** Campus map area from the same response (null until loaded, or from an API without it). */
  readonly campus = signal<CampusArea | null>(null);

  constructor() {
    inject(SessionService).onReset(() => {
      this.mapBuildings.set([]);
      this.campus.set(null);
    });
  }

  /** `/api/map` as a dataset of markers (refreshed by CacheSyncService); its buildings land in `mapBuildings`. */
  map(): Dataset<MapMarker> {
    return this.store.get(MAP_MARKERS, async (_page, signal) => {
      const res = await this.store.request<MapResponse>(MAP_MARKERS.path, {}, signal);
      this.mapBuildings.set(res.body.buildings);
      this.campus.set(res.body.campus ?? null);
      const markers = res.body.markers;
      return { body: { items: markers, page: 1, pageSize: markers.length, hasMore: false }, versions: res.versions };
    });
  }

  create(body: BuildingChanges) {
    return this.api.post<{ building: Building }>('/api/admin/buildings', body);
  }

  update(id: string, body: BuildingChanges) {
    return this.api.patch<{ building: Building }>(`/api/admin/buildings/${id}`, body);
  }

  history(id: string) {
    return this.api.get<Items<GeometryRevision>>(`/api/admin/buildings/${id}/geometry-history`);
  }

  campusSettings() {
    return this.api.get<{ campus: CampusArea; updatedAt: string | null; updatedBy: string | null }>('/api/admin/campus-settings');
  }

  saveCampusSettings(body: Omit<CampusArea, 'isDefault'>) {
    return this.api.put<{ campus: CampusArea }>('/api/admin/campus-settings', body);
  }

  reportLocation(id: string) {
    return this.api.get<ReportLocation>(`/api/map/reports/${id}`);
  }

  setReportLocation(id: string, body: LocationChange) {
    return this.api.put<ReportLocation>(`/api/map/reports/${id}/location`, body);
  }

  clearReportLocation(id: string) {
    return this.api.delete<ReportLocation>(`/api/map/reports/${id}/location`);
  }
}
