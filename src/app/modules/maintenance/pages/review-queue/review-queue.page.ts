import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { ReviewQueueItem, Triage } from '../../maintenance.models';
import { MaintenanceService } from '../../maintenance.service';

@Component({
  selector: 'app-review-queue-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './review-queue.page.html',
  styleUrl: './review-queue.page.scss',
})
export class ReviewQueuePage {
  private readonly maintenance = inject(MaintenanceService);
  private readonly router = inject(Router);
  readonly columns = ['priority', 'report', 'category', 'screening', 'location', 'created'];
  readonly triage = signal<Triage>('all');
  readonly data = load(() => this.maintenance.reviewQueue(this.triage()));

  open(r: ReviewQueueItem): void {
    void this.router.navigate(['/reports', r.ReportId]);
  }
}
