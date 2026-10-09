import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { ProcurementInboxItem } from '../../procurement.models';
import { ProcurementService } from '../../procurement.service';

@Component({
  selector: 'app-procurement-inbox-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './procurement-inbox.page.html',
  styleUrl: './procurement-inbox.page.scss',
})
export class ProcurementInboxPage {
  private readonly procurement = inject(ProcurementService);
  private readonly router = inject(Router);
  readonly columns = ['priority', 'handoff', 'status', 'scope', 'urgency', 'dates'];
  readonly view = signal<'open' | 'all'>('open');
  readonly data = load(() => this.procurement.inbox());
  readonly rows = computed(() => {
    const items = this.data.value()?.items ?? [];
    return this.view() === 'all' ? items : items.filter((h) => !['COMPLETED', 'CANCELLED'].includes(h.Status));
  });

  open(h: ProcurementInboxItem): void {
    void this.router.navigate(['/procurement/handoffs', h.HandoffId]);
  }
}
