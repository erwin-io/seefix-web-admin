import { Component, computed, input } from '@angular/core';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';
import { Counts } from '../../analytics.models';

/**
 * A breakdown (status → count) as horizontal bars, biggest first. The counts are printed as returned; the bar
 * length is only their share of the largest value (decoration, hidden from screen readers).
 */
@Component({
  selector: 'app-bar-list',
  imports: [HumanizePipe],
  template: `
    <h3>{{ title() }}</h3>
    @if (rows().length) {
      <ul [attr.aria-label]="title()">
        @for (r of rows(); track r.key) {
          <li [title]="(r.key | humanize) + ': ' + r.value">
            <span class="name">{{ r.key | humanize }}</span>
            <span class="track" aria-hidden="true"><span class="bar" [style.width.%]="r.pct"></span></span>
            <span class="num">{{ r.value }}</span>
          </li>
        }
      </ul>
    } @else {
      <p class="none">None in this range</p>
    }
  `,
  styles: `
    h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--sf-muted); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: grid; grid-template-columns: minmax(90px, 40%) 1fr auto; gap: 8px; align-items: center; font-size: 13px; }
    li:hover .bar { filter: brightness(0.85); }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 10px; }
    .bar { display: block; height: 100%; min-width: 2px; background: var(--sf-accent); border-radius: 0 4px 4px 0; }
    .num { font-variant-numeric: tabular-nums; min-width: 2ch; text-align: right; }
    .none { color: var(--sf-muted); font-size: 13px; margin: 0; }
  `,
})
export class BarListComponent {
  readonly title = input.required<string>();
  readonly counts = input<Counts | null | undefined>(null);
  readonly rows = computed(() => {
    const entries = Object.entries(this.counts() ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return entries.map(([key, value]) => ({ key, value, pct: (value / max) * 100 }));
  });
}
