/** Development: same-origin `/api`, proxied to http://127.0.0.1:3000 (proxy.conf.json). */
export const environment = {
  production: false,
  apiBaseUrl: '',
  requestTimeoutMs: 20000,
  uploadTimeoutMs: 120000,
  realtime: true,
  pollMs: 60000,
};
