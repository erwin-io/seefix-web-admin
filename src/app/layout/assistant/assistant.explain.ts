import { AppError, toAppError } from '@app/core/http/app-error';
import { JobStatus, ReminderStatus } from './assistant.model';

/** Plain-language reasons for the API's assistant error codes (docs/V2_ASSISTANT.md §3–§5). */
const BY_CODE: Record<string, string> = {
  ASSISTANT_ACTION_PROHIBITED:
    'The assistant cannot make workflow decisions. Review, routing, work order authorization, completion, rework and procurement stay on their normal screens.',
  REPORT_NOT_FOUND: 'This report no longer exists or you no longer have access to it.',
  REPORT_NOT_REASSESSABLE:
    'Only a report waiting for Maintenance Review with a completed AI assessment can be reassessed. This report has moved on (reviewed, cancelled or sent back for rework).',
  HUMAN_DECISION_EXISTS:
    'A person has already recorded a review decision for this report, so a new AI assessment would not be used.',
  REASSESSMENT_IN_PROGRESS:
    'A reassessment is already queued or running for this report. Wait for it to finish or cancel it first.',
  REASSESSMENT_LIMIT_REACHED: 'This report has reached the limit of 5 reassessments.',
  REASSESSMENT_FINISHED:
    'This reassessment has already finished, so it can no longer be cancelled.',
  REASSESSMENT_NOT_FOUND: 'This reassessment no longer exists.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already used for another report. Please try again.',
  REMINDER_RECIPIENT_FORBIDDEN: 'You cannot set a reminder for that person.',
  REMINDER_ENTITY_FORBIDDEN:
    'This record cannot be attached to the reminder because the recipient cannot open it.',
  REMINDER_LIMIT_REACHED: 'You already have 50 active reminders. Cancel one before adding another.',
  REMINDER_ALREADY_SENT: 'This reminder was already sent, so it can no longer be cancelled.',
  INVALID_DUE_AT: 'Pick a time in the future, within one year.',
  INVALID_TIME_ZONE: 'Your time zone was not recognized. Please choose another time.',
  RATE_LIMITED: "You've sent a lot of requests. Please wait a little and try again.",
  SCHEMA_NOT_READY: "The assistant isn't available on this server yet.",
};

/** A message that is always safe to show (never a raw server error, URL or stack). */
export function explain(e: unknown): string {
  const err: AppError = toAppError(e);
  if (err.code && BY_CODE[err.code]) return BY_CODE[err.code];
  return err.message;
}

export const JOB_STATUS: Record<JobStatus, { label: string; detail: string }> = {
  PENDING: {
    label: 'Queued',
    detail: 'Waiting for the AI. The current assessment stays reviewable meanwhile.',
  },
  PROCESSING: {
    label: 'Processing',
    detail: 'The AI is preparing a new assessment. The current one stays reviewable meanwhile.',
  },
  COMPLETED: {
    label: 'Completed',
    detail: 'A new assessment was saved. Earlier attempts are kept in the history.',
  },
  FAILED: {
    label: 'Failed',
    detail: 'The AI could not finish. The current assessment was not changed.',
  },
  CANCELLED: {
    label: 'Cancelled',
    detail: 'A person cancelled this request. Nothing was changed.',
  },
  SUPERSEDED: {
    label: 'Superseded',
    detail:
      'A human decision was made first (review, cancellation or rework), so this result was discarded. Human decisions always win.',
  },
};

export const REMINDER_STATUS: Record<ReminderStatus, string> = {
  SCHEDULED: 'Scheduled',
  PROCESSING: 'Sending',
  SENT: 'Sent',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};
