import { Role } from '@app/core/models/user.model';
import { Row } from '@app/core/models/api.model';

/** Presentation-only screening card from seefix-api report-presentation.js. */
export interface Screening {
  code: string;
  title: string;
  message: string;
  nextAction: string;
  source: string;
  needsMaintenanceReview: boolean;
  isActionable: boolean;
}

export type Triage = 'all' | 'actionable' | 'screening';
export type Decision = 'INTERNAL' | 'PROCUREMENT' | 'NO_ACTION' | 'DUPLICATE';
export const URGENCIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export const REPORT_STATUSES = [
  'SUBMITTED', 'PENDING_REVIEW', 'ROUTED_INTERNAL', 'PROCUREMENT', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS',
  'PENDING_PARTS', 'ON_HOLD', 'COMPLETION_SUBMITTED', 'REWORK_REQUIRED', 'RESOLVED', 'NEEDS_INFORMATION',
  'NO_ACTION', 'DUPLICATE', 'CANCELLED',
];

/** v_MaintenanceActionCenter */
export interface ActionItem {
  EntityType: string;
  EntityId: string;
  ActionType: string;
  AssignedRole: Role;
  PriorityScore: number | null;
  ActionCreatedAt: string;
  ReferenceNo: string | null;
  Summary: string | null;
}

/** v_MaintenanceReviewQueue + screening */
export interface ReviewQueueItem {
  ReportId: string;
  ReportNo: string;
  EffectiveCategory: string | null;
  EffectiveUrgency: string | null;
  LivePriorityScore: number | null;
  AiSummary: string | null;
  Building: string | null;
  Floor: string | null;
  RoomOrArea: string | null;
  CreatedAt: string;
  MaintenanceRequestId: string | null;
  RequestNo: string | null;
  MaintenanceReviewId: string | null;
  ReviewStatus: string | null;
  screening: Screening;
}

/** GET /api/maintenance/reports */
export interface MaintenanceReportItem {
  id: string;
  reportNo: string;
  status: string;
  agentStatus: string;
  scopeDecision: string | null;
  effectiveCategory: string | null;
  effectiveUrgency: string | null;
  priorityScore: number | null;
  recurrenceCount: number | null;
  verificationCount: number | null;
  aiNeedsReview: boolean | null;
  building: string | null;
  floor: string | null;
  roomOrArea: string | null;
  createdAt: string;
  screening: Screening;
}

export interface ReportImage {
  id: string;
  secureUrl: string;
  isPrimary: boolean;
  width: number;
  height: number;
  createdAt: string;
}

export interface ReportTimelineEntry {
  ReportId: string;
  CreatedAt: string;
  StatusType: string;
  OldStatus: string | null;
  NewStatus: string;
  ChangedBy: string | null;
  Reason: string | null;
}

/** GET /api/reports/:id. Nested records are raw DB rows. */
export interface ReportDetail {
  report: Row & { screening: Screening; canCancel: boolean };
  images: ReportImage[];
  maintenanceRequest: Row | null;
  maintenanceReview: Row | null;
  procurementHandoff: Row | null;
  workOrder: Row | null;
  duplicateCandidates: Row[];
  statusHistory: ReportTimelineEntry[];
}

export interface CategoryRef {
  code: string;
  name: string;
  defaultUrgency: string | null;
}

export interface ReviewResult {
  reportId: string;
  reportNo: string;
  maintenanceRequestId: string | null;
  maintenanceReview: Row;
  nextStep: { type: 'NONE' | 'WORK_ORDER' | 'PROCUREMENT_HANDOFF'; automatic: boolean };
}
