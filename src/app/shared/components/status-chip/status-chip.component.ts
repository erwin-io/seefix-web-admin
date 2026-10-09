import { Component, computed, input } from '@angular/core';
import { humanize } from '../../pipes/humanize.pipe';

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
  // Account
  ACTIVE: 'ok', INACTIVE: 'muted',
};

@Component({
  selector: 'app-status-chip',
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss',
})
export class StatusChipComponent {
  readonly value = input<string | null | undefined>();
  readonly tone = computed(() => TONE[this.value() ?? ''] ?? 'muted');
  readonly text = computed(() => humanize(this.value()));
}
