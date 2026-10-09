import { Routes } from '@angular/router';

export const PROCUREMENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },
  {
    path: 'inbox',
    data: { crumb: 'Inbox' },
    loadComponent: () => import('./pages/procurement-inbox/procurement-inbox.page').then((m) => m.ProcurementInboxPage),
  },
  {
    path: 'handoffs/:id',
    data: { crumb: 'Handoff' },
    loadComponent: () => import('./pages/handoff-detail/handoff-detail.page').then((m) => m.HandoffDetailPage),
  },
];
