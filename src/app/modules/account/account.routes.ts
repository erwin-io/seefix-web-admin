import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    data: { crumb: 'Account' },
    loadComponent: () => import('./pages/account-settings/account-settings.page').then((m) => m.AccountSettingsPage),
  },
];
