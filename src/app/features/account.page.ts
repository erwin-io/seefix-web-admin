import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { ROLE_LABEL, User } from '../core/models';
import { Session } from '../core/session';
import { Ui } from '../core/ui';

/**
 * Staff account settings. Profile/username keep the session; email and password
 * changes revoke every JWT (CredentialsVersion), so we sign out afterwards.
 */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  styles: '.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; align-items: start; } .grid .card { margin: 0; }',
  template: `
    <div class="page-head">
      <div>
        <h1>Account settings</h1>
        <p>{{ session.user()?.email }} · {{ roleLabel() }}</p>
      </div>
    </div>
    <div class="grid">
      <form class="card" [formGroup]="profile" (ngSubmit)="saveProfile()">
        <h2>Profile</h2>
        <mat-form-field class="full"><mat-label>Full name</mat-label><input matInput formControlName="fullName" /></mat-form-field>
        <mat-form-field class="full"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
        <mat-form-field class="full"><mat-label>Job title</mat-label><input matInput formControlName="jobTitle" /></mat-form-field>
        <mat-form-field class="full"><mat-label>Department / trade</mat-label><input matInput formControlName="departmentOrTrade" /></mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy() || profile.pristine">Save profile</button>
      </form>

      <form class="card" [formGroup]="username" (ngSubmit)="saveUsername()">
        <h2>Username</h2>
        <p class="muted">Sign in with your email or this username.</p>
        <mat-form-field class="full">
          <mat-label>Username</mat-label><input matInput formControlName="username" autocomplete="username" />
          <mat-hint>3–30: letters, digits, . _ -</mat-hint>
        </mat-form-field>
        <mat-form-field class="full"><mat-label>Current password</mat-label><input matInput type="password" formControlName="currentPassword" autocomplete="current-password" /></mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">Change username</button>
      </form>

      <form class="card" [formGroup]="email" (ngSubmit)="saveEmail()">
        <h2>Email</h2>
        <p class="muted">Staff email changes apply immediately and sign you out everywhere.</p>
        <mat-form-field class="full"><mat-label>New email</mat-label><input matInput type="email" formControlName="newEmail" autocomplete="email" /></mat-form-field>
        <mat-form-field class="full"><mat-label>Current password</mat-label><input matInput type="password" formControlName="currentPassword" autocomplete="current-password" /></mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">Change email</button>
      </form>

      <form class="card" [formGroup]="password" (ngSubmit)="savePassword()">
        <h2>Password</h2>
        <p class="muted">Changing your password signs you out on all devices.</p>
        <mat-form-field class="full"><mat-label>Current password</mat-label><input matInput type="password" formControlName="currentPassword" autocomplete="current-password" /></mat-form-field>
        <mat-form-field class="full">
          <mat-label>New password</mat-label><input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          <mat-hint>At least 8 characters.</mat-hint>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">Change password</button>
      </form>
    </div>
  `,
})
export class AccountPage {
  private readonly api = inject(Api);
  private readonly ui = inject(Ui);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly session = inject(Session);
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
    return this.submit(this.profile, () => this.api.patch<{ user: User }>('/api/auth/me', this.profile.getRawValue()), 'Profile updated.', false);
  }

  saveUsername(): Promise<void> {
    return this.submit(this.username, () => this.api.patch<{ user: User }>('/api/auth/me/username', this.username.getRawValue()), 'Username changed.', false);
  }

  async saveEmail(): Promise<void> {
    if (!(await this.ui.confirm({ title: 'Change email?', message: 'You will be signed out on every device and must sign in with the new email.', confirm: 'Change email' }))) return;
    return this.submit(this.email, () => this.api.post('/api/auth/me/change-email', this.email.getRawValue()), 'Email changed. Sign in with your new email.', true);
  }

  async savePassword(): Promise<void> {
    if (!(await this.ui.confirm({ title: 'Change password?', message: 'You will be signed out on every device.', confirm: 'Change password' }))) return;
    return this.submit(this.password, () => this.api.post('/api/auth/me/change-password', this.password.getRawValue()), 'Password changed. Sign in again.', true);
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
