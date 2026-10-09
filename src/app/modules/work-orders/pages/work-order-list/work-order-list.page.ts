import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { SessionService } from '@app/core/auth/session.service';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { WORK_ORDER_STATUSES, WorkOrderItem } from '../../work-orders.models';
import { WorkOrdersService } from '../../work-orders.service';

@Component({
  selector: 'app-work-order-list-page',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './work-order-list.page.html',
  styleUrl: './work-order-list.page.scss',
})
export class WorkOrderListPage {
  private readonly workOrders = inject(WorkOrdersService);
  private readonly router = inject(Router);
  readonly session = inject(SessionService);
  readonly statuses = WORK_ORDER_STATUSES;
  readonly columns = ['wo', 'status', 'party', 'dates', 'completion'];
  /** Query param from dashboard cards (e.g. ?status=PENDING_ASSIGNMENT). */
  readonly status = input<string | null>(null);
  readonly filter = linkedSignal(() => this.status() ?? null);
  // API already scopes WORKER to their own work orders; status filter is server-side.
  readonly data = load(() => this.workOrders.list(this.filter()));
  readonly rows = computed(() => this.data.value()?.items ?? []);

  open(w: WorkOrderItem): void {
    void this.router.navigate(['/work-orders', w.id]);
  }
}
