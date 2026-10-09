# SEEFIX Web Admin — MVP development kickoff (2026-10-10)

- Epic / dedicated coding-agent instructions: https://github.com/erwin-io/seefix-web-admin/issues/1
- Approved frontend stack: Angular 21 standalone, TypeScript 5.9, SCSS, planned PusherJS.
- Single REST authority: https://github.com/erwin-io/seefix-api (Node Express).
- AI worker: https://github.com/erwin-io/seefix-agents (never call directly from Angular).
- Reporter reference only: https://github.com/erwin-io/seefix-mobile-reporter (do not modify).

## Canonical internal roles
ADMIN, MAINTENANCE_STAFF, MAINTENANCE_SUPERVISOR, PROCUREMENT, WORKER.
Reporter mobile is distinct. No obsolete PPO names.

## Initial build order
1. Angular shell, login, guards, typed API client, proxy, error states.
2. Maintenance action center, review queue, images, AI scope, human decisions.
3. Work Order assignment, Worker execution + evidence, Supervisor accept/rework.
4. Procurement handoff, clarification, documents, external outcome.
5. Admin users, AI knowledge, notifications, account.
6. Pusher private-channel auth + outbox dispatcher only once backend is available.

## Rules
- Human decisions are final workflow authority. AI only recommends and drafts.
- PostgreSQL and Node enforce roles, assignments and status transitions.
- INTERNAL routing must not require Procurement.
- Do not create endpoints, permissions or synthetic operational data absent from source.
- All mutations show authoritative API success/error and are protected by confirmation.
- No unreviewed merge to main. Production security, test and E2E gates are mandatory.

## Handoff
GitHub Copilot coding-agent assignment was attempted but GitHub returned 403. Issue #1 remains unassigned; an authorized repository owner must assign a coding agent through GitHub, or a connected developer agent can use the issue directly.
