import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { useDataset } from '@app/core/data/dataset.store';
import { ROLE_LABEL, Role, User } from '@app/core/models/user.model';
import { DataTableComponent, newestFirst } from '@app/shared/components/data-table/data-table.component';
import { UiService } from '@app/shared/services/ui.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { firstValueFrom } from 'rxjs';
import { USERS } from '../../admin.service';
import { CreateUserDialogComponent } from '../../components/create-user-dialog/create-user-dialog.component';

/** List + create only: the API has no edit/deactivate endpoints yet. Newest account first; all filtering is local. */
@Component({
  selector: 'app-user-list-page',
  imports: [DataTableComponent, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatSortModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './user-list.page.html',
  styleUrl: './user-list.page.scss',
})
export class UserListPage {
  private readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiService);
  readonly roles = Object.keys(ROLE_LABEL) as Role[];
  readonly label = ROLE_LABEL;
  readonly columns = ['name', 'role', 'active', 'login', 'created'];
  readonly role = signal<Role | null>(null);
  readonly data = useDataset(USERS);
  readonly rows = computed(() => (this.role() ? this.data.rows().filter((u) => u.role === this.role()) : this.data.rows()));
  readonly order = newestFirst<User>((u) => u.createdAt ?? null, (u) => u.id);
  readonly sortBy = {
    name: (u: User) => u.fullName,
    role: (u: User) => this.roleName(u.role),
    active: (u: User) => (u.isActive ? 1 : 0),
    login: (u: User) => u.lastLoginAt,
    created: (u: User) => u.createdAt,
  };
  readonly searchText = (u: User) => [u.fullName, u.email, u.username, u.jobTitle, u.departmentOrTrade].join(' ');

  roleName(role: Role): string {
    return ROLE_LABEL[role] ?? role;
  }

  async create(): Promise<void> {
    const created = await firstValueFrom(this.dialog.open(CreateUserDialogComponent, { width: '640px' }).afterClosed());
    if (!created) return;
    // The list reloads itself after the write (revalidateInterceptor).
    this.ui.toast('User created.');
  }
}
