import { Routes } from '@angular/router';

export const MAINTENANCE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'action-center' },
  {
    path: 'action-center',
    data: { crumb: 'Action Center' },
    loadComponent: () => import('./pages/action-center/action-center.page').then((m) => m.ActionCenterPage),
  },
  {
    path: 'review-queue',
    data: { crumb: 'Review Queue' },
    loadComponent: () => import('./pages/review-queue/review-queue.page').then((m) => m.ReviewQueuePage),
  },
  { path: 'reports', data: { crumb: 'Reports' }, loadComponent: () => import('./pages/report-list/report-list.page').then((m) => m.ReportListPage) },
  {
    path: 'reviews/:id',
    data: { crumb: 'Maintenance Review' },
    loadComponent: () => import('./pages/review-detail/review-detail.page').then((m) => m.ReviewDetailPage),
  },
];

/** Mounted at /reports so linked Procurement/Worker users can open a report (API scopes access). */
export const REPORT_ROUTES: Routes = [
  { path: ':id', data: { crumb: 'Report' }, loadComponent: () => import('./pages/report-detail/report-detail.page').then((m) => m.ReportDetailPage) },
];
