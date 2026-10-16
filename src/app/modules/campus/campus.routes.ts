import { Routes } from '@angular/router';

export const MAP_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/campus-map/campus-map.page').then((m) => m.CampusMapPage) },
];

/** Mounted under /admin (ADMIN only). */
export const BUILDING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/building-list/building-list.page').then((m) => m.BuildingListPage) },
  { path: 'new', data: { crumb: 'New building' }, loadComponent: () => import('./pages/building-edit/building-edit.page').then((m) => m.BuildingEditPage) },
  { path: ':id', data: { crumb: 'Building' }, loadComponent: () => import('./pages/building-edit/building-edit.page').then((m) => m.BuildingEditPage) },
];
