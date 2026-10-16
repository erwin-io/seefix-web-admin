import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { useDataset } from '@app/core/data/dataset.store';
import { DataTableComponent } from '@app/shared/components/data-table/data-table.component';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { Building } from '../../campus.models';
import { BUILDINGS } from '../../campus.service';

/** Admin building settings: the server's order (sort order, then name); filtering and sorting are local. */
@Component({
  selector: 'app-building-list-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatSortModule, MatTableModule, DataTableComponent, ...SHARED_IMPORTS],
  template: `
    <div class="page-head">
      <div>
        <h1>Buildings</h1>
        <p>Names, default pins and perimeters used to place reports on the campus map. Edits are recorded with a revision.</p>
      </div>
      <div class="actions">
        <a mat-stroked-button routerLink="/map"><mat-icon>map</mat-icon>Campus map</a>
        <button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button>
        <a mat-flat-button routerLink="new"><mat-icon>add_business</mat-icon>Add building</a>
      </div>
    </div>
    <app-data-table
      [dataset]="data"
      [columns]="columns"
      [sortBy]="sortBy"
      [searchText]="searchText"
      (rowClick)="open($event)"
      searchPlaceholder="Name or code"
      emptyText="No buildings yet"
      icon="apartment"
    >
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Building</th>
        <td mat-cell *matCellDef="let b">
          <a [routerLink]="[b.id]" (click)="$event.stopPropagation()">{{ b.name }}</a><span class="sub">{{ b.code }}</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="active">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
        <td mat-cell *matCellDef="let b"><app-status-chip [value]="b.isActive ? 'ACTIVE' : 'INACTIVE'" /></td>
      </ng-container>
      <ng-container matColumnDef="sort">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Sort</th>
        <td mat-cell *matCellDef="let b">{{ b.sortOrder }}</td>
      </ng-container>
      <ng-container matColumnDef="geometry">
        <th mat-header-cell *matHeaderCellDef>Location</th>
        <td mat-cell *matCellDef="let b">
          {{ b.perimeter ? b.perimeter.length + '-point perimeter, ' + b.toleranceMeters + ' m tolerance' : 'No perimeter' }}
          <span class="sub">{{ b.defaultLat !== null ? 'Default pin ' + b.defaultLat + ', ' + b.defaultLng : 'No default pin' }}</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="revision">
        <th mat-header-cell *matHeaderCellDef mat-sort-header start="desc">Revision</th>
        <td mat-cell *matCellDef="let b">
          {{ b.geometryRevision }}<span class="sub">{{ b.geometryUpdatedAt | date: 'MMM d, y' }}</span>
        </td>
      </ng-container>
    </app-data-table>
  `,
  styles: `.sub { display: block; color: var(--sf-muted); font-size: 12px; }`,
})
export class BuildingListPage {
  private readonly router = inject(Router);
  readonly data = useDataset(BUILDINGS);
  readonly columns = ['name', 'active', 'sort', 'geometry', 'revision'];
  readonly sortBy = {
    name: (b: Building) => b.name,
    active: (b: Building) => (b.isActive ? 1 : 0),
    sort: (b: Building) => b.sortOrder,
    revision: (b: Building) => b.geometryRevision,
  };
  readonly searchText = (b: Building) => `${b.name} ${b.code}`;

  open(b: Building): void {
    void this.router.navigate(['/admin/buildings', b.id]);
  }
}
