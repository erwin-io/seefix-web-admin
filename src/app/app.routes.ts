import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { MAINTENANCE, PROCUREMENT_READERS, WORK_ROLES } from './core/models';
import { ShellComponent } from './layout/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth.pages').then((m) => m.LoginPage) },
  { path: 'forgot-password', loadComponent: () => import('./features/auth.pages').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./features/auth.pages').then((m) => m.ResetPasswordPage) },
  { path: 'unavailable', loadComponent: () => import('./features/system.pages').then((m) => m.UnavailablePage) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', data: { crumb: 'Dashboard' }, loadComponent: () => import('./features/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'notifications', data: { crumb: 'Notifications' }, loadComponent: () => import('./features/notifications.page').then((m) => m.NotificationsPage) },
      { path: 'account', data: { crumb: 'Account' }, loadComponent: () => import('./features/account.page').then((m) => m.AccountPage) },
      {
        path: 'maintenance',
        data: { roles: MAINTENANCE, crumb: 'Maintenance' },
        children: [
          { path: 'action-center', data: { crumb: 'Action Center' }, loadComponent: () => import('./features/maintenance/action-center.page').then((m) => m.ActionCenterPage) },
          { path: 'review-queue', data: { crumb: 'Review Queue' }, loadComponent: () => import('./features/maintenance/review-queue.page').then((m) => m.ReviewQueuePage) },
          { path: 'reports', data: { crumb: 'Reports' }, loadComponent: () => import('./features/maintenance/reports.page').then((m) => m.ReportsPage) },
          { path: 'reviews/:id', data: { crumb: 'Maintenance Review' }, loadComponent: () => import('./features/maintenance/review-detail.page').then((m) => m.ReviewDetailPage) },
        ],
      },
      // Report detail is role-scoped by the API (Procurement/Worker only for linked work).
      { path: 'reports/:id', data: { crumb: 'Report' }, loadComponent: () => import('./features/maintenance/report-detail.page').then((m) => m.ReportDetailPage) },
      {
        path: 'work-orders',
        data: { roles: WORK_ROLES, crumb: 'Work Orders' },
        children: [
          { path: '', loadComponent: () => import('./features/work-orders/list.page').then((m) => m.WorkOrdersPage) },
          { path: ':id', data: { crumb: 'Work Order' }, loadComponent: () => import('./features/work-orders/detail.page').then((m) => m.WorkOrderDetailPage) },
        ],
      },
      {
        path: 'procurement',
        data: { roles: PROCUREMENT_READERS, crumb: 'Procurement' },
        children: [
          { path: 'inbox', data: { crumb: 'Inbox' }, loadComponent: () => import('./features/procurement/inbox.page').then((m) => m.ProcurementInboxPage) },
          { path: 'handoffs/:id', data: { crumb: 'Handoff' }, loadComponent: () => import('./features/procurement/handoff.page').then((m) => m.HandoffPage) },
        ],
      },
      {
        path: 'admin',
        data: { roles: ['ADMIN'], crumb: 'Admin' },
        children: [
          { path: 'users', data: { crumb: 'Users' }, loadComponent: () => import('./features/admin/users.page').then((m) => m.UsersPage) },
          { path: 'knowledge', data: { crumb: 'AI Knowledge' }, loadComponent: () => import('./features/admin/knowledge.page').then((m) => m.KnowledgePage) },
        ],
      },
      { path: 'denied', data: { crumb: 'Access denied' }, loadComponent: () => import('./features/system.pages').then((m) => m.DeniedPage) },
      { path: '**', data: { crumb: 'Not found' }, loadComponent: () => import('./features/system.pages').then((m) => m.NotFoundPage) },
    ],
  },
];
