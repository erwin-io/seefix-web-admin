import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { Api, toAppError } from '../core/api';
import { safeReturnUrl } from '../core/guards';
import { Session } from '../core/session';

const AUTH_IMPORTS = [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatProgressBarModule];

const FRAME = `
  :host { display: grid; place-items: center; min-height: 100vh; padding: 16px;
    background: linear-gradient(135deg, #14213a 0%, #1e3a8a 100%); }
  .auth { width: 100%; max-width: 420px; background: #fff; border-radius: 16px; padding: 32px;
    box-shadow: 0 20px 50px rgba(0,0,0,.25); position: relative; overflow: hidden; }
  mat-progress-bar { position: absolute; top: 0; left: 0; right: 0; }
  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .logo span { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px;
    background: #2563eb; color: #fff; font-weight: 700; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  p.lead { margin: 0 0 20px; color: #657285; }
  form { display: flex; flex-direction: column; }
  .msg { padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
  .msg.error { background: #fdecec; color: #c62828; }
  .msg.info { background: #e8efff; color: #1d4ed8; }
  .row { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
  button[type=submit] { height: 44px; }
`;

@Component({
  selector: 'app-login-page',
  imports: AUTH_IMPORTS,
  styles: FRAME,
  template: `
    <div class="auth">
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="logo"><span>SF</span><strong>SEEFIX Admin</strong></div>
      <h1>Sign in</h1>
      <p class="lead">Maintenance, Procurement, Worker and Admin accounts.</p>
      @if (error()) {
        <div class="msg error" role="alert">{{ error() }}</div>
      } @else if (notice()) {
        <div class="msg info">{{ notice() }}</div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field>
          <mat-label>Email or username</mat-label>
          <input matInput formControlName="identifier" autocomplete="username" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Password</mat-label>
          <input matInput [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
          <button mat-icon-button matSuffix type="button" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
            <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">Sign in</button>
        <div class="row"><a routerLink="/forgot-password">Forgot password?</a></div>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly show = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal(this.session.notice());
  readonly form = inject(FormBuilder).nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set(null);
    try {
      const { identifier, password } = this.form.getRawValue();
      await this.session.login(identifier.trim(), password);
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')), { replaceUrl: true });
    } catch (e) {
      this.error.set(toAppError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-forgot-password-page',
  imports: AUTH_IMPORTS,
  styles: FRAME,
  template: `
    <div class="auth">
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <h1>Reset password</h1>
      <p class="lead">We'll email a six-digit code if an account uses this address.</p>
      @if (error()) {
        <div class="msg error" role="alert">{{ error() }}</div>
      }
      <form (ngSubmit)="submit()">
        <mat-form-field>
          <mat-label>Email</mat-label>
          <input matInput type="email" [formControl]="email" autocomplete="email" />
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">Send code</button>
        <div class="row"><a routerLink="/login">Back to sign in</a></div>
      </form>
    </div>
  `,
})
export class ForgotPasswordPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly email = inject(FormBuilder).nonNullable.control('', [Validators.required, Validators.email]);

  async submit(): Promise<void> {
    if (this.email.invalid || this.busy()) return this.email.markAsTouched();
    this.busy.set(true);
    this.error.set(null);
    try {
      const email = this.email.value.trim().toLowerCase();
      await firstValueFrom(this.api.post('/api/auth/forgot-password', { email }, { skipAuth: true }));
      await this.router.navigate(['/reset-password'], { state: { email } });
    } catch (e) {
      this.error.set(toAppError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-reset-password-page',
  imports: AUTH_IMPORTS,
  styles: FRAME,
  template: `
    <div class="auth">
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <h1>Enter reset code</h1>
      <p class="lead">Check your email for the six-digit code.</p>
      @if (error()) {
        <div class="msg error" role="alert">{{ error() }}</div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field>
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Six-digit code</mat-label>
          <input matInput formControlName="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          <mat-hint>At least 8 characters.</mat-hint>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">Update password</button>
        <div class="row"><a routerLink="/login">Back to sign in</a></div>
      </form>
    </div>
  `,
})
export class ResetPasswordPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: [(history.state?.email as string) ?? '', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(this.api.post('/api/auth/reset-password', { ...v, email: v.email.trim().toLowerCase() }, { skipAuth: true }));
      this.session.notice.set('Password updated. Sign in with your new password.');
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (e) {
      const err = toAppError(e);
      // RESET_INVALID (unknown email) must read like a wrong code: no account enumeration.
      this.error.set(['RESET_INVALID', 'OTP_INVALID', 'OTP_EXPIRED'].includes(err.code ?? '') ? 'The code is invalid or expired. Request a new one.' : err.message);
    } finally {
      this.busy.set(false);
    }
  }
}
