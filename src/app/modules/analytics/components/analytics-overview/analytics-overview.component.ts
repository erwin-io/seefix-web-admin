import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CacheSyncService } from '@app/core/data/cache-sync.service';
import { DatasetStore } from '@app/core/data/dataset.store';
import { PageStateComponent } from '@app/shared/components/page-state/page-state.component';
import { DateRange } from '../../analytics.models';
import { AnalyticsService, lastDays, rangeError } from '../../analytics.service';
import { BarListComponent } from '../bar-list/bar-list.component';
import { DayChartComponent } from '../day-chart/day-chart.component';
import { StatCardComponent } from '../stat-card/stat-card.component';
import { chartTone } from '../../tones';

export const PRESETS = [7, 30, 90] as const;

/**
 * Analytics from `GET /api/analytics/overview`. Shows exactly the sections the API returns for the caller's role
 * (it never asks for or derives the others) and every number as returned.
 */
@Component({
  selector: 'app-analytics-overview',
  imports: [
    DatePipe, MatButtonModule, MatButtonToggleModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, PageStateComponent, StatCardComponent, BarListComponent, DayChartComponent,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './analytics-overview.component.html',
  styleUrl: './analytics-overview.component.scss',
})
export class AnalyticsOverviewComponent {
  private readonly analytics = inject(AnalyticsService);
  readonly sync = inject(CacheSyncService);
  readonly presets = PRESETS;
  readonly chartTone = chartTone;
  /** Ranges end today at the latest (the API's range is UTC calendar days). */
  readonly today = new Date();
  readonly data = this.analytics.overview();
  readonly overview = computed(() => this.data.rows()[0] ?? null);
  readonly sections = computed(() => this.overview()?.sections ?? {});
  /** The inputs; applied (and sent) only when valid. */
  readonly draft = signal<DateRange>(this.analytics.range());
  readonly draftError = computed(() => rangeError(this.draft()));
  readonly preset = computed(() => PRESETS.find((d) => sameRange(lastDays(d), this.analytics.range())) ?? null);

  constructor() {
    this.data.attach(inject(DestroyRef));
    void this.data.ensure();
    inject(DatasetStore).onActivity();
  }

  usePreset(days: number): void {
    this.apply(lastDays(days));
  }

  /** 'YYYY-MM-DD' ↔ the picker's local calendar date (no time-zone shift: both are plain calendar days). */
  asDate(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  iso(d: Date | null): string {
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  }

  setDraft(part: keyof DateRange, value: string): void {
    this.draft.update((r) => ({ ...r, [part]: value }));
  }

  applyDraft(): void {
    if (!this.draftError()) this.apply(this.draft());
  }

  private apply(range: DateRange): void {
    this.draft.set(range);
    if (!sameRange(range, this.analytics.range()) || this.data.error()) this.analytics.setRange(range);
  }
}

function sameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}
