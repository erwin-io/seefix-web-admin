/**
 * Production. `apiBaseUrl: ''` means same-origin `/api`: deploy the SPA behind the
 * reverse proxy / host that routes `/api` to seefix-api over TLS (no CORS needed).
 * If the API is served from a different origin, set it here at deploy time
 * (HTTPS origin, no trailing slash) and add this app's origin to the API's CORS_ORIGINS.
 */
export const environment = {
  production: true,
  apiBaseUrl: '',
  requestTimeoutMs: 20000,
  uploadTimeoutMs: 120000,
  /** Realtime is only attempted when the API reports it is configured. */
  realtime: true,
  pollMs: 60000,
};
