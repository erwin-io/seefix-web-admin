import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guards';
import { MAINTENANCE, PROCUREMENT_READERS, WORK_ROLES } from './core/models/user.model';
import { ShellComponent } from './layout/shell/shell.component';
import { AUTH_ROUTES } from './modules/auth/auth.routes';
import { SYSTEM_ROUTES } from './modules/system/system.routes';

/**
 * Business modules are lazy-loaded route groups (not role folders).
 * Roles gate each module via `data.roles` + roleGuard; the API remains authoritative.
 */
export const routes: Routes = [
  // Spread, not an empty-path loadChildren group: an empty componentless group would match `/` and render nothing.
  ...AUTH_ROUTES,
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadChildren: () => import('./modules/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES) },
      {
        path: 'maintenance',
        data: { roles: MAINTENANCE, crumb: 'Maintenance' },
        loadChildren: () => import('./modules/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
      },
      // Report detail is role-scoped by the API (Procurement/Worker only for linked work).
      { path: 'reports', loadChildren: () => import('./modules/maintenance/maintenance.routes').then((m) => m.REPORT_ROUTES) },
      {
        path: 'work-orders',
        data: { roles: WORK_ROLES, crumb: 'Work Orders' },
        loadChildren: () => import('./modules/work-orders/work-orders.routes').then((m) => m.WORK_ORDER_ROUTES),
      },
      {
        path: 'procurement',
        data: { roles: PROCUREMENT_READERS, crumb: 'Procurement' },
        loadChildren: () => import('./modules/procurement/procurement.routes').then((m) => m.PROCUREMENT_ROUTES),
      },
      {
        path: 'admin',
        data: { roles: ['ADMIN'], crumb: 'Admin' },
        loadChildren: () => import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      { path: 'notifications', loadChildren: () => import('./modules/notifications/notifications.routes').then((m) => m.NOTIFICATION_ROUTES) },
      { path: 'account', loadChildren: () => import('./modules/account/account.routes').then((m) => m.ACCOUNT_ROUTES) },
      ...SYSTEM_ROUTES,
    ],
  },
];
