import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { entityLink } from '@app/shared/utils/entity-link';
import { ActionItem } from '../../maintenance.models';
import { MaintenanceService } from '../../maintenance.service';

@Component({
  selector: 'app-action-center-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './action-center.page.html',
  styleUrl: './action-center.page.scss',
})
export class ActionCenterPage {
  private readonly maintenance = inject(MaintenanceService);
  private readonly router = inject(Router);
  readonly columns = ['priority', 'ref', 'action', 'role', 'created'];
  readonly data = load(() => this.maintenance.actionCenter());

  open(a: ActionItem): void {
    const link = entityLink(a.EntityType, a.EntityId);
    if (link) void this.router.navigateByUrl(link);
  }
}
