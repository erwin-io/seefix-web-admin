import { Component, computed, input } from '@angular/core';
import { TONE_COLOR, Tone } from '../../tones';

/** One server number. Shown exactly as returned; `null` (no data in the range) shows a dash. */
@Component({
  selector: 'app-stat-card',
  template: `
    <div class="stat" [class.alert]="alert() && !!value()">
      <span class="label">{{ label() }}</span>
      <strong class="value" [style.color]="color()">
        @if (value() === null || value() === undefined) {
          <span aria-label="No data">—</span>
        } @else {
          {{ value() }}
          @if (unit()) {
            <small>{{ unit() }}</small>
          }
        }
      </strong>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .stat { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--sf-border);
      border-radius: 10px; background: var(--sf-surface); min-width: 0; height: 100%; box-sizing: border-box; }
    .stat.alert { border-color: var(--sf-danger); }
    .label { color: var(--sf-muted); font-size: 13px; }
    .value { font-size: 24px; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .value small { font-size: 13px; font-weight: 400; color: var(--sf-muted); }
    .hint { color: var(--sf-muted); font-size: 12px; }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<number | null | undefined>(null);
  readonly unit = input('');
  readonly hint = input('');
  /** Outline in the danger colour when the value is non-zero (overdue, failed). */
  readonly alert = input(false);
  /** Value colour when it is non-zero (a zero is never shown as an alarm). The label carries the meaning too. */
  readonly tone = input<Tone | null>(null);
  readonly color = computed(() => {
    const t = this.tone();
    const v = this.value();
    return t && typeof v === 'number' && v > 0 ? TONE_COLOR[t] : null;
  });
}
