import { Row } from '@app/core/models/api.model';
import { Role } from '@app/core/models/user.model';

export const WORK_ORDER_STATUSES = [
  'PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'ON_HOLD', 'COMPLETION_SUBMITTED',
  'REWORK_REQUIRED', 'COMPLETED', 'CANCELLED',
];

/** Allowed POST /:id/status targets per current status (mirrors seefix-api). */
export const NEXT_STATUS: Record<string, string[]> = {
  IN_PROGRESS: ['PENDING_PARTS', 'ON_HOLD'],
  PENDING_PARTS: ['IN_PROGRESS'],
  ON_HOLD: ['IN_PROGRESS'],
  REWORK_REQUIRED: ['IN_PROGRESS'],
};

/** Completion upload limits enforced by seefix-api (MAX_UPLOAD_MB, MAX_REPORT_IMAGES, image types). */
export const COMPLETION_UPLOAD = { maxFiles: 5, maxBytes: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] };

/** GET /api/work-orders (WORKER sees only work orders where they are the lead). */
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

/** GET /api/work-orders/:id (raw DB rows). */
export interface WorkOrderDetail {
  workOrder: Row;
  assignments: Row[];
  people: Row[];
  materials: Row[];
  images: Row[];
  updates: Row[];
}

/** GET /api/work-orders/assignable-users */
export interface AssignableUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  departmentOrTrade: string | null;
  phone: string | null;
}

export interface AssignRequest {
  assignedPartyName: string;
  responsibleLeadUserId: string | null;
  responsibleLeadName: string | null;
  responsibleLeadContact: string | null;
  responsibleLeadEmail: string | null;
  reason?: string;
}
