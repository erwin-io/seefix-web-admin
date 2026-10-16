import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
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
import { WORK_ORDER_STATUSES, WorkOrderItem } from '../../work-orders.models';
import { WORK_ORDERS } from '../../work-orders.service';

/**
 * Every work order the role may see (API scopes WORKER to their own). Default order is the server's newest first
 * (CreatedAt DESC, Id DESC: the rows carry no createdAt). Status filter, search, sort and paging are local.
 */
@Component({
  selector: 'app-work-order-list-page',
  imports: [DataTableComponent, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatSortModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './work-order-list.page.html',
  styleUrl: './work-order-list.page.scss',
})
export class WorkOrderListPage {
  private readonly router = inject(Router);
  readonly session = inject(SessionService);
  readonly statuses = WORK_ORDER_STATUSES;
  readonly columns = ['wo', 'status', 'party', 'dates', 'completion'];
  /** Query param from dashboard cards (e.g. ?status=PENDING_ASSIGNMENT). */
  readonly status = input<string | null>(null);
  readonly filter = linkedSignal(() => this.status() ?? null);
  readonly data = useDataset(WORK_ORDERS);
  readonly rows = computed(() => {
    const status = this.filter();
    return status ? this.data.rows().filter((w) => w.status === status) : this.data.rows();
  });
  readonly sortBy = {
    wo: (w: WorkOrderItem) => w.workOrderNo,
    status: (w: WorkOrderItem) => w.status,
    party: (w: WorkOrderItem) => w.assignedPartyName,
    dates: (w: WorkOrderItem) => w.deadline,
    completion: (w: WorkOrderItem) => w.completionAgentStatus,
  };
  readonly searchText = (w: WorkOrderItem) =>
    [w.workOrderNo, w.reportNo, w.requestNo, w.assignedPartyName, w.responsibleLeadName, w.status].join(' ');

  open(w: WorkOrderItem): void {
    void this.router.navigate(['/work-orders', w.id]);
  }
}
