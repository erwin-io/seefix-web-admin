import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable, firstValueFrom } from 'rxjs';
import { SessionService } from '@app/core/auth/session.service';
import { toAppError } from '@app/core/http/app-error';
import { ROLE_LABEL, User } from '@app/core/models/user.model';
import { UiService } from '@app/shared/services/ui.service';
import { AccountService } from '../../account.service';

/** seefix-api account error codes and the field they belong to. */
const FIELD_FOR_CODE: Record<string, string> = {
  CURRENT_PASSWORD_INCORRECT: 'currentPassword',
  INVALID_USERNAME: 'username',
  USERNAME_IN_USE: 'username',
  INVALID_EMAIL: 'newEmail',
  EMAIL_IN_USE: 'newEmail',
  EMAIL_UNCHANGED: 'newEmail',
  INVALID_PASSWORD: 'newPassword',
  PASSWORD_UNCHANGED: 'newPassword',
};

/**
 * Staff account settings. Profile/username keep the session; email and password
 * changes revoke every JWT (CredentialsVersion), so we sign out afterwards.
 */
@Component({
  selector: 'app-account-settings-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  styleUrl: './account-settings.page.scss',
  templateUrl: './account-settings.page.html',
})
export class AccountSettingsPage {
  private readonly account = inject(AccountService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly session = inject(SessionService);
  readonly busy = signal(false);
  /** Password fields currently shown as text, by `form.control`. */
  private readonly visible = signal(new Set<string>());

  shown(field: string): boolean {
    return this.visible().has(field);
  }

  toggle(field: string): void {
    const next = new Set(this.visible());
    if (!next.delete(field)) next.add(field);
    this.visible.set(next);
  }
  readonly roleLabel = () => ROLE_LABEL[this.session.role() ?? 'ADMIN'];

  private readonly u = this.session.user();
  // Length limits match seefix-api (PATCH /api/auth/me).
  readonly profile = this.fb.group({
    fullName: [this.u?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    phone: [this.u?.phone ?? '', Validators.maxLength(50)],
    jobTitle: [this.u?.jobTitle ?? '', Validators.maxLength(150)],
    departmentOrTrade: [this.u?.departmentOrTrade ?? '', Validators.maxLength(150)],
  });
  readonly username = this.fb.group({
    username: [this.u?.username ?? '', [Validators.required, Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/)]],
    currentPassword: ['', Validators.required],
  });
  readonly email = this.fb.group({ newEmail: ['', [Validators.required, Validators.email]], currentPassword: ['', Validators.required] });
  readonly password = this.fb.group({ currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, Validators.minLength(8)]] });

  /** Message for a field's current error: the API's own message, else the failed frontend rule. */
  errorText(control: AbstractControl | null, label: string): string {
    const e = control?.errors;
    if (!e) return '';
    if (e['server']) return e['server'];
    if (e['required']) return `${label} is required.`;
    if (e['minlength']) return `${label} must be at least ${e['minlength'].requiredLength} characters.`;
    if (e['maxlength']) return `${label} must be at most ${e['maxlength'].requiredLength} characters.`;
    if (e['email']) return 'Enter a valid email address.';
    if (e['pattern']) return 'Use 3–30 letters, digits, . _ or -, starting with a letter or digit.';
    return `${label} is invalid.`;
  }

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
      this.showError(form, e);
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Every API error shows the snackbar. Validation errors also go on the field they concern; one that isn't tied to
   * a field marks every field of the form. Angular clears them as soon as the field is edited.
   */
  private showError(form: FormGroup, e: unknown): void {
    const err = toAppError(e);
    this.ui.error(err);
    const field = err.code ? FIELD_FOR_CODE[err.code] : undefined;
    const fieldError = field || err.kind === 'VALIDATION' || err.kind === 'CONFLICT';
    if (!fieldError) return;
    const targets = field && form.get(field) ? [form.get(field)!] : Object.values(form.controls);
    for (const control of targets) {
      control.setErrors({ ...control.errors, server: err.message });
      control.markAsTouched();
    }
  }
}
