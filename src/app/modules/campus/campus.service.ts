import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SessionService } from '@app/core/auth/session.service';
import { Dataset, DatasetDef, DatasetStore } from '@app/core/data/dataset.store';
import { ApiService } from '@app/core/http/api.service';
import { Items } from '@app/core/models/api.model';
import { Building, BuildingChanges, GeometryRevision, MapBuilding, MapMarker, MapResponse } from './campus.models';

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
  factory: () => () => import('leaflet'),
});

@Injectable({ providedIn: 'root' })
export class CampusService {
  private readonly api = inject(ApiService);
  private readonly store = inject(DatasetStore);
  /** Buildings from the same `/api/map` response as the markers. */
  readonly mapBuildings = signal<MapBuilding[]>([]);

  constructor() {
    inject(SessionService).onReset(() => this.mapBuildings.set([]));
  }

  /** `/api/map` as a dataset of markers (refreshed by CacheSyncService); its buildings land in `mapBuildings`. */
  map(): Dataset<MapMarker> {
    return this.store.get(MAP_MARKERS, async (_page, signal) => {
      const res = await this.store.request<MapResponse>(MAP_MARKERS.path, {}, signal);
      this.mapBuildings.set(res.body.buildings);
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
}
