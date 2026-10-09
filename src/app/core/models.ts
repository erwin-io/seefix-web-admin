/**
 * Response shapes from seefix-api. Field casing mirrors the API: list endpoints
 * alias to camelCase, detail endpoints return raw PascalCase DB rows.
 */

export type Role =
  | 'REPORTER'
  | 'MAINTENANCE_STAFF'
  | 'MAINTENANCE_SUPERVISOR'
  | 'PROCUREMENT'
  | 'WORKER'
  | 'ADMIN';

export const STAFF_ROLES: Role[] = ['ADMIN', 'MAINTENANCE_STAFF', 'MAINTENANCE_SUPERVISOR', 'PROCUREMENT', 'WORKER'];
export const MAINTENANCE: Role[] = ['MAINTENANCE_STAFF', 'MAINTENANCE_SUPERVISOR', 'ADMIN'];
export const SUPERVISOR: Role[] = ['MAINTENANCE_SUPERVISOR', 'ADMIN'];
export const PROCUREMENT_ACTORS: Role[] = ['PROCUREMENT', 'ADMIN'];
export const PROCUREMENT_READERS: Role[] = ['PROCUREMENT', ...MAINTENANCE];
export const WORK_ROLES: Role[] = [...MAINTENANCE, 'WORKER'];

export const ROLE_LABEL: Record<Role, string> = {
  REPORTER: 'Reporter',
  MAINTENANCE_STAFF: 'Maintenance Staff',
  MAINTENANCE_SUPERVISOR: 'Maintenance Supervisor',
  PROCUREMENT: 'Procurement',
  WORKER: 'Worker',
  ADMIN: 'Admin',
};

export interface User {
  id: string;
  institutionalId: string | null;
  fullName: string;
  username: string | null;
  email: string;
  role: Role;
  jobTitle: string | null;
  departmentOrTrade: string | null;
  phone: string | null;
  isActive: boolean;
  emailVerified?: boolean;
  emailVerificationRequired?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Items<T> {
  items: T[];
}

export interface Screening {
  code: string;
  title: string;
  message: string;
  nextAction: string;
  source: string;
  needsMaintenanceReview: boolean;
  isActionable: boolean;
}

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

/** GET /api/reports/:id â€” nested rows are raw DB columns. */
export interface ReportDetail {
  report: Row & { screening: Screening; canCancel: boolean };
  images: { id: string; secureUrl: string; isPrimary: boolean; width: number; height: number; createdAt: string }[];
  maintenanceRequest: Row | null;
  maintenanceReview: Row | null;
  procurementHandoff: Row | null;
  workOrder: Row | null;
  duplicateCandidates: Row[];
  statusHistory: { ReportId: string; CreatedAt: string; StatusType: string; OldStatus: string | null; NewStatus: string; ChangedBy: string | null; Reason: string | null }[];
}

export type Decision = 'INTERNAL' | 'PROCUREMENT' | 'NO_ACTION' | 'DUPLICATE';
export const URGENCIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export interface WorkOrderItem {
  id: string;
  workOrderNo: string;
  status: string;
  assignedPartyName: string | null;
  responsibleLeadName: string | null;
  plannedStartAt: string | null;
  deadline: string | null;
  completionAgentStatus: string | null;
  reportNo: string;
  requestNo: string;
}

export interface WorkOrderDetail {
  workOrder: Row;
  assignments: Row[];
  people: Row[];
  materials: Row[];
  images: Row[];
  updates: Row[];
}

export interface AssignableUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  departmentOrTrade: string | null;
  phone: string | null;
}

export interface ProcurementInboxItem {
  HandoffId: string;
  HandoffNo: string;
  Status: string;
  SubmittedAt: string;
  AcknowledgedAt: string | null;
  ExpectedResponseAt: string | null;
  NextFollowUpAt: string | null;
  ExternalSystemReference: string | null;
  RequestNo: string;
  EffectiveCategory: string | null;
  EffectiveUrgency: string | null;
  RequiredService: string | null;
  ScopeOfWork: string | null;
  ReportId: string;
  ReportNo: string;
  LivePriorityScore: number | null;
}

export interface HandoffDetail {
  handoff: Row;
  clarifications: Row[];
  documents: Row[];
  outcome: Row | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  defaultUrgency: string | null;
  urgencyGuidance: string | null;
  defaultMinHours: number | null;
  defaultMaxHours: number | null;
  defaultRequiredService: string | null;
  defaultRequiredCapability: string | null;
  safetyGuidance: string | null;
  preferredTrade: string | null;
  requiresMaintenanceReview: boolean;
  isActive: boolean;
  sortOrder: number;
}

// Raw PascalCase DB row. Kept loose on purpose: the API returns `SELECT *`.
export type Row = Record<string, any>;
