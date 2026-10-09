import { Injectable, inject } from '@angular/core';
import { ApiService } from '@app/core/http/api.service';
import { User } from '@app/core/models/user.model';

/**
 * Signed-in user's own account. Email and password changes bump CredentialsVersion
 * on the server, which revokes every existing JWT.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(ApiService);

  updateProfile(body: { fullName: string; phone: string; jobTitle: string; departmentOrTrade: string }) {
    return this.api.patch<{ user: User }>('/api/auth/me', body);
  }

  changeUsername(body: { username: string; currentPassword: string }) {
    return this.api.patch<{ user: User }>('/api/auth/me/username', body);
  }

  /** Staff: applied immediately (no OTP), revokes sessions. */
  changeEmail(body: { newEmail: string; currentPassword: string }) {
    return this.api.post('/api/auth/me/change-email', body);
  }

  changePassword(body: { currentPassword: string; newPassword: string }) {
    return this.api.post('/api/auth/me/change-password', body);
  }
}
