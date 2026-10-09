import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ROLE_LABEL, Role } from '@app/core/models/user.model';
import { load } from '@app/core/utils/load';
import { UiService } from '@app/shared/services/ui.service';
import { SHARED_IMPORTS } from '@app/shared/shared.imports';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../admin.service';
import { CreateUserDialogComponent } from '../../components/create-user-dialog/create-user-dialog.component';

/** List + create only: the API has no edit/deactivate endpoints yet. */
@Component({
  selector: 'app-user-list-page',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule, ...SHARED_IMPORTS],
  templateUrl: './user-list.page.html',
  styleUrl: './user-list.page.scss',
})
export class UserListPage {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiService);
  readonly roles = Object.keys(ROLE_LABEL) as Role[];
  readonly label = ROLE_LABEL;
  readonly columns = ['name', 'role', 'active', 'login', 'created'];
  readonly role = signal<Role | null>(null);
  readonly search = signal('');
  readonly data = load(() => this.admin.users());
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.data.value()?.items ?? []).filter(
      (u) => (!this.role() || u.role === this.role()) && (!q || [u.fullName, u.email, u.username].some((v) => v?.toLowerCase().includes(q))),
    );
  });

  roleName(role: Role): string {
    return ROLE_LABEL[role] ?? role;
  }

  async create(): Promise<void> {
    const created = await firstValueFrom(this.dialog.open(CreateUserDialogComponent, { width: '640px' }).afterClosed());
    if (!created) return;
    this.ui.toast('User created.');
    await this.data.reload();
  }
}
