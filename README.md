# SEEFIX Web Admin — Angular MVP Foundation

The browser application for **ADMIN, MAINTENANCE_STAFF, MAINTENANCE_SUPERVISOR, PROCUREMENT, WORKER**, backed by the existing Node/Express \`seefix-api\`. Reporter accounts belong to the separate Ionic mobile app.

**Development state:** Phase 1 starter, not a complete MVP. The [full delegated Web Admin implementation ticket](https://github.com/erwin-io/seefix-web-admin/issues/1) contains scope, workflow requirements, missing screens, tests and acceptance criteria. Do not represent the read-only queues as a completed business workflow.

## Run locally (Windows PowerShell)

1. Install an Angular-21-compatible Node.js release and ensure the existing SEEFIX API is listening at \`127.0.0.1:3000\`.
2. In \`C:\\Development\\seefixmanagement\\seefix-web-admin\` run:

    npm install
    npm start

3. Open http://127.0.0.1:4200. The development proxy forwards \`/api\` requests to port 3000.
4. \`npm run build\` and \`npm run typecheck\` are the initial validation commands; no build has been independently run in this cloud session.

## Implemented foundation

- Angular 21 standalone/bootstrap, zoneless change detection, SCSS, dev proxy.
- Staff sign-in, JWT-backed session, \`/auth/me\` restoration, logout and auth interceptor.
- Five-role navigation and route guards. Reporters are denied the web-admin.
- Live role-specific dashboard cards sourced from actual Node API list endpoints.
- Read-only action center, review queue, reports, Work Orders, Procurement inbox, Admin users and notifications.

## Remaining implementation

Complete Maintenance Review approvals, maintenance request detail, Work Order assignment/execution/closeout, Procurement outcome/clarifications/documents, Admin Knowledge, user creation, notifications actions, OTP/account flows, pagination, validation and tests per issue #1. Implement private Pusher channels only after Node provides authenticated channel access and a functioning transactional outbox dispatcher.

No direct Agent/database calls in frontend. AI is advisory; human-authorized decisions remain the system of record.
