import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../core/api';
import { load } from '../../core/load';
import { Items, MaintenanceReportItem } from '../../core/models';
import { SHARED } from '../../shared/ui';
import { Triage } from './review-queue.page';

export const REPORT_STATUSES = [
  'SUBMITTED', 'PENDING_REVIEW', 'ROUTED_INTERNAL', 'PROCUREMENT', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS',
  'PENDING_PARTS', 'ON_HOLD', 'COMPLETION_SUBMITTED', 'REWORK_REQUIRED', 'RESOLVED', 'NEEDS_INFORMATION',
  'NO_ACTION', 'DUPLICATE', 'CANCELLED',
];

@Component({
  selector: 'app-reports-page',
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatSelectModule, MatTableModule, ...SHARED,
  ],
  template: `
    <div class="page-head">
      <div>
        <h1>Reports</h1>
        <p>All reports (latest 200), ordered by live priority.</p>
      </div>
      <div class="actions"><button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button></div>
    </div>
    <div class="toolbar-row">
      <mat-button-toggle-group [value]="triage()" (change)="triage.set($event.value)" hideSingleSelectionIndicator aria-label="Triage">
        <mat-button-toggle value="all">All</mat-button-toggle>
        <mat-button-toggle value="actionable">Actionable</mat-button-toggle>
        <mat-button-toggle value="screening">Screening</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Status</mat-label>
        <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
          <mat-option [value]="null">Any status</mat-option>
          @for (s of statuses; track s) {
            <mat-option [value]="s">{{ s | humanize }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Report no., category, building" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
    </div>
    <div class="table-wrap">
      <app-state [loading]="data.loading()" [error]="data.error()" [empty]="rows().length ? null : 'No reports match'" (retry)="data.reload()" />
      @if (!data.loading() && rows().length) {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let r"><app-priority [score]="r.priorityScore" /></td>
          </ng-container>
          <ng-container matColumnDef="report">
            <th mat-header-cell *matHeaderCellDef>Report</th>
            <td mat-cell *matCellDef="let r"><span class="ref">{{ r.reportNo }}</span><span class="sub">{{ r.screening.title }}</span></td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let r"><app-chip [value]="r.status" /><span class="sub">Agent: {{ r.agentStatus | humanize }}</span></td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Category / urgency</th>
            <td mat-cell *matCellDef="let r">{{ r.effectiveCategory ?? '—' }}<span class="sub">{{ r.effectiveUrgency ?? '' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef>Location</th>
            <td mat-cell *matCellDef="let r">{{ r.building ?? '—' }}<span class="sub">{{ r.floor }}{{ r.floor && r.roomOrArea ? ' · ' : '' }}{{ r.roomOrArea }}</span></td>
          </ng-container>
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef>Submitted</th>
            <td mat-cell *matCellDef="let r">{{ r.createdAt | date: 'MMM d, y' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let r; columns: cols" (click)="open(r)"></tr>
        </table>
      }
    </div>
  `,
})
export class ReportsPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly statuses = REPORT_STATUSES;
  readonly cols = ['priority', 'report', 'status', 'category', 'location', 'created'];
  readonly triage = signal<Triage>('all');
  readonly status = signal<string | null>(null);
  readonly search = signal('');
  readonly data = load(() =>
    this.api.get<Items<MaintenanceReportItem>>('/api/maintenance/reports', { triage: this.triage(), status: this.status() }),
  );
  // shortcut: client-side search over the API's 200-row page; add server search when volume grows.
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const items = this.data.value()?.items ?? [];
    return q
      ? items.filter((r) => [r.reportNo, r.effectiveCategory, r.building, r.roomOrArea].some((v) => v?.toLowerCase().includes(q)))
      : items;
  });

  open(r: MaintenanceReportItem): void {
    void this.router.navigate(['/reports', r.id]);
  }
}
