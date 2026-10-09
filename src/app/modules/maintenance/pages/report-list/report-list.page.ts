import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { load } from '@app/core/utils/load';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { MaintenanceReportItem, REPORT_STATUSES, Triage } from '../../maintenance.models';
import { MaintenanceService } from '../../maintenance.service';

@Component({
  selector: 'app-report-list-page',
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatSelectModule, MatTableModule, ...SHARED_IMPORTS,
  ],
  templateUrl: './report-list.page.html',
  styleUrl: './report-list.page.scss',
})
export class ReportListPage {
  private readonly maintenance = inject(MaintenanceService);
  private readonly router = inject(Router);
  readonly statuses = REPORT_STATUSES;
  readonly columns = ['priority', 'report', 'status', 'category', 'location', 'created'];
  readonly triage = signal<Triage>('all');
  readonly status = signal<string | null>(null);
  readonly search = signal('');
  readonly data = load(() => this.maintenance.reports(this.triage(), this.status()));
  // shortcut: client-side search over the API's 200-row page; add server search when volume grows.
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const items = this.data.value()?.items ?? [];
    return q ? items.filter((r) => [r.reportNo, r.effectiveCategory, r.building, r.roomOrArea].some((v) => v?.toLowerCase().includes(q))) : items;
  });

  open(r: MaintenanceReportItem): void {
    void this.router.navigate(['/reports', r.id]);
  }
}
