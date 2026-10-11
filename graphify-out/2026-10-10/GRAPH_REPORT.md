# Graph Report - seefix-web-admin  (2026-10-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 515 nodes · 1175 edges · 34 communities (21 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 29,614 input · 417 output

## Graph Freshness
- Built from commit: `7eb37b26`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Angular Core & Error Handling
- App Routing & Bootstrap
- User Roles & Notifications
- API HTTP Client
- Work Orders Dashboard
- Admin Categories & Users
- Package Metadata
- Work Order Detail Page
- Report Review Detail
- Knowledge Base Admin
- Runtime Dependencies
- Maintenance Report Models
- Dev Tooling Dependencies
- Procurement Workflow Service
- Work Order List & Models
- Procurement Models & Handoffs
- Maintenance Service
- Handoff Detail Page
- Angular Project Schematics
- NPM Scripts
- Angular Workspace Config
- Build Configuration
- Account Settings Page
- Lint & Test Targets
- Build Options
- Dev Server Config
- Development Build Settings
- ESLint Config
- Report List Page
- Review Queue Page
- Procurement Inbox Page
- Node Engine Requirement
- Development Environment

## God Nodes (most connected - your core abstractions)
1. `@angular/core` - 50 edges
2. `@angular/router` - 38 edges
3. `@angular/material` - 28 edges
4. `SessionService` - 27 edges
5. `@angular/common` - 24 edges
6. `rxjs` - 22 edges
7. `WorkOrdersService` - 19 edges
8. `WorkOrderDetailPage` - 18 edges
9. `toAppError()` - 18 edges
10. `MaintenanceService` - 17 edges

## Surprising Connections (you probably didn't know these)
- `HandoffDetail` --references--> `Row`  [EXTRACTED]
  src/app/modules/procurement/procurement.models.ts → src/app/core/models/api.model.ts
- `WorkOrderDetail` --references--> `Row`  [EXTRACTED]
  src/app/modules/work-orders/work-orders.models.ts → src/app/core/models/api.model.ts
- `ActionItem` --references--> `Role`  [EXTRACTED]
  src/app/modules/maintenance/maintenance.models.ts → src/app/core/models/user.model.ts
- `AssignableUser` --references--> `Role`  [EXTRACTED]
  src/app/modules/work-orders/work-orders.models.ts → src/app/core/models/user.model.ts
- `NavItem` --references--> `Role`  [EXTRACTED]
  src/app/layout/shell/shell.component.ts → src/app/core/models/user.model.ts

## Import Cycles
- None detected.

## Communities (34 total, 13 thin omitted)

### Community 0 - "Angular Core & Error Handling"
Cohesion: 0.07
Nodes (30): @angular/common, @angular/core, @angular/forms, @angular/material, rxjs, ErrorKind, toAppError(), load() (+22 more)

### Community 1 - "App Routing & Bootstrap"
Cohesion: 0.06
Nodes (28): @angular/platform-browser, @angular/router, AppComponent, appConfig, routes, authGuard(), guestGuard(), roleGuard() (+20 more)

### Community 2 - "User Roles & Notifications"
Cohesion: 0.06
Nodes (16): MAINTENANCE, PROCUREMENT_READERS, Role, ROLE_LABEL, STAFF_ROLES, User, WORK_ROLES, Notification (+8 more)

### Community 3 - "API HTTP Client"
Cohesion: 0.09
Nodes (12): pusher-js, ApiService, apiUrl(), normalize(), QueryParams, SKIP_AUTH, toParams(), RealtimeConfig (+4 more)

### Community 5 - "Admin Categories & Users"
Cohesion: 0.19
Nodes (7): Category, CATEGORY_FIELDS, CategoryMaterial, CategorySkill, CreateUserRequest, AdminService, URGENCIES

### Community 6 - "Package Metadata"
Cohesion: 0.11
Nodes (17): name, packageManager, private, version, @angular/animations, @angular/build, @angular/cdk, @angular/cli (+9 more)

### Community 8 - "Report Review Detail"
Cohesion: 0.19
Nodes (4): Decision, ReportDetailPage, DETAIL, submitAndCapture()

