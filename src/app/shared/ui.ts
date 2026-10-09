import { Component, Pipe, PipeTransform, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** PENDING_REVIEW -> Pending review */
export function humanize(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Pipe({ name: 'humanize' })
export class HumanizePipe implements PipeTransform {
  transform = humanize;
}

const TONE: Record<string, string> = {
  // Report
  SUBMITTED: 'info', PENDING_REVIEW: 'warn', ROUTED_INTERNAL: 'info', PROCUREMENT: 'violet',
  NEEDS_INFORMATION: 'warn', RESOLVED: 'ok', NO_ACTION: 'muted', DUPLICATE: 'muted', CANCELLED: 'muted',
  // Work order
  PENDING_ASSIGNMENT: 'warn', ASSIGNED: 'info', IN_PROGRESS: 'info', PENDING_PARTS: 'warn', ON_HOLD: 'warn',
  COMPLETION_SUBMITTED: 'violet', REWORK_REQUIRED: 'danger', COMPLETED: 'ok',
  // Handoff / clarification / agent
  ACKNOWLEDGED: 'info', IN_PROCESS: 'info', CLARIFICATION_REQUIRED: 'danger', OPEN: 'warn', ANSWERED: 'ok',
  PENDING: 'warn', PROCESSING: 'info', FAILED: 'danger',
  // Urgency
  Low: 'muted', Medium: 'info', High: 'warn', Critical: 'danger',
};

@Component({
  selector: 'app-chip',
  template: `<span class="chip" [class]="'chip tone-' + tone()">{{ text() }}</span>`,
})
export class ChipComponent {
  readonly value = input<string | null | undefined>();
  readonly tone = computed(() => TONE[this.value() ?? ''] ?? 'muted');
  readonly text = computed(() => humanize(this.value()));
}

/** Priority score 0-100 from the API; null means not assessed (not zero). */
@Component({
  selector: 'app-priority',
  template: `
    @if (score() === null || score() === undefined) {
      <span class="priority none" title="Not assessed">N/A</span>
    } @else {
      <span class="priority" [class]="'priority ' + band()" [title]="'Priority score ' + score()">{{ score() }}</span>
    }
  `,
})
export class PriorityComponent {
  readonly score = input<number | null | undefined>();
  readonly band = computed(() => {
    const s = Number(this.score());
    return s >= 75 ? 'p-critical' : s >= 50 ? 'p-high' : s >= 25 ? 'p-medium' : 'p-low';
  });
}

/** Loading / error / empty placeholder for a page or panel. */
@Component({
  selector: 'app-state',
  imports: [MatProgressSpinnerModule, MatButtonModule, MatIconModule],
  template: `
    @if (loading()) {
      <div class="state"><mat-spinner diameter="36" /></div>
    } @else if (error()) {
      <div class="state" role="alert">
        <mat-icon class="state-icon error">error_outline</mat-icon>
        <p>{{ error() }}</p>
        <button mat-stroked-button (click)="retry.emit()">Retry</button>
      </div>
    } @else if (empty()) {
      <div class="state">
        <mat-icon class="state-icon">{{ icon() }}</mat-icon>
        <p>{{ empty() }}</p>
      </div>
    }
  `,
})
export class StateComponent {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Message shown when there is nothing to list. Falsy = has data. */
  readonly empty = input<string | null>(null);
  readonly icon = input('inbox');
  readonly retry = output();
}

/** Evidence thumbnails; opens the Cloudinary URL from the API in a new tab. */
@Component({
  selector: 'app-gallery',
  imports: [MatIconModule],
  template: `
    @if (urls().length) {
      <div class="gallery">
        @for (src of urls(); track src) {
          <a [href]="src" target="_blank" rel="noopener" class="thumb"><img [src]="src" alt="Evidence photo" loading="lazy" /></a>
        }
      </div>
    } @else {
      <p class="muted"><mat-icon inline>image_not_supported</mat-icon> No photos</p>
    }
  `,
})
export class GalleryComponent {
  readonly urls = input<string[]>([]);
}

export const SHARED = [HumanizePipe, ChipComponent, PriorityComponent, StateComponent, GalleryComponent];

/** Router link for a workflow entity (notifications, action items). */
export function entityLink(type: string | null, id: string | null, payload?: Record<string, unknown> | null): string | null {
  if (!id) return null;
  switch (type) {
    case 'REPORT':
      return `/reports/${id}`;
    case 'WORK_ORDER':
      return `/work-orders/${id}`;
    case 'PROCUREMENT_HANDOFF':
      return `/procurement/handoffs/${id}`;
    case 'PROCUREMENT_CLARIFICATION':
      return payload?.['handoffId'] ? `/procurement/handoffs/${payload['handoffId']}` : null;
    default:
      return null;
  }
}
