import { Routes } from '@angular/router';

export const WORK_ORDER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/work-order-list/work-order-list.page').then((m) => m.WorkOrderListPage) },
  {
    path: ':id',
    data: { crumb: 'Work Order' },
    loadComponent: () => import('./pages/work-order-detail/work-order-detail.page').then((m) => m.WorkOrderDetailPage),
  },
];
