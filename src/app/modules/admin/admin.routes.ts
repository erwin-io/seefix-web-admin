import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  { path: 'users', data: { crumb: 'Users' }, loadComponent: () => import('./pages/user-list/user-list.page').then((m) => m.UserListPage) },
  { path: 'buildings', data: { crumb: 'Buildings' }, loadChildren: () => import('../campus/campus.routes').then((m) => m.BUILDING_ROUTES) },
  { path: 'knowledge', data: { crumb: 'AI Knowledge' }, loadComponent: () => import('./pages/knowledge/knowledge.page').then((m) => m.KnowledgePage) },
];
