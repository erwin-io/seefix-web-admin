import { Row } from '@app/core/models/api.model';

export const DOCUMENT_TYPES = ['PROCUREMENT_REFERENCE', 'REQUEST_PACKAGE', 'CLARIFICATION_ATTACHMENT', 'OUTCOME_REFERENCE', 'OTHER'];
export const EXECUTION_TYPES = ['CONTRACTOR', 'AGENCY', 'INDIVIDUAL', 'GROUP', 'INTERNAL', 'OTHER'];

/** v_ProcurementInbox */
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

/** GET /api/procurement/handoffs/:id (raw DB rows). */
export interface HandoffDetail {
  handoff: Row;
  clarifications: Row[];
  documents: Row[];
  outcome: Row | null;
}
