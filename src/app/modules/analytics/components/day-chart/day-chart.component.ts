import { Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

const DAY_MS = 86_400_000;

/**
 * Reports per UTC day as columns, with a table view. Days the API leaves out had no reports (it groups by day),
 * so the chart draws them at zero; the table lists the rows exactly as returned.
 */
@Component({
  selector: 'app-day-chart',
  imports: [MatButtonModule],
  template: `
    <header>
      <h3>{{ title() }}</h3>
      <button mat-button (click)="asTable.set(!asTable())" [attr.aria-pressed]="asTable()">
        {{ asTable() ? 'Show chart' : 'Show table' }}
      </button>
    </header>
    @if (asTable()) {
      <table class="plain">
        <thead>
          <tr><th scope="col">Day (UTC)</th><th scope="col">Reports</th></tr>
        </thead>
        <tbody>
          @for (p of points(); track p.day) {
            <tr><td>{{ p.day }}</td><td>{{ p.count }}</td></tr>
          } @empty {
            <tr><td colspan="2">None in this range</td></tr>
          }
        </tbody>
      </table>
    } @else {
      <div class="plot" role="img" [attr.aria-label]="summary()">
        <span class="max" aria-hidden="true">{{ max() }}</span>
        <div class="cols">
          @for (d of days(); track d.day) {
            <div class="col" [title]="d.day + ': ' + d.count">
              <span class="bar" [style.height.%]="(d.count / max()) * 100"></span>
            </div>
          }
        </div>
        <div class="axis" aria-hidden="true"><span>{{ from() }}</span><span>{{ to() }}</span></div>
      </div>
    }
  `,
  styles: `
    header { display: flex; align-items: center; justify-content: space-between; }
    h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--sf-muted); }
    .plot { position: relative; padding-left: 28px; }
    .max { position: absolute; left: 0; top: 0; font-size: 11px; color: var(--sf-muted); }
    .cols { display: flex; align-items: flex-end; gap: 2px; height: 120px; border-bottom: 1px solid var(--sf-border); }
    .col { flex: 1; height: 100%; display: flex; align-items: flex-end; justify-content: center; min-width: 1px; }
    .col:hover .bar { filter: brightness(0.85); }
    .bar { display: block; width: 100%; max-width: 24px; background: var(--sf-accent); border-radius: 4px 4px 0 0; }
    .axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--sf-muted); margin-top: 4px; }
    table.plain { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.plain th, table.plain td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--sf-border); }
  `,
})
export class DayChartComponent {
  readonly title = input('Reports per day');
  readonly points = input<{ day: string; count: number }[]>([]);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly asTable = signal(false);

  readonly days = computed(() => {
    const byDay = new Map(this.points().map((p) => [p.day, p.count]));
    const start = Date.parse(`${this.from()}T00:00:00Z`);
    const end = Date.parse(`${this.to()}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return this.points();
    const out: { day: string; count: number }[] = [];
    for (let t = start; t <= end; t += DAY_MS) {
      const day = new Date(t).toISOString().slice(0, 10);
      out.push({ day, count: byDay.get(day) ?? 0 });
    }
    return out;
  });
  readonly max = computed(() => Math.max(1, ...this.points().map((p) => p.count)));
  readonly summary = computed(() => {
    const pts = this.points();
    if (!pts.length) return `${this.title()}: none from ${this.from()} to ${this.to()}`;
    const peak = pts.reduce((a, b) => (b.count > a.count ? b : a));
    return `${this.title()} from ${this.from()} to ${this.to()}. Busiest day ${peak.day} with ${peak.count}. Use Show table for every day.`;
  });
}
