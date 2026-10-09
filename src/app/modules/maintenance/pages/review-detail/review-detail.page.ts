import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { MaintenanceService } from '../../maintenance.service';

/** GET /api/maintenance/reviews/:id takes the MaintenanceReview id (not the report id). */
@Component({
  selector: 'app-review-detail-page',
  imports: [DatePipe, RouterLink, MatButtonModule, ...SHARED_IMPORTS],
  templateUrl: './review-detail.page.html',
  styleUrl: './review-detail.page.scss',
})
export class ReviewDetailPage {
  private readonly maintenance = inject(MaintenanceService);
  readonly id = input.required<string>();
  readonly data = load(() => this.maintenance.review(this.id()));
  readonly rv = computed(() => this.data.value()?.review ?? null);
  readonly location = computed(() => {
    const rv = this.rv();
    return [rv?.['Building'], rv?.['Floor'], rv?.['RoomOrArea']].filter(Boolean).join(' · ') || '—';
  });
}
