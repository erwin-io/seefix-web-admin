import { Routes } from '@angular/router';
import { guestGuard } from '@app/core/auth/auth.guards';

/** Public pages (no shell). */
export const AUTH_ROUTES: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage) },
  {
    path: 'unavailable',
    loadComponent: () => import('../system/pages/api-unavailable/api-unavailable.page').then((m) => m.ApiUnavailablePage),
  },
];
