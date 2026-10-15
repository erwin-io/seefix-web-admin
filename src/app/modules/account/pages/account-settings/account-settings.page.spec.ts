import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AccountSettingsPage } from './account-settings.page';

describe('AccountSettingsPage errors', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccountSettingsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function fail(save: () => Promise<void>, url: string, status: number, code: string, message: string) {
    const done = save();
    http.expectOne(url).flush({ error: { code, message } }, { status, statusText: 'Error' });
    await done;
  }

  it('puts API errors on the field they concern, and shows them under it', async () => {
    const fixture = TestBed.createComponent(AccountSettingsPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.username.setValue({ username: 'worker.b', currentPassword: 'wrong-pass' });

    await fail(() => page.saveUsername(), '/api/auth/me/username', 401, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
    expect(page.username.controls.currentPassword.errors).toEqual({ server: 'Current password is incorrect.' });
    expect(page.username.controls.username.errors).toBeNull();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Current password is incorrect.');

    page.username.controls.currentPassword.setValue('right-pass'); // retyping clears the API error
    await fail(() => page.saveUsername(), '/api/auth/me/username', 409, 'USERNAME_IN_USE', 'Username is already in use.');
    expect(page.errorText(page.username.controls.username, 'Username')).toBe('Username is already in use.');

    // Editing the field clears the API error.
    page.username.controls.username.setValue('worker.c');
    expect(page.username.controls.username.errors).toBeNull();
  });

  it('marks every field when the API error is not tied to one field', async () => {
    const page = TestBed.createComponent(AccountSettingsPage).componentInstance;
    page.profile.setValue({ fullName: 'Worker B', phone: '', jobTitle: '', departmentOrTrade: '' });

    await fail(() => page.saveProfile(), '/api/auth/me', 400, 'VALIDATION_ERROR', 'No editable profile fields supplied.');
    for (const control of Object.values(page.profile.controls)) {
      expect(control.errors?.['server']).toBe('No editable profile fields supplied.');
      expect(control.touched).toBe(true);
    }
  });

  it('explains frontend validation per field', () => {
    const page = TestBed.createComponent(AccountSettingsPage).componentInstance;
    page.password.setValue({ currentPassword: '', newPassword: 'short' });
    expect(page.errorText(page.password.controls.currentPassword, 'Current password')).toBe('Current password is required.');
    expect(page.errorText(page.password.controls.newPassword, 'New password')).toBe('New password must be at least 8 characters.');
  });
});
