import { Role } from '@app/core/models/user.model';

/** seefix-api docs/V2_ASSISTANT.md (seefix-api#21). The API is authoritative for every rule below. */

export type RecordType = 'report' | 'work_order' | 'handoff';

export interface RecordContext {
  type: RecordType;
  id: string;
}

export interface NavTarget {
  path: string;
  label: string;
}

/** `GET /api/assistant/tools` */
export interface ToolCatalog {
  role: string;
  tools: string[];
  actions: { allowed: string[]; prohibited: string[] };
  navigation: NavTarget[];
}

/** `POST /api/assistant/ask` (the Agent's shape after the API re-checked it against its own facts). */
export interface AskResponse {
  status: 'ANSWERED' | 'NO_FACTS' | 'FALLBACK';
  answer: string;
  citedFactIds: string[];
  navigation: { factId: string; path: string; label: string }[];
  fallbackReason?: string | null;
  processingTimeMs?: number;
}

/** `GET /api/assistant/tools/action-queue` item: a hint, not a decision. */
export interface QueueItem {
  entityType: string;
  entityId: string;
  action: string;
  reference: string | null;
  summary: string | null;
  priority: number | null;
  since: string | null;
  dueAt?: string | null;
  route: string;
}

export interface RecordFact {
  id: string;
  kind: RecordType;
  label: string;
  navigation: string;
  data: Record<string, unknown>;
}

export type DraftKind = 'REVIEW_NOTE' | 'WORK_ORDER_UPDATE' | 'CLARIFICATION_REPLY';

export interface Draft {
  id: string;
  kind: DraftKind;
  entityType: string;
  entityId: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'CANCELLED' | 'FAILED';

export interface Reminder {
  id: string;
  createdBy: string;
  recipientUserId: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  dueAt: string;
  timeZone: string;
  status: ReminderStatus;
  sentAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export type JobStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'SUPERSEDED';

export interface ReassessmentJob {
  id: string;
  reportId: string;
  status: JobStatus;
  reason: string;
  requestedBy: string;
  attemptCount: number;
  baseAgentAttempt: number | null;
  createdAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
}

export interface AssessmentAttempt {
  attempt: number;
  scopeDecision: string | null;
  category: string | null;
  urgency: string | null;
  priorityScore: number | null;
  createdAt: string;
}

export interface ReassessmentHistory {
  reportId: string;
  jobs: ReassessmentJob[];
  assessments: AssessmentAttempt[];
}

/** Every assistant write: preview first (`confirm` absent), then `confirm: true`. */
export type ActionResult<T> =
  | { status: 'CONFIRMATION_REQUIRED'; action: string; preview: string }
  | ({ status: 'DONE'; action: string } & T);

export const ACTIVE_JOB: JobStatus[] = ['PENDING', 'PROCESSING'];
export const MAX_REASSESSMENTS = 5;

/** Which draft kind belongs to a record, and who may write it (mirrors DRAFT_KINDS in the API). */
export const DRAFT_KIND: Record<RecordType, { kind: DraftKind; label: string; roles: Role[] }> = {
  report: {
    kind: 'REVIEW_NOTE',
    label: 'review note',
    roles: ['ADMIN', 'MAINTENANCE_SUPERVISOR', 'MAINTENANCE_STAFF'],
  },
  work_order: {
    kind: 'WORK_ORDER_UPDATE',
    label: 'work order update',
    roles: ['ADMIN', 'MAINTENANCE_SUPERVISOR', 'MAINTENANCE_STAFF', 'WORKER'],
  },
  handoff: {
    kind: 'CLARIFICATION_REPLY',
    label: 'clarification reply',
    roles: ['PROCUREMENT', 'ADMIN', 'MAINTENANCE_SUPERVISOR', 'MAINTENANCE_STAFF'],
  },
};
