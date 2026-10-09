# SEEFIX Web Admin

Internal web app for SEEFIX staff: **Admin, Maintenance Staff, Maintenance Supervisor, Procurement and Worker**.
Reporters are refused and use the mobile app.

Angular 21 (standalone, zoneless, signals) · Angular Material 21 · SCSS · pusher-js. It talks only to `seefix-api`:
no Agent, database or Cloudinary secrets in the browser.

## Run locally (Windows)

Prerequisites: Node 22.12+ (tested on 22.17.1), a running `seefix-api` on `http://127.0.0.1:3000`
(with PostgreSQL and the Agent as described in the API README).

```powershell
cd C:\Development\seefixmanagement\seefix-web-admin
npm ci
npm start            # http://localhost:4200, /api and /health proxied to 127.0.0.1:3000 (proxy.conf.json)
```

Sign in with any staff account (email **or** username). No CORS setup is needed in dev because of the proxy.

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
      utils/             load.ts (loading/error/value page helper)
    shared/              reusable UI with no business logic
      components/        status-chip · priority-badge · page-state · evidence-gallery · confirm-dialog
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

## Backend-gated features (`seefix-api` PR erwin-io/seefix-api#2, branch `feat/web-admin-support`)

Until that PR is deployed, the affected UI degrades with a visible message instead of failing: no user picker when
dispatching (enter a lead name; Workers won't see the work order), the AI category is the only option on review,
and notifications use polling.

- `GET /api/work-orders/assignable-users`: staff pick a responsible lead (`/api/admin/users` is Admin-only).
- `GET /api/reference/categories`: active categories for review overrides.
- `GET /api/realtime/config`, `POST /api/realtime/auth` and the after-commit `notification.created` publish.
- Procurement handoff detail now returns `ReportId`.

## Known gaps (backend tickets)

1. No user edit / deactivate / admin password reset endpoints: the Users page is list + create only.
2. No server pagination or search on staff lists (API caps at 200 rows); search is client-side.
3. Realtime only signals notifications; list/detail pages refresh on demand.
4. No Buildings/Locations admin endpoints.
5. Live end-to-end runs against real staff accounts, Cloudinary and the Agent are still pending; unit tests use HTTP mocks.
