import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/http/api.service';

/** Public password-recovery calls (sign-in itself lives in SessionService). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  forgotPassword(email: string) {
    return this.api.post('/api/auth/forgot-password', { email }, { skipAuth: true });
  }

  resetPassword(body: { email: string; code: string; newPassword: string }) {
    return this.api.post('/api/auth/reset-password', body, { skipAuth: true });
  }
}
