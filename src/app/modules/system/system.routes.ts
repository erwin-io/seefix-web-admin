import { Routes } from '@angular/router';

/** In-shell fallbacks. `**` must stay last in the app route table. */
export const SYSTEM_ROUTES: Routes = [
  {
    path: 'denied',
    data: { crumb: 'Access denied' },
    loadComponent: () => import('./pages/access-denied/access-denied.page').then((m) => m.AccessDeniedPage),
  },
  { path: '**', data: { crumb: 'Not found' }, loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage) },
];
