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

## Configuration

| File | Purpose |
|---|---|
| `src/environments/environment.development.ts` | `apiBaseUrl: ''` (same origin, proxied) |
| `src/environments/environment.ts` | production: set `apiBaseUrl` to the approved **HTTPS** API origin |
| `proxy.conf.json` | dev proxy target |

For a production deploy on another origin, add that origin to the API's `CORS_ORIGINS`.

### Realtime (Pusher)

The API exposes `GET /api/realtime/config` (public key + cluster only) and `POST /api/realtime/auth`
(signs **only** the caller's `private-user-{id}` channel). The API publishes `notification.created` after the
database transaction commits. The client treats the event as "refetch the inbox"; the API list stays the source of truth.
If Pusher is not configured (`PUSHER_*` empty in the API `.env`) or the connection fails, the app polls every 60 s.

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

## Backend changes this app depends on (`seefix-api` branch `feat/web-admin-support`)

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
