import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { useDataset } from '@app/core/data/dataset.store';
import { DataTableComponent, newestFirst } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { MaintenanceReportItem, REPORT_STATUSES, Triage, byTriage } from '../../maintenance.models';
import { REPORTS } from '../../maintenance.service';

/** Every report the role may see, newest first; triage, status, search, sort and paging are local. */
@Component({
  selector: 'app-report-list-page',
  imports: [
    DataTableComponent, DatePipe, FormsModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule,
    MatSelectModule, MatSortModule, MatTableModule, ...SHARED_IMPORTS,
  ],
  templateUrl: './report-list.page.html',
  styleUrl: './report-list.page.scss',
})
export class ReportListPage {
  private readonly router = inject(Router);
  readonly statuses = REPORT_STATUSES;
  readonly columns = ['priority', 'report', 'status', 'category', 'location', 'created'];
  readonly triage = signal<Triage>('all');
  readonly status = signal<string | null>(null);
  readonly data = useDataset(REPORTS);
  readonly rows = computed(() => {
    const status = this.status();
    const rows = byTriage(this.data.rows(), this.triage(), (r) => r.screening.isActionable);
    return status ? rows.filter((r) => r.status === status) : rows;
  });
  readonly order = newestFirst<MaintenanceReportItem>((r) => r.createdAt, (r) => r.id);
  readonly sortBy = {
    priority: (r: MaintenanceReportItem) => r.priorityScore,
    report: (r: MaintenanceReportItem) => r.reportNo,
    status: (r: MaintenanceReportItem) => r.status,
    category: (r: MaintenanceReportItem) => r.effectiveCategory,
    location: (r: MaintenanceReportItem) => r.building,
    created: (r: MaintenanceReportItem) => r.createdAt,
  };
  readonly searchText = (r: MaintenanceReportItem) =>
    [r.reportNo, r.effectiveCategory, r.effectiveUrgency, r.building, r.floor, r.roomOrArea, r.screening.title].join(' ');

  open(r: MaintenanceReportItem): void {
    void this.router.navigate(['/reports', r.id]);
  }
}
