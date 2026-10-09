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

/** GET /api/realtime/config: public key + cluster only. */
export interface RealtimeConfig {
  enabled: boolean;
  key: string | null;
  cluster: string | null;
  userChannel: string;
}
