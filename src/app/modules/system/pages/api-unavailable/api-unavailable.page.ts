import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { safeReturnUrl } from '@app/core/auth/auth.guards';
import { SessionService } from '@app/core/auth/session.service';

/** Stored session could not be verified because the API is unreachable. */
@Component({
  selector: 'app-api-unavailable-page',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './api-unavailable.page.html',
  styleUrl: './api-unavailable.page.scss',
})
export class ApiUnavailablePage {
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);

  async retry(): Promise<void> {
    this.busy.set(true);
    await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    this.busy.set(false);
  }
}
