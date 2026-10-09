/** Production. apiBaseUrl must be the approved HTTPS API origin (no trailing slash). */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.seefix.example',
  requestTimeoutMs: 20000,
  uploadTimeoutMs: 120000,
  /** Realtime is only attempted when the API reports it is configured. */
  realtime: true,
  pollMs: 60000,
};
