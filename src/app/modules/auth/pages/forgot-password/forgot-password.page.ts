import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { toAppError } from '@app/core/http/app-error';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.scss',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
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
      await firstValueFrom(this.auth.forgotPassword(email));
      await this.router.navigate(['/reset-password'], { state: { email } });
    } catch (e) {
      this.error.set(toAppError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
