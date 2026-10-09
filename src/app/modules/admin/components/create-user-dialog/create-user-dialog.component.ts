import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { toAppError } from '@app/core/http/app-error';
import { ROLE_LABEL, Role } from '@app/core/models/user.model';
import { firstValueFrom } from 'rxjs';
import { CreateUserRequest } from '../../admin.models';
import { AdminService } from '../../admin.service';

/** Closes with `true` when the user was created. */
@Component({
  selector: 'app-create-user-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './create-user-dialog.component.html',
  styleUrl: './create-user-dialog.component.scss',
})
export class CreateUserDialogComponent {
  private readonly admin = inject(AdminService);
  private readonly ref = inject(MatDialogRef<CreateUserDialogComponent>);
  readonly roles = Object.keys(ROLE_LABEL) as Role[];
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
      const body = Object.fromEntries(Object.entries(this.form.getRawValue()).filter(([, v]) => v !== '')) as unknown as CreateUserRequest;
      await firstValueFrom(this.admin.createUser(body));
      this.ref.close(true);
    } catch (e) {
      this.error.set(toAppError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
