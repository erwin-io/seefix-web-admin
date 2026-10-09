import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { toAppError } from '@app/core/http/app-error';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
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
      await firstValueFrom(this.auth.resetPassword({ ...v, email: v.email.trim().toLowerCase() }));
      this.session.notice.set('Password updated. Sign in with your new password.');
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (e) {
      const err = toAppError(e);
      // RESET_INVALID (unknown email) must read like a wrong code: no account enumeration.
      this.error.set(
        ['RESET_INVALID', 'OTP_INVALID', 'OTP_EXPIRED'].includes(err.code ?? '') ? 'The code is invalid or expired. Request a new one.' : err.message,
      );
    } finally {
      this.busy.set(false);
    }
  }
}
