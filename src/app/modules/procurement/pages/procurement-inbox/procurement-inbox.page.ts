import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { useDataset } from '@app/core/data/dataset.store';
import { DataTableComponent, newestFirst } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { ANY_DAY, DateRangeFilterComponent, DayRange, inDayRange } from '@app/shared/components/date-range-filter/date-range-filter.component';
import { ProcurementInboxItem } from '../../procurement.models';
import { PROCUREMENT_INBOX } from '../../procurement.service';

const URGENCY_RANK: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

/** Newest handoff first (SubmittedAt = handoff creation, HandoffId tie-breaker); Open/All, search, sort, paging are local. */
@Component({
  selector: 'app-procurement-inbox-page',
  imports: [DataTableComponent, DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatSortModule, MatTableModule, DateRangeFilterComponent, ...SHARED_IMPORTS],
  templateUrl: './procurement-inbox.page.html',
  styleUrl: './procurement-inbox.page.scss',
})
export class ProcurementInboxPage {
  private readonly router = inject(Router);
  readonly columns = ['priority', 'handoff', 'status', 'scope', 'urgency', 'dates'];
  readonly view = signal<'open' | 'all'>('open');
  /** Submitted date = handoff creation (owner item 12). */
  readonly submitted = signal<DayRange>(ANY_DAY);
  readonly data = useDataset(PROCUREMENT_INBOX);
  readonly rows = computed(() => {
    const range = this.submitted();
    const items = this.data.rows().filter((h) => inDayRange(h.SubmittedAt, range));
    return this.view() === 'all' ? items : items.filter((h) => !['COMPLETED', 'CANCELLED'].includes(h.Status));
  });
  readonly order = newestFirst<ProcurementInboxItem>((h) => h.SubmittedAt, (h) => h.HandoffId);
  readonly sortBy = {
    priority: (h: ProcurementInboxItem) => h.LivePriorityScore,
    handoff: (h: ProcurementInboxItem) => h.HandoffNo,
    status: (h: ProcurementInboxItem) => h.Status,
    scope: (h: ProcurementInboxItem) => h.RequiredService ?? h.EffectiveCategory,
    urgency: (h: ProcurementInboxItem) => URGENCY_RANK[h.EffectiveUrgency ?? ''] ?? null,
    dates: (h: ProcurementInboxItem) => h.SubmittedAt,
  };
  readonly searchText = (h: ProcurementInboxItem) =>
    [h.HandoffNo, h.RequestNo, h.ReportNo, h.RequiredService, h.EffectiveCategory, h.ScopeOfWork, h.ExternalSystemReference].join(' ');

  open(h: ProcurementInboxItem): void {
    void this.router.navigate(['/procurement/handoffs', h.HandoffId]);
  }
}
