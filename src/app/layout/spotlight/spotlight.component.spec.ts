import type { MockInstance } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { SessionService } from '@app/core/auth/session.service';
import { User } from '@app/core/models/user.model';
import { RECENT_PREFIX, RecentSearchesService } from '@app/core/search/recent-searches.service';
import { SearchGroup } from '@app/core/search/search.service';
import { SpotlightLauncherComponent } from './spotlight-launcher.component';
import { SEARCH_DEBOUNCE_MS, SpotlightComponent } from './spotlight.component';

const REPORTS: SearchGroup = {
  type: 'reports',
  label: 'Reports',
  items: [
    { id: 'r1', title: 'RPT-2026-000039', subtitle: 'PENDING_REVIEW · Old Building', route: '/reports/r1' },
    { id: 'r2', title: 'RPT-2026-000040', subtitle: null, route: '/reports/r2' },
  ],
};
const BUILDINGS: SearchGroup = { type: 'buildings', label: 'Buildings', items: [{ id: 'b1', title: 'Old Building', subtitle: 'OB', route: null }] };
const WORK_ORDERS: SearchGroup = { type: 'work_orders', label: 'Work Orders', items: [{ id: 'w1', title: 'WO-1', subtitle: null, route: '/work-orders/w1' }] };

describe('SpotlightComponent', () => {
  let fixture: ComponentFixture<SpotlightComponent>;
  let spot: SpotlightComponent;
  let http: HttpTestingController;
  let navigate: MockInstance<Router['navigateByUrl']>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    TestBed.inject(SessionService).user.set({ id: 'u1', role: 'ADMIN' } as User);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SpotlightComponent);
    spot = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector('input.spot-input') as HTMLInputElement;
  const searches = () => http.match((r) => r.url === '/api/search');
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  }
  function key(k: string): void {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  }
  const respond = (req: TestRequest, groups: SearchGroup[]) => req.flush({ q: req.request.params.get('q'), groups });

  it('is a labelled combobox driving a listbox', async () => {
    await type('stair');
    respond(searches()[0], [REPORTS]);
    await render();
    const box = input();
    expect(box.getAttribute('role')).toBe('combobox');
    expect(box.getAttribute('aria-label')).toContain('Search');
    expect(box.getAttribute('aria-controls')).toBe('spot-list');
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelector('#spot-list')!.getAttribute('role')).toBe('listbox');
    expect(el().querySelector('[role="group"]')!.getAttribute('aria-labelledby')).toBe('spot-g-reports');
    expect(el().querySelector('[role="status"]')!.textContent).toContain('2 results');
  });

  it('keyboard flow: arrows move the active option (wrapping), Enter opens it and remembers the query', async () => {
    await type('  rpt ');
    respond(searches()[0], [REPORTS, WORK_ORDERS]);
    await render();
    expect(input().getAttribute('aria-activedescendant')).toBe('spot-reports-r1');

    key('ArrowDown');
    await render();
    expect(input().getAttribute('aria-activedescendant')).toBe('spot-reports-r2');
    expect(el().querySelector('#spot-reports-r2')!.getAttribute('aria-selected')).toBe('true');
    key('ArrowDown');
    key('ArrowDown'); // wraps to the first
    key('ArrowUp'); // and back to the last
    await render();
    expect(input().getAttribute('aria-activedescendant')).toBe('spot-work_orders-w1');

    key('Enter');
    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/work-orders/w1');
    expect(TestBed.inject(RecentSearchesService).items()).toEqual(['rpt']);
  });

  it('never shows a stale response: a slow older request is cancelled and its late answer ignored', async () => {
    await type('pump');
    const first = searches()[0];
    await type('pump room');
    const pending = searches();
    expect(first.cancelled).toBe(true); // switchMap unsubscribed → HttpClient aborted it
    expect(pending).toHaveLength(1);
    expect(pending[0].request.params.get('q')).toBe('pump room');
    respond(pending[0], [WORK_ORDERS]);
    await render();
    expect(el().textContent).toContain('WO-1');
    expect(el().textContent).not.toContain('RPT-2026-000039');
  });

  it('shows Searching while typing ahead of the debounce instead of the previous query’s results', async () => {
    await type('pump');
    respond(searches()[0], [REPORTS]);
    await render();
    input().value = 'pumpx';
    input().dispatchEvent(new Event('input'));
    await render();
    expect(el().textContent).not.toContain('RPT-2026-000039');
    expect(el().querySelector('[role="status"]')!.textContent).toContain('Searching');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    respond(searches()[0], []);
    await render();
    expect(el().textContent).toContain('No results for “pumpx”');
  });

  it('debounces typing into one request and sends nothing below 2 characters', async () => {
    for (const t of ['s', 'st', 'sta']) {
      input().value = t;
      input().dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    const reqs = searches();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.params.get('q')).toBe('sta');
    respond(reqs[0], []);

    await type(' a ');
    expect(searches()).toHaveLength(0);
    await render();
    expect(el().textContent).toContain('Type at least 2 characters');
  });

  it('sends injection-like text verbatim as a single encoded query parameter', async () => {
    const nasty = `'; DROP TABLE "Reports"; -- %_\\ <script>&types=users`;
    await type(nasty);
    const req = searches()[0];
    expect(req.request.method).toBe('GET');
    expect(req.request.url).toBe('/api/search');
    expect(req.request.params.get('q')).toBe(nasty);
    expect(req.request.params.get('types')).toBeNull();
    expect(req.request.urlWithParams).not.toContain('<script>');
    respond(req, []);
    await render();
    expect(el().querySelector('script')).toBeNull();
    expect(el().textContent).toContain('No results for');
  });

  it('renders null-route items as non-navigable and skips them in keyboard selection; never follows unsafe routes', async () => {
    await type('old');
    const evil: SearchGroup = { type: 'users', label: 'Users', items: [{ id: 'x', title: 'Evil', subtitle: null, route: '//evil.example' }] };
    respond(searches()[0], [BUILDINGS, evil, REPORTS]);
    await render();
    const building = el().querySelector('#spot-buildings-b1')!;
    expect(building.getAttribute('aria-disabled')).toBe('true');
    expect(building.textContent).toContain('No detail page');
    expect(input().getAttribute('aria-activedescendant')).toBe('spot-reports-r1');
    (building as HTMLElement).click();
    (el().querySelector('#spot-users-x') as HTMLElement).click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows API errors with a retry, and recovers', async () => {
    await type('stair');
    searches()[0].flush({ error: { code: 'RATE_LIMITED', message: 'Too many searches. Try again in a minute.' } }, { status: 429, statusText: 'Too Many' });
    await render();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('Too many searches');

    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Try again')) as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    respond(searches()[0], [REPORTS]);
    await render();
    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(el().textContent).toContain('RPT-2026-000039');

    await type('offline');
    searches()[0].error(new ProgressEvent('error'), { status: 0 });
    await render();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('offline');
  });

  it('blank input lists recent queries: Enter reruns one, Delete or × removes one, Clear all empties', async () => {
    const recents = TestBed.inject(RecentSearchesService);
    ['pump', 'stair', 'roof'].forEach((q) => recents.add(q));
    await render();
    const rows = () => Array.from(el().querySelectorAll('[role="option"] .title')).map((o) => o.textContent?.trim());
    expect(rows()).toEqual(['roof', 'stair', 'pump']);

    key('ArrowDown');
    key('Delete');
    await render();
    expect(rows()).toEqual(['roof', 'pump']);

    (el().querySelector('button[aria-label="Remove pump from recent searches"]') as HTMLButtonElement).click();
    await render();
    expect(rows()).toEqual(['roof']);

    key('Enter');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(spot.query()).toBe('roof');
    respond(searches()[0], []);

    await type('');
    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Clear all')) as HTMLButtonElement).click();
    await render();
    expect(rows()).toEqual([]);
    expect(localStorage.getItem(RECENT_PREFIX + 'u1')).toBeNull();
  });
});

describe('SpotlightLauncherComponent', () => {
  it('opens one overlay on Ctrl+K or Cmd+K, and ignores other shortcuts', () => {
    const afterClosed = { subscribe: vi.fn() };
    const open = vi.fn().mockReturnValue({ afterClosed: () => afterClosed });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: MatDialog, useValue: { open } }],
    });
    const fixture = TestBed.createComponent(SpotlightLauncherComponent);
    fixture.detectChanges();
    const press = (init: KeyboardEventInit) => {
      const e = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init });
      document.dispatchEvent(e);
      return e;
    };

    expect(press({ key: 'k' }).defaultPrevented).toBe(false);
    expect(press({ key: 'k', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();

    expect(press({ key: 'k', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith(SpotlightComponent, expect.objectContaining({ autoFocus: 'input.spot-input', restoreFocus: true }));
    press({ key: 'K', metaKey: true }); // already open: not a second overlay
    expect(open).toHaveBeenCalledTimes(1);

    afterClosed.subscribe.mock.calls[0][0](); // overlay closed
    press({ key: 'K', metaKey: true });
    expect(open).toHaveBeenCalledTimes(2);

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toContain('Search');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });
});
