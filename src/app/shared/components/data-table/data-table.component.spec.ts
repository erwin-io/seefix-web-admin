import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { provideRouter } from '@angular/router';
import { Dataset } from '@app/core/data/dataset.store';
import { PageResponse } from '@app/core/data/fetch-all';
import { MaintenanceReportItem } from '@app/modules/maintenance/maintenance.models';
import { ReportListPage } from '@app/modules/maintenance/pages/report-list/report-list.page';
import { DataTableComponent, newestFirst } from './data-table.component';

interface Row {
  id: string;
  name: string;
  createdAt: string;
}

// 120 rows: id r000..r119, created one minute apart, names in reverse.
const ROWS: Row[] = Array.from({ length: 120 }, (_, i) => ({
  id: `r${String(i).padStart(3, '0')}`,
  name: `name ${String(119 - i).padStart(3, '0')}`,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
}));

@Component({
  imports: [DataTableComponent, MatTableModule, MatSortModule],
  template: `
    <app-data-table [dataset]="data" [columns]="['id', 'name']" [order]="order" [sortBy]="sortBy" [searchText]="searchText">
      <ng-container matColumnDef="id">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Id</th>
        <td mat-cell *matCellDef="let r">{{ r.id }}</td>
      </ng-container>
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
        <td mat-cell *matCellDef="let r">{{ r.name }}</td>
      </ng-container>
    </app-data-table>
  `,
})
class HostPage {
  readonly calls = signal(0);
  readonly data = new Dataset<Row>({ key: 't', path: '/t', idOf: (r) => r.id, domains: [] }, async (page): Promise<PageResponse<Row>> => {
    this.calls.update((n) => n + 1);
    return { body: { items: ROWS, page, pageSize: 500, hasMore: false }, versions: null };
  });
  readonly order = newestFirst<Row>((r) => r.createdAt, (r) => r.id);
  readonly sortBy = { id: (r: Row) => r.id, name: (r: Row) => r.name };
  readonly searchText = (r: Row) => `${r.id} ${r.name}`;
}

describe('DataTableComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [HostPage] });
    const fixture = TestBed.createComponent(HostPage);
    await fixture.componentInstance.data.ensure();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const ids = () => [...el.querySelectorAll('td.mat-column-id')].map((td) => td.textContent?.trim());
    const header = (col: string) => el.querySelector(`th.mat-column-${col} .mat-sort-header-container`) as HTMLElement;
    const table = fixture.debugElement.children[0].componentInstance as DataTableComponent<Row>;
    return { fixture, el, ids, header, table, host: fixture.componentInstance };
  }

  it('shows the default order (CreatedAt DESC, id tie-breaker) on the first page of 25', async () => {
    const { ids, el } = await setup();
    expect(ids().length).toBe(25);
    expect(ids()[0]).toBe('r119');
    expect(ids()[24]).toBe('r095');
    expect(el.querySelector('.count')?.textContent).toContain('120 of 120');
  });

  it('sorts, filters and pages locally with zero list calls, and restores the default order', async () => {
    const { fixture, ids, header, table, host, el } = await setup();
    expect(host.calls()).toBe(1);

    header('id').click(); // asc
    await fixture.whenStable();
    expect(ids()[0]).toBe('r000');
    expect(table.sorted()).toBe(true);

    header('name').click(); // name asc = id desc
    await fixture.whenStable();
    expect(ids()[0]).toBe('r119');

    (el.querySelector('.mat-mdc-paginator-navigation-next') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(ids()[0]).toBe('r094');

    table.query.set('r11');
    await fixture.whenStable();
    expect(ids().sort()).toEqual(['r110', 'r111', 'r112', 'r113', 'r114', 'r115', 'r116', 'r117', 'r118', 'r119']);
    expect(el.querySelector('.count')?.textContent).toContain('10 of 120');

    table.query.set('');
    table.restoreDefault();
    await fixture.whenStable();
    expect(table.sorted()).toBe(false);
    expect(ids()[0]).toBe('r119');
    expect(host.calls()).toBe(1); // still the single initial load
  });
});

describe('ReportListPage', () => {
  it('triage, status and search filter locally: zero list calls after the load', async () => {
    TestBed.configureTestingModule({
      imports: [ReportListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReportListPage);
    const report = (i: number, status: string, isActionable: boolean) =>
      ({ id: `r${i}`, reportNo: `R-${i}`, status, createdAt: `2026-01-0${i}T00:00:00Z`, screening: { isActionable, title: 't' } }) as MaintenanceReportItem;
    const items = [report(1, 'SUBMITTED', true), report(2, 'RESOLVED', false), report(3, 'SUBMITTED', false)];
    http.expectOne((r) => r.url === '/api/maintenance/reports' && r.params.get('page') === '1').flush({ items, page: 1, pageSize: 500, hasMore: false });
    await fixture.whenStable();
    const page = fixture.componentInstance;
    expect(page.rows().map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);

    page.triage.set('actionable');
    expect(page.rows().map((r) => r.id)).toEqual(['r1']);
    page.triage.set('screening');
    page.status.set('SUBMITTED');
    expect(page.rows().map((r) => r.id)).toEqual(['r3']);
    await fixture.whenStable();
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('td.mat-column-report .ref')].map((e) => e.textContent);
    expect(ids).toEqual(['R-3']);
    http.verify(); // no further list requests
  });
});
