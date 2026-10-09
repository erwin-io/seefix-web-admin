import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { ActionItem, Items, MAINTENANCE, PROCUREMENT_READERS, ProcurementInboxItem, ReviewQueueItem, WORK_ROLES, WorkOrderItem } from '../core/models';
import { Session } from '../core/session';
import { SHARED, entityLink } from '../shared/ui';

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
  imports: [RouterLink, DatePipe, MatButtonModule, MatIconModule, ...SHARED],
  styles: `
    .attention a { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--sf-border);
      text-decoration: none; color: inherit; }
    .attention a:last-child { border-bottom: 0; }
    .attention .grow { flex: 1; min-width: 0; }
    .attention small { color: var(--sf-muted); display: block; }
  `,
  template: `
    <div class="page-head">
      <div>
        <h1>Welcome back, {{ firstName() }}</h1>
        <p>Here's what needs attention today.</p>
      </div>
      <div class="actions"><button mat-stroked-button (click)="refresh()"><mat-icon>refresh</mat-icon>Refresh</button></div>
    </div>

    <section class="metrics">
      @for (m of metrics(); track m.label) {
        <a class="metric" [routerLink]="m.link" [queryParams]="m.query">
          <mat-icon>{{ m.icon }}</mat-icon>
          <div>
            <strong>{{ m.value ?? '—' }}</strong>
            <span>{{ m.label }}</span>
          </div>
        </a>
      }
    </section>

    @if (actions().length) {
      <section class="card attention">
        <header>
          <h2>Needs attention</h2>
          <a mat-button routerLink="/maintenance/action-center">Open Action Center</a>
        </header>
        @for (a of actions(); track a.EntityId + a.ActionType) {
          <a [routerLink]="link(a)">
            <app-priority [score]="a.PriorityScore" />
            <div class="grow">
              <strong>{{ a.ReferenceNo ?? (a.EntityType | humanize) }}</strong> · {{ a.ActionType | humanize }}
              <small>{{ a.Summary }}</small>
            </div>
            <small>{{ a.ActionCreatedAt | date: 'MMM d, h:mm a' }}</small>
          </a>
        }
      </section>
    }

    @if (myWork().length) {
      <section class="card attention">
        <header>
          <h2>My active work orders</h2>
          <a mat-button routerLink="/work-orders">View all</a>
        </header>
        @for (w of myWork(); track w.id) {
          <a [routerLink]="['/work-orders', w.id]">
            <app-chip [value]="w.status" />
            <div class="grow">
              <strong>{{ w.workOrderNo }}</strong> · {{ w.reportNo }}
              <small>{{ w.assignedPartyName }}</small>
            </div>
            <small>{{ w.deadline ? 'Due ' + (w.deadline | date: 'MMM d') : '' }}</small>
          </a>
        }
      </section>
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
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
    const get = <T>(path: string) => firstValueFrom(this.api.get<Items<T>>(path)).then((r) => r.items, () => null);
    const count = <T>(list: T[] | null, pred: (x: T) => boolean = () => true) => (list ? list.filter(pred).length : null);

    const [actions, queue, workOrders, inbox, users] = await Promise.all([
      s.has(...MAINTENANCE) ? get<ActionItem>('/api/maintenance/action-center') : null,
      s.has(...MAINTENANCE) ? get<ReviewQueueItem>('/api/maintenance/review-queue') : null,
      s.has(...WORK_ROLES) ? get<WorkOrderItem>('/api/work-orders') : null,
      s.has(...PROCUREMENT_READERS) ? get<ProcurementInboxItem>('/api/procurement/inbox') : null,
      s.has('ADMIN') ? get<unknown>('/api/admin/users') : null,
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
