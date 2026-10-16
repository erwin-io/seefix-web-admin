import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { SessionService } from '@app/core/auth/session.service';
import { useDataset } from '@app/core/data/dataset.store';
import { DataTableComponent } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { ANY_DAY, DateRangeFilterComponent, DayRange, inDayRange } from '@app/shared/components/date-range-filter/date-range-filter.component';
import { WORK_ORDER_STATUSES, WorkOrderItem } from '../../work-orders.models';
import { WORK_ORDERS } from '../../work-orders.service';

/**
 * Every work order the role may see (API scopes WORKER to their own). Default order is the server's newest first
 * (CreatedAt DESC, Id DESC). Status and created-date filters, search, sort and paging are local.
 */
@Component({
  selector: 'app-work-order-list-page',
  imports: [DataTableComponent, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatSortModule, MatTableModule, DateRangeFilterComponent, ...SHARED_IMPORTS],
  templateUrl: './work-order-list.page.html',
  styleUrl: './work-order-list.page.scss',
})
export class WorkOrderListPage {
  private readonly router = inject(Router);
  readonly session = inject(SessionService);
  readonly statuses = WORK_ORDER_STATUSES;
  readonly columns = ['wo', 'status', 'party', 'created', 'dates', 'completion'];
  /** Query param from dashboard cards (e.g. ?status=PENDING_ASSIGNMENT). */
  readonly status = input<string | null>(null);
  readonly filter = linkedSignal(() => this.status() ?? null);
  readonly data = useDataset(WORK_ORDERS);
  /** Created date (owner item 11): every work order has one; planned start is often empty. */
  readonly created = signal<DayRange>(ANY_DAY);
  readonly rows = computed(() => {
    const status = this.filter();
    const range = this.created();
    const rows = this.data.rows().filter((w) => inDayRange(w.createdAt, range));
    return status ? rows.filter((w) => w.status === status) : rows;
  });
  readonly sortBy = {
    wo: (w: WorkOrderItem) => w.workOrderNo,
    status: (w: WorkOrderItem) => w.status,
    party: (w: WorkOrderItem) => w.assignedPartyName,
    created: (w: WorkOrderItem) => w.createdAt ?? null,
    dates: (w: WorkOrderItem) => w.deadline,
    completion: (w: WorkOrderItem) => w.completionAgentStatus,
  };
  readonly searchText = (w: WorkOrderItem) =>
    [w.workOrderNo, w.reportNo, w.requestNo, w.assignedPartyName, w.responsibleLeadName, w.status].join(' ');

  open(w: WorkOrderItem): void {
    void this.router.navigate(['/work-orders', w.id]);
  }
}
