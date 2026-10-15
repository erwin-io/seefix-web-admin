import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { useDataset } from '@app/core/data/dataset.store';
import { DataTableComponent } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { entityLink } from '@app/shared/utils/entity-link';
import { ActionItem } from '../../maintenance.models';
import { ACTION_CENTER } from '../../maintenance.service';

/** Default order is the API's business ranking (priority, then age). */
@Component({
  selector: 'app-action-center-page',
  imports: [DatePipe, DataTableComponent, MatButtonModule, MatIconModule, MatSortModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './action-center.page.html',
  styleUrl: './action-center.page.scss',
})
export class ActionCenterPage {
  private readonly router = inject(Router);
  readonly columns = ['priority', 'ref', 'action', 'role', 'created'];
  readonly data = useDataset(ACTION_CENTER);
  readonly sortBy = {
    priority: (a: ActionItem) => a.PriorityScore,
    ref: (a: ActionItem) => a.ReferenceNo,
    action: (a: ActionItem) => a.ActionType,
    role: (a: ActionItem) => a.AssignedRole,
    created: (a: ActionItem) => a.ActionCreatedAt,
  };
  readonly searchText = (a: ActionItem) => [a.ReferenceNo, a.EntityType, a.ActionType, a.Summary, a.AssignedRole].join(' ');

  open(a: ActionItem): void {
    const link = entityLink(a.EntityType, a.EntityId);
    if (link) void this.router.navigateByUrl(link);
  }
}
