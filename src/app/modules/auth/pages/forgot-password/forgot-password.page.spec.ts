import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('"Send code" posts the email to the API instead of reloading the page', async () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;

    const input = el.querySelector('input[type="email"]') as HTMLInputElement;
    input.value = '  Worker.B@Example.test ';
    input.dispatchEvent(new Event('input'));

    // A native (un-handled) form submit would be cancelable and not prevented; Angular's FormGroupDirective prevents it.
    const event = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    const req = http.expectOne('/api/auth/forgot-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'worker.b@example.test' });
    req.flush({});
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/reset-password'], { state: { email: 'worker.b@example.test' } });
  });

  it('does not call the API for an invalid email', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectNone('/api/auth/forgot-password');
  });
});
