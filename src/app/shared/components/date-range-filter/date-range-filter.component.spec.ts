import { TestBed } from '@angular/core/testing';
import { ANY_DAY, DateRangeFilterComponent, inDayRange, todayRange } from './date-range-filter.component';

describe('inDayRange', () => {
  const day = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

  it('includes both whole days and nothing outside them', () => {
    const range = { start: new Date(2026, 9, 10), end: new Date(2026, 9, 12) };
    expect(inDayRange(day(2026, 10, 10, 0, 0), range)).toBe(true);
    expect(inDayRange(day(2026, 10, 12, 23, 59), range)).toBe(true); // end day is included
    expect(inDayRange(day(2026, 10, 9, 23, 59), range)).toBe(false);
    expect(inDayRange(day(2026, 10, 13, 0, 0), range)).toBe(false);
  });

  it('supports open ends; no range means every row; a row without a date is left out of a range', () => {
    expect(inDayRange(day(2020, 1, 1), { start: null, end: new Date(2026, 0, 1) })).toBe(true);
    expect(inDayRange(day(2027, 1, 1), { start: new Date(2026, 0, 1), end: null })).toBe(true);
    expect(inDayRange(null, ANY_DAY)).toBe(true);
    expect(inDayRange(undefined, todayRange())).toBe(false);
    expect(inDayRange('not a date', todayRange())).toBe(false);
  });

  it('Today is the current local day, start to end', () => {
    const now = new Date(2026, 9, 17, 15, 30);
    const r = todayRange(now);
    expect(inDayRange(new Date(2026, 9, 17, 0, 1).toISOString(), r)).toBe(true);
    expect(inDayRange(new Date(2026, 9, 17, 23, 59).toISOString(), r)).toBe(true);
    expect(inDayRange(new Date(2026, 9, 16, 23, 59).toISOString(), r)).toBe(false);
  });
});

describe('DateRangeFilterComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(DateRangeFilterComponent);
    fixture.componentRef.setInput('label', 'Submitted');
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('is calendar-only, labelled, and Today toggles on and off; clear resets', async () => {
    const { fixture, cmp, el } = setup();
    const inputs = [...el.querySelectorAll<HTMLInputElement>('mat-date-range-input input')];
    expect(inputs).toHaveLength(2);
    expect(inputs.every((i) => i.readOnly)).toBe(true);
    expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Submitted filter');
    const today = el.querySelector<HTMLButtonElement>('button.today')!;
    expect(today.getAttribute('aria-pressed')).toBe('false');
    today.click();
    fixture.detectChanges();
    expect(cmp.isToday()).toBe(true);
    expect(today.getAttribute('aria-pressed')).toBe('true');
    const clear = el.querySelector<HTMLButtonElement>('button[aria-label="Clear date filter"]')!;
    clear.click();
    fixture.detectChanges();
    expect(cmp.range()).toEqual(ANY_DAY);
    expect(el.querySelector('button[aria-label="Clear date filter"]')).toBeNull();
    today.click();
    today.click(); // second press turns Today off
    expect(cmp.active()).toBe(false);
  });
});