### Community 10 - "Runtime Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @angular/animations, @angular/cdk, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/material (+5 more)

### Community 11 - "Maintenance Report Models"
Cohesion: 0.27
Nodes (10): Row, Metric, ActionItem, CategoryRef, REPORT_STATUSES, ReportDetail, ReportImage, ReportTimelineEntry (+2 more)

### Community 12 - "Dev Tooling Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, angular-eslint, @angular/language-service, eslint, jsdom (+4 more)

### Community 14 - "Work Order List & Models"
Cohesion: 0.23
Nodes (8): WorkOrderListPage, AssignableUser, AssignRequest, COMPLETION_UPLOAD, NEXT_STATUS, WORK_ORDER_STATUSES, WorkOrderDetail, WorkOrderItem

### Community 15 - "Procurement Models & Handoffs"
Cohesion: 0.33
Nodes (7): Items, PROCUREMENT_ACTORS, SUPERVISOR, DOCUMENT_TYPES, EXECUTION_TYPES, HandoffDetail, ProcurementInboxItem

### Community 18 - "Angular Project Schematics"
Cohesion: 0.22
Nodes (9): seefix-web-admin, skipTests, style, @schematics/angular:component, prefix, projectType, root, schematics (+1 more)

### Community 19 - "NPM Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, lint, ng, start, test, test:ci, typecheck (+1 more)

### Community 20 - "Angular Workspace Config"
Cohesion: 0.25
Nodes (7): cli, packageManager, schematicCollections, newProjectRoot, projects, $schema, version

### Community 21 - "Build Configuration"
Cohesion: 0.25
Nodes (8): build, builder, configurations, defaultConfiguration, production, budgets, buildTarget, outputHashing

### Community 23 - "Lint & Test Targets"
Cohesion: 0.29
Nodes (7): lint, test, builder, options, lintFilePatterns, architect, builder

### Community 24 - "Build Options"
Cohesion: 0.29
Nodes (7): options, allowedCommonJsDependencies, assets, browser, inlineStyleLanguage, styles, tsConfig

### Community 25 - "Dev Server Config"
Cohesion: 0.33
Nodes (6): serve, proxyConfig, builder, configurations, defaultConfiguration, options

### Community 26 - "Development Build Settings"
Cohesion: 0.33
Nodes (6): development, buildTarget, extractLicenses, fileReplacements, optimization, sourceMap

### Community 27 - "ESLint Config"
Cohesion: 0.40
Nodes (4): angular, tseslint, angular-eslint, typescript-eslint

## Knowledge Gaps
- **12 isolated node(s):** `@angular/animations`, `@angular/build`, `@angular/cli`, `@angular/compiler`, `@angular/compiler-cli` (+7 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 212 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@angular/core` connect `Angular Core & Error Handling` to `App Routing & Bootstrap`, `User Roles & Notifications`, `API HTTP Client`, `Admin Categories & Users`, `Package Metadata`, `Report Review Detail`, `Maintenance Report Models`, `Procurement Workflow Service`, `Work Order List & Models`, `Procurement Models & Handoffs`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **What connects `@angular/animations`, `@angular/build`, `@angular/cli` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Angular Core & Error Handling` be split into smaller, more focused modules?**
  _Cohesion score 0.07263157894736842 - nodes in this community are weakly interconnected._
- **Why does `@angular/router` connect `App Routing & Bootstrap` to `Angular Core & Error Handling`, `User Roles & Notifications`, `API HTTP Client`, `Package Metadata`, `Report Review Detail`, `Maintenance Report Models`, `Procurement Models & Handoffs`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Should `App Routing & Bootstrap` be split into smaller, more focused modules?**
  _Cohesion score 0.061057692307692306 - nodes in this community are weakly interconnected._
- **Why does `@angular/material` connect `Angular Core & Error Handling` to `App Routing & Bootstrap`, `User Roles & Notifications`, `Admin Categories & Users`, `Package Metadata`, `Maintenance Report Models`, `Procurement Models & Handoffs`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `User Roles & Notifications` be split into smaller, more focused modules?**
  _Cohesion score 0.0613107822410148 - nodes in this community are weakly interconnected._