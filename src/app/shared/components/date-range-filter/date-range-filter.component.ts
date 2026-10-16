import { Component, computed, input, model } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

/** A table date filter: whole local calendar days, both ends included; null = open-ended. */
export interface DayRange {
  start: Date | null;
  end: Date | null;
}

export const ANY_DAY: DayRange = { start: null, end: null };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Today only (00:00 to 23:59:59 local). */
export function todayRange(now = new Date()): DayRange {
  return { start: startOfDay(now), end: startOfDay(now) };
}

/**
 * Whether an ISO timestamp falls in the range (start day 00:00 ≤ t < the day after `end`, local time). No range =
 * every row. With a range, a row without a date is left out (it can't be shown to be inside it).
 */
export function inDayRange(iso: string | null | undefined, range: DayRange): boolean {
  if (!range.start && !range.end) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range.start && t < startOfDay(range.start).getTime()) return false;
  if (range.end) {
    const end = startOfDay(range.end);
    if (t >= new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime()) return false;
  }
  return true;
}

/**
 * Date range + "Today" shortcut for list tables (owner items 10–12). Calendar only: the fields are read-only and
 * open the picker. Filtering is local over the fully loaded rows, like the table's other filters.
 */
@Component({
  selector: 'app-date-range-filter',
  imports: [MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule],
  providers: [provideNativeDateAdapter()],
  template: `
    <div class="drf" role="group" [attr.aria-label]="label() + ' filter'">
      <mat-form-field subscriptSizing="dynamic" class="range">
        <mat-label>{{ label() }}</mat-label>
        <mat-date-range-input [rangePicker]="picker" [max]="today">
          <input matStartDate readonly placeholder="From" [value]="range().start" (dateChange)="set('start', $event.value)"
            (click)="picker.open()" (keydown.enter)="picker.open()" />
          <input matEndDate readonly placeholder="To" [value]="range().end" (dateChange)="set('end', $event.value)"
            (click)="picker.open()" (keydown.enter)="picker.open()" />
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="picker" aria-label="Open calendar" />
        <mat-date-range-picker #picker />
      </mat-form-field>
      <button mat-stroked-button type="button" class="today" [class.on]="isToday()" [attr.aria-pressed]="isToday()" (click)="showToday()">Today</button>
      @if (active()) {
        <button mat-icon-button type="button" aria-label="Clear date filter" (click)="clear()"><mat-icon>close</mat-icon></button>
      }
    </div>
  `,
  styles: `
    .drf { display: flex; align-items: center; gap: 6px; }
    .range { width: 250px; }
    input[readonly] { cursor: pointer; }
    .today.on { background: var(--sf-accent-soft); border-color: var(--sf-accent); color: var(--sf-accent); }
  `,
})
export class DateRangeFilterComponent {
  /** Field label, e.g. "Submitted". */
  readonly label = input('Date');
  readonly range = model<DayRange>(ANY_DAY);
  readonly today = new Date();
  readonly active = computed(() => !!(this.range().start || this.range().end));
  readonly isToday = computed(() => {
    const r = this.range();
    const t = todayRange().start!.getTime();
    return r.start?.getTime() === t && r.end?.getTime() === t;
  });

  set(part: keyof DayRange, value: Date | null): void {
    this.range.update((r) => ({ ...r, [part]: value }));
  }

  showToday(): void {
    this.range.set(this.isToday() ? ANY_DAY : todayRange());
  }

  clear(): void {
    this.range.set(ANY_DAY);
  }
}
