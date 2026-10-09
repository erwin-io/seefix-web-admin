import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { safeReturnUrl } from '../core/guards';
import { Session } from '../core/session';

@Component({
  selector: 'app-denied-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="card state">
      <mat-icon class="state-icon error">lock</mat-icon>
      <h2>Access denied</h2>
      <p>Your role does not have access to this page.</p>
      <a mat-flat-button routerLink="/dashboard">Go to dashboard</a>
    </div>
  `,
})
export class DeniedPage {}

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="card state">
      <mat-icon class="state-icon">travel_explore</mat-icon>
      <h2>Page not found</h2>
      <a mat-flat-button routerLink="/dashboard">Go to dashboard</a>
    </div>
  `,
})
export class NotFoundPage {}

/** Stored session could not be verified because the API is unreachable. */
@Component({
  selector: 'app-unavailable-page',
  imports: [MatButtonModule, MatIconModule],
  styles: ':host { display: grid; place-items: center; min-height: 100vh; padding: 16px; }',
  template: `
    <div class="card state" style="max-width: 440px">
      <mat-icon class="state-icon error">cloud_off</mat-icon>
      <h2>Can't reach SEEFIX</h2>
      <p>The API is unreachable. Check your connection or try again shortly.</p>
      <button mat-flat-button (click)="retry()" [disabled]="busy()">Retry</button>
      <button mat-button (click)="session.end()">Sign out</button>
    </div>
  `,
})
export class UnavailablePage {
  readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);

  async retry(): Promise<void> {
    this.busy.set(true);
    await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    this.busy.set(false);
  }
}
