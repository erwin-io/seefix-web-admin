import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../core/api';
import { load } from '../../core/load';
import { Items, ProcurementInboxItem } from '../../core/models';
import { SHARED } from '../../shared/ui';

@Component({
  selector: 'app-procurement-inbox-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatTableModule, ...SHARED],
  template: `
    <div class="page-head">
      <div>
        <h1>Procurement Inbox</h1>
        <p>Handoffs routed by Maintenance Review. Bidding, quotations and awards happen outside SEEFIX.</p>
      </div>
      <div class="actions">
        <mat-button-toggle-group [value]="view()" (change)="view.set($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="open">Open</mat-button-toggle>
          <mat-button-toggle value="all">All</mat-button-toggle>
        </mat-button-toggle-group>
        <button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button>
      </div>
    </div>
    <div class="table-wrap">
      <app-state [loading]="data.loading()" [error]="data.error()" [empty]="rows().length ? null : 'No handoffs'" (retry)="data.reload()" icon="local_shipping" />
      @if (!data.loading() && rows().length) {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let h"><app-priority [score]="h.LivePriorityScore" /></td>
          </ng-container>
          <ng-container matColumnDef="handoff">
            <th mat-header-cell *matHeaderCellDef>Handoff</th>
            <td mat-cell *matCellDef="let h"><span class="ref">{{ h.HandoffNo }}</span><span class="sub">{{ h.RequestNo }} · {{ h.ReportNo }}</span></td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let h"><app-chip [value]="h.Status" /></td>
          </ng-container>
          <ng-container matColumnDef="scope">
            <th mat-header-cell *matHeaderCellDef>Service / scope</th>
            <td mat-cell *matCellDef="let h">{{ h.RequiredService ?? h.EffectiveCategory ?? '—' }}<span class="sub">{{ h.ScopeOfWork }}</span></td>
          </ng-container>
          <ng-container matColumnDef="urgency">
            <th mat-header-cell *matHeaderCellDef>Urgency</th>
            <td mat-cell *matCellDef="let h"><app-chip [value]="h.EffectiveUrgency" /></td>
          </ng-container>
          <ng-container matColumnDef="dates">
            <th mat-header-cell *matHeaderCellDef>Submitted / follow-up</th>
            <td mat-cell *matCellDef="let h">{{ h.SubmittedAt | date: 'MMM d' }}<span class="sub">{{ h.NextFollowUpAt ? 'Follow up ' + (h.NextFollowUpAt | date: 'MMM d') : '' }}</span></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let h; columns: cols" (click)="open(h)"></tr>
        </table>
      }
    </div>
  `,
})
export class ProcurementInboxPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly cols = ['priority', 'handoff', 'status', 'scope', 'urgency', 'dates'];
  readonly view = signal<'open' | 'all'>('open');
  readonly data = load(() => this.api.get<Items<ProcurementInboxItem>>('/api/procurement/inbox'));
  readonly rows = computed(() => {
    const items = this.data.value()?.items ?? [];
    return this.view() === 'all' ? items : items.filter((h) => !['COMPLETED', 'CANCELLED'].includes(h.Status));
  });

  open(h: ProcurementInboxItem): void {
    void this.router.navigate(['/procurement/handoffs', h.HandoffId]);
  }
}
