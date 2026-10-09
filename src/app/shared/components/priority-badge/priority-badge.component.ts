import { Component, computed, input } from '@angular/core';

/** Priority score 0-100 from the API; null means not assessed (not zero). */
@Component({
  selector: 'app-priority-badge',
  templateUrl: './priority-badge.component.html',
  styleUrl: './priority-badge.component.scss',
})
export class PriorityBadgeComponent {
  readonly score = input<number | null | undefined>();
  readonly assessed = computed(() => this.score() !== null && this.score() !== undefined);
  readonly band = computed(() => {
    const s = Number(this.score());
    return s >= 75 ? 'p-critical' : s >= 50 ? 'p-high' : s >= 25 ? 'p-medium' : 'p-low';
  });
}
