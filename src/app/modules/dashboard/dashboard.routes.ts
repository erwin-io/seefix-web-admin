import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  { path: '', data: { crumb: 'Dashboard' }, loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage) },
];
