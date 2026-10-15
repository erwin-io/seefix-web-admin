import { AfterContentInit, Component, ContentChildren, QueryList, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort } from '@angular/material/sort';
import { MatColumnDef, MatTable, MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Dataset, MEMORY_WARNING_ROWS } from '@app/core/data/dataset.store';
import { PageStateComponent } from '../page-state/page-state.component';

export type SortValue = string | number | null | undefined;

/** Default order "newest first": CreatedAt DESC with the id as tie-breaker. */
export function newestFirst<T>(createdAt: (row: T) => string | null, id: (row: T) => string) {
  return (a: T, b: T) => (createdAt(b) ?? '').localeCompare(createdAt(a) ?? '') || id(b).localeCompare(id(a));
}

/**
 * The one list table: MatTable + MatSort + MatPaginator + text filter over a fully loaded Dataset. Sorting, filtering
 * and paging are local, so they never call the API. Pages project their `matColumnDef`s (add `mat-sort-header` to
 * sortable headers) and extra filters (`[tableFilters]`).
 */
@Component({
  selector: 'app-data-table',
  hostDirectives: [MatSort],
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatTableModule, PageStateComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T> implements AfterContentInit {
  readonly dataset = input.required<Dataset<T>>();
  /** Rows after the page's own filters (status, role…); defaults to the whole dataset. */
  readonly rows = input<T[] | null>(null);
  readonly columns = input.required<string[]>();
  /** Default order when no header sort is active. Omit to keep the server's business order. */
  readonly order = input<((a: T, b: T) => number) | null>(null);
  /** Sort value per sortable column id. */
  readonly sortBy = input<Record<string, (row: T) => SortValue>>({});
  /** Text the search box matches against. */
  readonly searchText = input.required<(row: T) => string>();
  readonly searchPlaceholder = input('');
  readonly emptyText = input('Nothing to show');
  readonly icon = input('inbox');
  readonly clickable = input(true);
  readonly rowClick = output<T>();

  @ContentChildren(MatColumnDef) private readonly columnDefs!: QueryList<MatColumnDef>;
  @ViewChild(MatTable, { static: true }) private readonly table!: MatTable<T>;
  @ViewChild(MatPaginator, { static: true }) private readonly paginator!: MatPaginator;

  readonly sort = inject(MatSort);
  readonly memoryWarningRows = MEMORY_WARNING_ROWS;
  readonly source = new MatTableDataSource<T>([]);
  readonly query = signal('');
  readonly sorted = signal(false);
  readonly all = computed(() => this.rows() ?? this.dataset().rows());
  readonly filtered = computed(() => {
    const order = this.order();
    const rows = order ? [...this.all()].sort(order) : this.all();
    const q = this.query().trim().toLowerCase();
    if (!q) return rows;
    const text = this.searchText();
    return rows.filter((r) => text(r).toLowerCase().includes(q));
  });

  constructor() {
    this.source.sortingDataAccessor = (row, col) => {
      const v = this.sortBy()[col]?.(row);
      return (typeof v === 'string' ? v.toLowerCase() : v) as string | number;
    };
    effect(() => (this.source.data = this.filtered()));
    effect(() => {
      this.query();
      this.paginator.firstPage();
    });
    this.sort.sortChange.subscribe((s) => this.sorted.set(!!s.active && !!s.direction));
  }

  ngAfterContentInit(): void {
    this.columnDefs.forEach((def) => this.table.addColumnDef(def));
    this.source.sort = this.sort;
    this.source.paginator = this.paginator;
  }

  restoreDefault(): void {
    this.sort.active = '';
    this.sort.direction = '';
    this.sort.sortChange.emit({ active: '', direction: '' });
  }
}
