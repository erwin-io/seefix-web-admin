import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../core/api';
import { load } from '../../core/load';
import { Items, ReviewQueueItem } from '../../core/models';
import { SHARED } from '../../shared/ui';

export type Triage = 'all' | 'actionable' | 'screening';

@Component({
  selector: 'app-review-queue-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatTableModule, ...SHARED],
  template: `
    <div class="page-head">
      <div>
        <h1>Review Queue</h1>
        <p>Reports awaiting a human Maintenance Review decision. AI screening is advisory only.</p>
      </div>
      <div class="actions">
        <mat-button-toggle-group [value]="triage()" (change)="setTriage($event.value)" hideSingleSelectionIndicator aria-label="Triage">
          <mat-button-toggle value="all">All</mat-button-toggle>
          <mat-button-toggle value="actionable">Actionable</mat-button-toggle>
          <mat-button-toggle value="screening">Screening</mat-button-toggle>
        </mat-button-toggle-group>
        <button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button>
      </div>
    </div>
    <div class="table-wrap">
      <app-state [loading]="data.loading()" [error]="data.error()" [empty]="data.value()?.items?.length ? null : 'Nothing waiting for review'" (retry)="data.reload()" icon="fact_check" />
      @if (!data.loading() && data.value()?.items?.length) {
        <table mat-table [dataSource]="data.value()!.items">
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let r"><app-priority [score]="r.LivePriorityScore" /></td>
          </ng-container>
          <ng-container matColumnDef="report">
            <th mat-header-cell *matHeaderCellDef>Report</th>
            <td mat-cell *matCellDef="let r"><span class="ref">{{ r.ReportNo }}</span><span class="sub">{{ r.AiSummary }}</span></td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Category / urgency</th>
            <td mat-cell *matCellDef="let r">{{ r.EffectiveCategory ?? '—' }}<span class="sub"><app-chip [value]="r.EffectiveUrgency" /></span></td>
          </ng-container>
          <ng-container matColumnDef="screening">
            <th mat-header-cell *matHeaderCellDef>AI screening</th>
            <td mat-cell *matCellDef="let r">{{ r.screening.title }}</td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef>Location</th>
            <td mat-cell *matCellDef="let r">{{ r.Building ?? '—' }}<span class="sub">{{ r.Floor }}{{ r.Floor && r.RoomOrArea ? ' · ' : '' }}{{ r.RoomOrArea }}</span></td>
          </ng-container>
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef>Submitted</th>
            <td mat-cell *matCellDef="let r">{{ r.CreatedAt | date: 'MMM d, h:mm a' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let r; columns: cols" (click)="open(r)"></tr>
        </table>
      }
    </div>
  `,
})
export class ReviewQueuePage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly cols = ['priority', 'report', 'category', 'screening', 'location', 'created'];
  readonly triage = signal<Triage>('all');
  readonly data = load(() => this.api.get<Items<ReviewQueueItem>>('/api/maintenance/review-queue', { triage: this.triage() }));

  setTriage(t: Triage): void {
    this.triage.set(t);
  }

  open(r: ReviewQueueItem): void {
    void this.router.navigate(['/reports', r.ReportId]);
  }
}
