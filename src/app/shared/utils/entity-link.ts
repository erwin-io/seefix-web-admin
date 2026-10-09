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
