import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { Api, toAppError } from '../../core/api';
import { load } from '../../core/load';
import { Items, ROLE_LABEL, Role, User } from '../../core/models';
import { Ui } from '../../core/ui';
import { SHARED } from '../../shared/ui';

const ROLES = Object.keys(ROLE_LABEL) as Role[];

@Component({
  selector: 'app-create-user-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Create user</h2>
    <mat-dialog-content>
      @if (error()) {
        <p class="chip tone-danger" role="alert" style="display: block; border-radius: 8px; padding: 8px 12px">{{ error() }}</p>
      }
      <form [formGroup]="form" class="form-grid" id="create-user" (ngSubmit)="save()">
        <mat-form-field class="span-all"><mat-label>Full name</mat-label><input matInput formControlName="fullName" /></mat-form-field>
        <mat-form-field><mat-label>Email</mat-label><input matInput type="email" formControlName="email" /></mat-form-field>
        <mat-form-field>
          <mat-label>Username (optional)</mat-label><input matInput formControlName="username" />
          <mat-hint>3–30: letters, digits, . _ -</mat-hint>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            @for (r of roles; track r) {
              <mat-option [value]="r">{{ label[r] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Temporary password</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>8+ characters</mat-hint>
        </mat-form-field>
        <mat-form-field><mat-label>Job title</mat-label><input matInput formControlName="jobTitle" /></mat-form-field>
        <mat-form-field><mat-label>Department / trade</mat-label><input matInput formControlName="departmentOrTrade" /></mat-form-field>
        <mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
        <mat-form-field><mat-label>Institutional ID</mat-label><input matInput formControlName="institutionalId" /></mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="create-user" [disabled]="busy()">Create user</button>
    </mat-dialog-actions>
  `,
})
export class CreateUserDialog {
  private readonly api = inject(Api);
  private readonly ref = inject(MatDialogRef<CreateUserDialog>);
  readonly roles = ROLES;
  readonly label = ROLE_LABEL;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/)],
    role: ['WORKER' as Role, Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    jobTitle: [''],
    departmentOrTrade: [''],
    phone: [''],
    institutionalId: [''],
  });

  async save(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set(null);
    try {
      const body = Object.fromEntries(Object.entries(this.form.getRawValue()).filter(([, v]) => v !== ''));
      await firstValueFrom(this.api.post('/api/admin/users', body));
      this.ref.close(true);
    } catch (e) {
      this.error.set(toAppError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}

/** List + create only: the API has no edit/deactivate endpoints yet. */
@Component({
  selector: 'app-users-page',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule, ...SHARED],
  template: `
    <div class="page-head">
      <div>
        <h1>Users</h1>
        <p>{{ data.value()?.items?.length ?? 0 }} accounts. Editing and deactivation need backend support (not available yet).</p>
      </div>
      <div class="actions">
        <button mat-stroked-button (click)="data.reload()"><mat-icon>refresh</mat-icon>Refresh</button>
        <button mat-flat-button (click)="create()"><mat-icon>person_add</mat-icon>Create user</button>
      </div>
    </div>
    <div class="toolbar-row">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Role</mat-label>
        <mat-select [ngModel]="role()" (ngModelChange)="role.set($event)">
          <mat-option [value]="null">All roles</mat-option>
          @for (r of roles; track r) {
            <mat-option [value]="r">{{ label[r] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Name, email, username" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
    </div>
    <div class="table-wrap">
      <app-state [loading]="data.loading()" [error]="data.error()" [empty]="rows().length ? null : 'No users match'" (retry)="data.reload()" icon="group" />
      @if (!data.loading() && rows().length) {
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let u">{{ u.fullName }}<span class="sub">{{ u.email }}{{ u.username ? ' · @' + u.username : '' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let u">{{ $any(label)[u.role] ?? u.role }}<span class="sub">{{ u.jobTitle }}{{ u.departmentOrTrade ? ' · ' + u.departmentOrTrade : '' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let u">
              <span class="chip" [class]="u.isActive ? 'chip tone-ok' : 'chip tone-muted'">{{ u.isActive ? 'Active' : 'Inactive' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="login">
            <th mat-header-cell *matHeaderCellDef>Last sign-in</th>
            <td mat-cell *matCellDef="let u">{{ (u.lastLoginAt | date: 'MMM d, y') ?? 'Never' }}</td>
          </ng-container>
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef>Created</th>
            <td mat-cell *matCellDef="let u">{{ u.createdAt | date: 'MMM d, y' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let u; columns: cols" style="cursor: default"></tr>
        </table>
      }
    </div>
  `,
})
export class UsersPage {
  private readonly api = inject(Api);
  private readonly dialog = inject(MatDialog);
  private readonly ui = inject(Ui);
  readonly roles = ROLES;
  readonly label = ROLE_LABEL;
  readonly cols = ['name', 'role', 'active', 'login', 'created'];
  readonly role = signal<Role | null>(null);
  readonly search = signal('');
  readonly data = load(() => this.api.get<Items<User>>('/api/admin/users'));
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.data.value()?.items ?? []).filter(
      (u) => (!this.role() || u.role === this.role()) && (!q || [u.fullName, u.email, u.username].some((v) => v?.toLowerCase().includes(q))),
    );
  });

  async create(): Promise<void> {
    const created = await firstValueFrom(this.dialog.open(CreateUserDialog, { width: '640px' }).afterClosed());
    if (!created) return;
    this.ui.toast('User created.');
    await this.data.reload();
  }
}
