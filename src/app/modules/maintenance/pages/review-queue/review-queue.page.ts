import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { useDataset } from '@app/core/data/dataset.store';
import { DataTableComponent } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { ReviewQueueItem, Triage, byTriage } from '../../maintenance.models';
import { REVIEW_QUEUE } from '../../maintenance.service';

/** Default order is the API's business ranking (live priority, then age). Triage is filtered locally. */
@Component({
  selector: 'app-review-queue-page',
  imports: [DataTableComponent, DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatSortModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './review-queue.page.html',
  styleUrl: './review-queue.page.scss',
})
export class ReviewQueuePage {
  private readonly router = inject(Router);
  readonly columns = ['priority', 'report', 'category', 'screening', 'location', 'created'];
  readonly triage = signal<Triage>('all');
  readonly data = useDataset(REVIEW_QUEUE);
  readonly rows = computed(() => byTriage(this.data.rows(), this.triage(), (r) => r.screening.isActionable));
  readonly sortBy = {
    priority: (r: ReviewQueueItem) => r.LivePriorityScore,
    report: (r: ReviewQueueItem) => r.ReportNo,
    category: (r: ReviewQueueItem) => r.EffectiveCategory,
    screening: (r: ReviewQueueItem) => r.screening.title,
    location: (r: ReviewQueueItem) => r.Building,
    created: (r: ReviewQueueItem) => r.CreatedAt,
  };
  readonly searchText = (r: ReviewQueueItem) =>
    [r.ReportNo, r.AiSummary, r.EffectiveCategory, r.EffectiveUrgency, r.Building, r.Floor, r.RoomOrArea, r.screening.title].join(' ');

  open(r: ReviewQueueItem): void {
    void this.router.navigate(['/reports', r.ReportId]);
  }
}
