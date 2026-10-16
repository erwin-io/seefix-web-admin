# SEEFIX Web Admin

Internal web app for SEEFIX staff: **Admin, Maintenance Staff, Maintenance Supervisor, Procurement and Worker**.
Reporters are refused and use the mobile app.

Angular 21 (standalone, zoneless, signals) · Angular Material 21 · SCSS · pusher-js. It talks only to `seefix-api`:
no Agent, database or Cloudinary secrets in the browser.

Production: **https://seefix-web-admin.vercel.app** (every push to `main` deploys).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Git | any | to clone the repo |
| Node.js | 22.12 or newer (tested on 22.17.1) | `node -v`. Angular 21 needs ≥ 20.19 / 22.12 |
| npm | 10+ (comes with Node) | the repo pins `npm@10.9.2` |
| `seefix-api` | running on `http://127.0.0.1:3000` | set it up first: [seefix-api README](https://github.com/seefixmanagement/seefix-api#setup-step-by-step) |
| A staff account | any role except Reporter | e.g. the seeded `maintenance.staff@seefix.local` (seefix-api `scripts/seed-rbac-users.js`) |

The Angular CLI doesn't need a global install; `npm start` uses the project's copy.

## Run locally (step by step)

1. **Start seefix-api** in its own terminal (`npm run dev` in `seefix-api`) and check `http://127.0.0.1:3000/health`.
2. **Clone and install**
   ```powershell
   git clone https://github.com/seefixmanagement/seefix-web-admin.git
   cd seefix-web-admin
   npm ci
   ```
3. **Start**
   ```powershell
   npm start            # http://localhost:4200, /api and /health proxied to 127.0.0.1:3000 (proxy.conf.json)
   ```
4. Open `http://localhost:4200` and sign in with a staff account (email **or** username). No CORS setup is needed in
   dev because of the proxy. If your API runs elsewhere, change the `target` in `proxy.conf.json`.

To use the production API from your machine instead, point the two targets in `proxy.conf.json` to
`https://seefix-api.vercel.app`, and don't commit that change.

### Quality gates

```powershell
npm run build        # production build
npm run lint
npm run typecheck
npm run test:ci      # Vitest via @angular/build:unit-test
```

> If `ng` does not return to the prompt after finishing on your machine, `.\build.ps1 build|lint|"test --watch=false"`
> runs the same command and stops it once the result is printed.

## Project structure

Code is grouped by **business module** (the maintenance workflow), not by user role. Roles only decide which modules a
user may open: `data.roles` on each module route plus `roleGuard`, with the API as the final authority.

```text
src/
  styles.scss            global entry: @use the partials below
  styles/                _theme (Material + tokens) · _layout · _ticket · _utilities · _overlays
  app/
    app.routes.ts        lazy-loads each module's *.routes.ts
    core/                singletons, no UI
      http/              api.service.ts · app-error.ts · interceptors.ts
      auth/              session.service.ts · auth.guards.ts
      notifications/     notification.service.ts (inbox + Pusher) · notification.model.ts
      models/            user.model.ts (roles) · api.model.ts
      data/              fetch-all.ts (every page of a list) · dataset.store.ts (per-user list memory)
      utils/             load.ts (loading/error/value page helper)
    shared/              reusable UI with no business logic
      components/        data-table · status-chip · priority-badge · page-state · evidence-gallery · confirm-dialog
      pipes/ services/ utils/   humanize · ui.service (confirm/toast) · entity-link
      shared.imports.ts  SHARED_IMPORTS for pages
    layout/shell/        sidebar, top bar, breadcrumbs, notification bell
    modules/
      <module>/
        <module>.routes.ts     lazy routes for the module
        <module>.service.ts    all HTTP calls for the module (pages never call ApiService directly)
        <module>.models.ts     response/request types
        pages/<page>/          <page>.page.ts · .html · .scss   (routed)
        components/<name>/     <name>.component.ts · .html · .scss (module-only widgets/dialogs)
```

| Module | Routes | Used by |
|---|---|---|
| `auth` | `/login`, `/forgot-password`, `/reset-password` | everyone (public) |
| `dashboard` | `/dashboard` | all staff |
| `maintenance` | `/maintenance/*`, `/reports/:id` | Staff, Supervisor, Admin (+ linked Procurement/Worker for a report) |
| `work-orders` | `/work-orders`, `/work-orders/:id` | Staff, Supervisor, Admin, Worker |
| `procurement` | `/procurement/inbox`, `/procurement/handoffs/:id` | Procurement, Admin (+ Maintenance read) |
| `admin` | `/admin/users`, `/admin/knowledge` | Admin |
| `notifications`, `account` | `/notifications`, `/account` | all staff |
| `system` | `/denied`, `/unavailable`, `**` | fallbacks |

Conventions: every component/page has its own `templateUrl` and `styleUrl`. Imports use the `@app/*` and `@env/*` path
aliases. Adding a module means adding a folder plus one `loadChildren` line in `app.routes.ts`.

## Configuration

| File | Purpose |
|---|---|
| `src/environments/environment.development.ts` | `apiBaseUrl: ''` (same origin, proxied) |
| `src/environments/environment.ts` | production: `apiBaseUrl: ''` = same-origin `/api` behind the deployment's TLS reverse proxy |
| `proxy.conf.json` | dev proxy target |

If the API must live on another origin, set `apiBaseUrl` to that HTTPS origin at deploy time and add the web admin's origin to the API's `CORS_ORIGINS`.

### Vercel
`vercel.json` does on Vercel what `proxy.conf.json` does in dev: `/api/*` and `/health` are proxied to
`https://seefix-api.vercel.app`, so the app stays same-origin (`apiBaseUrl: ''`, no CORS). Every other path falls back to
`index.html` so deep links and refreshes work. Import the repo in Vercel (preset **Angular**, root `./`); no
environment variables are needed. To point at another API, change the two destinations in `vercel.json`.

### Realtime (Pusher)

The API exposes `GET /api/realtime/config` (public key + cluster only) and `POST /api/realtime/auth`
(signs **only** the caller's `private-user-{id}` channel). The API publishes `notification.created` after the
database transaction commits. The client treats the event as "refetch the inbox"; the API list stays the source of truth.
Polling (every 60 s) is always armed and only pauses while the private channel is actually subscribed and connected. A failed config, channel-auth error or disconnect therefore falls back to polling, and every reconnect re-reads the inbox.

## What each role can do

| Area | Routes | Roles |
|---|---|---|
| Dashboard (counts from real list endpoints) | `/dashboard` | all staff |
| Action Center, Review Queue, Reports | `/maintenance/*` | Staff, Supervisor, Admin |
| Report detail + **human review decision** (INTERNAL / PROCUREMENT / NO_ACTION / DUPLICATE) | `/reports/:id` | Staff, Supervisor, Admin decide; Procurement/Worker read when linked |
| Work orders: dispatch, start, status, progress, crew, materials, **completion photos** | `/work-orders` | Staff, Supervisor, Admin, Worker (own only) |
| Accept completion / request rework | work order detail | Supervisor, Admin |
| Procurement inbox, acknowledge, start, clarifications, documents, outcome | `/procurement/*` | Procurement, Admin (Maintenance read-only) |
| Answer procurement clarifications | handoff detail | Supervisor, Admin |
| Users (list, create), AI knowledge (categories, skills, materials) | `/admin/*` | Admin |
| Notifications, account settings | `/notifications`, `/account` | all staff |

Client guards only hide what a role can't use. **Server RBAC is authoritative**, and every mutation re-reads
the record afterwards, so a 409 shows the server's current state.

## Known gaps

1. No user edit / deactivate / admin password reset endpoints: the Users page is list + create only.
2. Staff lists load **every page** (`?page&pageSize=500`, seefix-api#22) into memory for the signed-in user, then
   sort/filter/page locally (`app-data-table`, zero list calls). They reload on Refresh, after the user's own writes
   and on logout/account switch. Needs an API with list paging; without it page 1 is the legacy capped list.
3. Lists follow other users' changes through `CacheSyncService` (#18): it polls `GET /api/sync/versions` every 60 s
   while Pusher is live and every 30 s otherwise (plus on tab resume, module entry, Refresh and a `data.changed`
   hint), and reloads a list whose domain version is newer than the `X-Data-Versions` it was loaded from: at once if
   on screen, else on next view. Before the API's cache migration (`available: false`) lists older than 5 min reload
   instead. The role channel for `data.changed` hints is subscribed only once `/api/realtime/config` returns
   `roleChannel` (not shipped server-side yet), so today the poll does the work. While the API is unreachable the
   lists keep their rows under a "may be out of date" banner; buttons are not disabled (the server still decides).
4. No Buildings/Locations admin endpoints.

Unit tests use HTTP mocks; they don't call a live API.
