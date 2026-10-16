/**
 * `GET /api/analytics/overview` (seefix-api docs/V2_SEARCH_ANALYTICS_MAP.md §2). Every number is a server aggregate;
 * the page shows them as returned and never recomputes them from lists. `null` = no data in the range.
 */
export type Counts = Record<string, number>;

export interface ReportsSection {
  created: number;
  byStatus: Counts;
  byCategory: Counts;
  perDay: { day: string; count: number }[];
}

export interface QueueAgingSection {
  under1d: number;
  d1to3: number;
  d3to7: number;
  over7d: number;
  total: number;
}

export interface WorkOrdersSection {
  byStatus: Counts;
  completed: number;
  avgTurnaroundHours: number | null;
  p50TurnaroundHours: number | null;
  /** Percent (0–100) of completed work orders that went through REWORK_REQUIRED. */
  reworkRate: number | null;
}

export interface ProcurementSection {
  byStatus: Counts;
  open: number;
  overdue: number;
  completed: number;
  avgDaysToOutcome: number | null;
}

export interface AgentSection {
  byStatus: Counts;
  retried: number;
  latencyP50Seconds: number | null;
  latencyP95Seconds: number | null;
  failedOpen: number;
}

/** The API returns only the sections the caller's role may see (Procurement: procurement; Worker: own work orders). */
export interface AnalyticsSections {
  reports?: ReportsSection;
  queueAging?: QueueAgingSection;
  workOrders?: WorkOrdersSection;
  procurement?: ProcurementSection;
  agent?: AgentSection;
}

export interface AnalyticsOverview {
  /** Inclusive range actually used by the server (YYYY-MM-DD, UTC). */
  from: string;
  to: string;
  sections: AnalyticsSections;
}

export interface DateRange {
  from: string;
  to: string;
}
