import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SessionService } from '@app/core/auth/session.service';
import { Items } from '@app/core/models/api.model';
import { MAINTENANCE, PROCUREMENT_READERS, WORK_ROLES } from '@app/core/models/user.model';
import { AdminService } from '@app/modules/admin/admin.service';
import { ActionItem } from '@app/modules/maintenance/maintenance.models';
import { MaintenanceService } from '@app/modules/maintenance/maintenance.service';
import { ProcurementService } from '@app/modules/procurement/procurement.service';
import { WorkOrderItem } from '@app/modules/work-orders/work-orders.models';
import { WorkOrdersService } from '@app/modules/work-orders/work-orders.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { entityLink } from '@app/shared/utils/entity-link';
import { Observable, firstValueFrom } from 'rxjs';

interface Metric {
  label: string;
  icon: string;
  link: string;
  query?: Record<string, string>;
  value: number | null;
}

/** Every number is counted from an existing list endpoint; no stats API, no invented KPIs. */
@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DatePipe, MatButtonModule, MatIconModule, ...SHARED_IMPORTS],
  styleUrl: './dashboard.page.scss',
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly session = inject(SessionService);
  private readonly maintenance = inject(MaintenanceService);
  private readonly workOrders = inject(WorkOrdersService);
  private readonly procurement = inject(ProcurementService);
  private readonly admin = inject(AdminService);
  readonly metrics = signal<Metric[]>([]);
  readonly actions = signal<ActionItem[]>([]);
  readonly myWork = signal<WorkOrderItem[]>([]);
  readonly firstName = () => this.session.user()?.fullName.split(/\s+/)[0] ?? '';

  constructor() {
    void this.refresh();
  }

  link(a: ActionItem): string | null {
    return entityLink(a.EntityType, a.EntityId);
  }

  async refresh(): Promise<void> {
    const s = this.session;
    // A failing card shows a dash; the others still load.
    const get = <T>(req: Observable<Items<T>>) => firstValueFrom(req).then((r) => r.items, () => null);
    const count = <T>(list: T[] | null, pred: (x: T) => boolean = () => true) => (list ? list.filter(pred).length : null);

    const [actions, queue, workOrders, inbox, users] = await Promise.all([
      s.has(...MAINTENANCE) ? get(this.maintenance.actionCenter()) : null,
      s.has(...MAINTENANCE) ? get(this.maintenance.reviewQueue('all')) : null,
      s.has(...WORK_ROLES) ? get(this.workOrders.list(null)) : null,
      s.has(...PROCUREMENT_READERS) ? get(this.procurement.inbox()) : null,
      s.has('ADMIN') ? get(this.admin.users()) : null,
    ]);

    const m: Metric[] = [];
    if (s.has(...MAINTENANCE)) {
      m.push({ label: 'Open action items', icon: 'bolt', link: '/maintenance/action-center', value: count(actions) });
      m.push({ label: 'Awaiting human review', icon: 'fact_check', link: '/maintenance/review-queue', value: count(queue) });
      m.push({ label: 'Work orders to dispatch', icon: 'assignment_ind', link: '/work-orders', query: { status: 'PENDING_ASSIGNMENT' }, value: count(workOrders, (w) => w.status === 'PENDING_ASSIGNMENT') });
      m.push({ label: 'Completions to review', icon: 'task_alt', link: '/work-orders', query: { status: 'COMPLETION_SUBMITTED' }, value: count(workOrders, (w) => w.status === 'COMPLETION_SUBMITTED') });
    }
    if (s.has('WORKER')) {
      m.push({ label: 'Assigned to me', icon: 'assignment', link: '/work-orders', query: { status: 'ASSIGNED' }, value: count(workOrders, (w) => w.status === 'ASSIGNED') });
      m.push({ label: 'In progress', icon: 'construction', link: '/work-orders', query: { status: 'IN_PROGRESS' }, value: count(workOrders, (w) => w.status === 'IN_PROGRESS') });
      m.push({ label: 'Rework required', icon: 'replay', link: '/work-orders', query: { status: 'REWORK_REQUIRED' }, value: count(workOrders, (w) => w.status === 'REWORK_REQUIRED') });
    }
    if (s.has(...PROCUREMENT_READERS)) {
      m.push({ label: 'Open procurement handoffs', icon: 'local_shipping', link: '/procurement/inbox', value: count(inbox, (h) => !['COMPLETED', 'CANCELLED'].includes(h.Status)) });
      m.push({ label: 'Clarifications pending', icon: 'help', link: '/procurement/inbox', value: count(inbox, (h) => h.Status === 'CLARIFICATION_REQUIRED') });
    }
    if (s.has('ADMIN')) m.push({ label: 'User accounts', icon: 'group', link: '/admin/users', value: count(users) });

    this.metrics.set(m);
    this.actions.set((actions ?? []).slice(0, 6));
    this.myWork.set(
      s.has('WORKER') ? (workOrders ?? []).filter((w) => ['ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'ON_HOLD', 'REWORK_REQUIRED'].includes(w.status)).slice(0, 6) : [],
    );
  }
}
