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
import { Api } from '../../core/api';
import { load } from '../../core/load';
import { Items, WorkOrderItem } from '../../core/models';
import { Session } from '../../core/session';
import { SHARED } from '../../shared/ui';

export const WO_STATUSES = [
  'PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'ON_HOLD', 'COMPLETION_SUBMITTED',
  'REWORK_REQUIRED', 'COMPLETED', 'CANCELLED',
];

@Component({
  selector: 'app-work-orders-page',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule, ...SHARED],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ session.has('WORKER') ? 'My Work Orders' : 'Work Orders' }}</h1>
        <p>{{ session.has('WORKER') ? 'Work orders where you are the responsible lead.' : 'Latest 200 work orders.' }}</p>
      </div>
      <div class="actions"><button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button></div>
    </div>
    <div class="toolbar-row">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Status</mat-label>
        <mat-select [ngModel]="filter()" (ngModelChange)="filter.set($event)">
          <mat-option [value]="null">Any status</mat-option>
          @for (s of statuses; track s) {
            <mat-option [value]="s">{{ s | humanize }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
    <div class="table-wrap">
      <app-state [loading]="data.loading()" [error]="data.error()" [empty]="rows().length ? null : 'No work orders'" (retry)="data.reload()" icon="construction" />
      @if (!data.loading() && rows().length) {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="wo">
            <th mat-header-cell *matHeaderCellDef>Work order</th>
            <td mat-cell *matCellDef="let w"><span class="ref">{{ w.workOrderNo }}</span><span class="sub">{{ w.reportNo }} · {{ w.requestNo }}</span></td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let w"><app-chip [value]="w.status" /></td>
          </ng-container>
          <ng-container matColumnDef="party">
            <th mat-header-cell *matHeaderCellDef>Assigned to</th>
            <td mat-cell *matCellDef="let w">{{ w.assignedPartyName ?? 'Unassigned' }}<span class="sub">{{ w.responsibleLeadName }}</span></td>
          </ng-container>
          <ng-container matColumnDef="dates">
            <th mat-header-cell *matHeaderCellDef>Planned / deadline</th>
            <td mat-cell *matCellDef="let w">{{ (w.plannedStartAt | date: 'MMM d') ?? '—' }}<span class="sub">{{ w.deadline ? 'Due ' + (w.deadline | date: 'MMM d') : '' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="completion">
            <th mat-header-cell *matHeaderCellDef>Completion check</th>
            <td mat-cell *matCellDef="let w">{{ w.completionAgentStatus | humanize }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let w; columns: cols" (click)="open(w)"></tr>
        </table>
      }
    </div>
  `,
})
export class WorkOrdersPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly session = inject(Session);
  readonly statuses = WO_STATUSES;
  readonly cols = ['wo', 'status', 'party', 'dates', 'completion'];
  /** Query param from dashboard cards (e.g. ?status=PENDING_ASSIGNMENT). */
  readonly status = input<string | null>(null);
  readonly filter = linkedSignal(() => this.status() ?? null);
  // API already scopes WORKER to their own work orders; status filter is server-side.
  readonly data = load(() => this.api.get<Items<WorkOrderItem>>('/api/work-orders', { status: this.filter() }));
  readonly rows = computed(() => this.data.value()?.items ?? []);

  open(w: WorkOrderItem): void {
    void this.router.navigate(['/work-orders', w.id]);
  }
}
