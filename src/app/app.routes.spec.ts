import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { SessionService } from './core/auth/session.service';

// Regression: `/` used to resolve to an empty auth route group (blank page) and guestGuard threw NG0203.
describe('app routes', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('sends a signed-out visitor from / to /login', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fdashboard');
  });

  it('opens the dashboard for a signed-in staff user', async () => {
    TestBed.inject(SessionService).user.set({ id: 'a', role: 'ADMIN', fullName: 'Ada Admin' } as never);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('redirects a signed-in user away from /login', async () => {
    TestBed.inject(SessionService).user.set({ id: 'w', role: 'WORKER', fullName: 'Wes Worker' } as never);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });
});
