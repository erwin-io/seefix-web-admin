import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, firstValueFrom } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { ROLE_LABEL, User } from '@app/core/models/user.model';
import { UiService } from '@app/shared/services/ui.service';
import { AccountService } from '../../account.service';

/**
 * Staff account settings. Profile/username keep the session; email and password
 * changes revoke every JWT (CredentialsVersion), so we sign out afterwards.
 */
@Component({
  selector: 'app-account-settings-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  styleUrl: './account-settings.page.scss',
  templateUrl: './account-settings.page.html',
})
export class AccountSettingsPage {
  private readonly account = inject(AccountService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly session = inject(SessionService);
  readonly busy = signal(false);
  readonly roleLabel = () => ROLE_LABEL[this.session.role() ?? 'ADMIN'];

  private readonly u = this.session.user();
  readonly profile = this.fb.group({
    fullName: [this.u?.fullName ?? '', [Validators.required, Validators.minLength(2)]],
    phone: [this.u?.phone ?? ''],
    jobTitle: [this.u?.jobTitle ?? ''],
    departmentOrTrade: [this.u?.departmentOrTrade ?? ''],
  });
  readonly username = this.fb.group({
    username: [this.u?.username ?? '', [Validators.required, Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/)]],
    currentPassword: ['', Validators.required],
  });
  readonly email = this.fb.group({ newEmail: ['', [Validators.required, Validators.email]], currentPassword: ['', Validators.required] });
  readonly password = this.fb.group({ currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, Validators.minLength(8)]] });

  saveProfile(): Promise<void> {
    return this.submit(this.profile, () => this.account.updateProfile(this.profile.getRawValue()), 'Profile updated.', false);
  }

  saveUsername(): Promise<void> {
    return this.submit(this.username, () => this.account.changeUsername(this.username.getRawValue()), 'Username changed.', false);
  }

  async saveEmail(): Promise<void> {
    if (!(await this.ui.confirm({ title: 'Change email?', message: 'You will be signed out on every device and must sign in with the new email.', confirm: 'Change email' }))) return;
    return this.submit(this.email, () => this.account.changeEmail(this.email.getRawValue()), 'Email changed. Sign in with your new email.', true);
  }

  async savePassword(): Promise<void> {
    if (!(await this.ui.confirm({ title: 'Change password?', message: 'You will be signed out on every device.', confirm: 'Change password' }))) return;
    return this.submit(this.password, () => this.account.changePassword(this.password.getRawValue()), 'Password changed. Sign in again.', true);
  }

  /** CURRENT_PASSWORD_INCORRECT (401) stays on the form; it is not a session failure. */
  private async submit(form: FormGroup, call: () => Observable<unknown>, done: string, signOut: boolean): Promise<void> {
    if (form.invalid) return form.markAllAsTouched();
    this.busy.set(true);
    try {
      const res = (await firstValueFrom(call())) as { user?: User };
      if (signOut) return this.session.end(done);
      if (res.user) this.session.user.set(res.user);
      form.markAsPristine();
      form.get('currentPassword')?.reset('');
      this.ui.toast(done);
    } catch (e) {
      this.ui.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
