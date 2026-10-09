import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Api } from '../../core/api';
import { load } from '../../core/load';
import { ActionItem, Items } from '../../core/models';
import { SHARED, entityLink } from '../../shared/ui';

@Component({
  selector: 'app-action-center-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTableModule, ...SHARED],
  template: `
    <div class="page-head">
      <div>
        <h1>Action Center</h1>
        <p>Open workflow tasks for your role, highest priority first.</p>
      </div>
      <div class="actions"><button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button></div>
    </div>
    <div class="table-wrap">
      <app-state [loading]="data.loading()" [error]="data.error()" [empty]="data.value()?.items?.length ? null : 'No open action items'" (retry)="data.reload()" icon="task_alt" />
      @if (!data.loading() && data.value()?.items?.length) {
        <table mat-table [dataSource]="data.value()!.items">
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let a"><app-priority [score]="a.PriorityScore" /></td>
          </ng-container>
          <ng-container matColumnDef="ref">
            <th mat-header-cell *matHeaderCellDef>Reference</th>
            <td mat-cell *matCellDef="let a"><span class="ref">{{ a.ReferenceNo ?? '—' }}</span><span class="sub">{{ a.EntityType | humanize }}</span></td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let a">{{ a.ActionType | humanize }}<span class="sub">{{ a.Summary }}</span></td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Assigned role</th>
            <td mat-cell *matCellDef="let a">{{ a.AssignedRole | humanize }}</td>
          </ng-container>
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef>Created</th>
            <td mat-cell *matCellDef="let a">{{ a.ActionCreatedAt | date: 'MMM d, h:mm a' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let a; columns: cols" (click)="open(a)"></tr>
        </table>
      }
    </div>
  `,
})
export class ActionCenterPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly cols = ['priority', 'ref', 'action', 'role', 'created'];
  readonly data = load(() => this.api.get<Items<ActionItem>>('/api/maintenance/action-center'));

  open(a: ActionItem): void {
    const link = entityLink(a.EntityType, a.EntityId);
    if (link) void this.router.navigateByUrl(link);
  }
}
