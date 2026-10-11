# Graph Report - seefix-web-admin  (2026-10-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 516 nodes · 1177 edges · 37 communities (22 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4e6d50a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Angular Core & Error Handling
- @angular/router
- api.service.ts
- handoff-detail.page.ts
- knowledge.page.ts
- package.json
- WorkOrderDetailPage
- interceptors.ts
- maintenance.service.ts
- report-detail.page.spec.ts
- KnowledgePage
- dependencies
- MaintenanceService
- WorkOrdersService
- devDependencies
- maintenance.models.ts
- seefix-web-admin
- scripts
- dashboard.page.ts
- angular.json
- build
- AccountSettingsPage
- architect
- options
- serve
- development
- AccountService
- DashboardPage
- eslint.config.js
- NotificationListPage
- UserListPage
- ReviewQueueItem
- WorkOrderItem
- engines
- environment.development.ts

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
- `NavItem` --references--> `Role`  [EXTRACTED]
  src/app/layout/shell/shell.component.ts → src/app/core/models/user.model.ts
- `CreateUserRequest` --references--> `Role`  [EXTRACTED]
  src/app/modules/admin/admin.models.ts → src/app/core/models/user.model.ts
- `ActionItem` --references--> `Role`  [EXTRACTED]
  src/app/modules/maintenance/maintenance.models.ts → src/app/core/models/user.model.ts
- `AssignableUser` --references--> `Role`  [EXTRACTED]
  src/app/modules/work-orders/work-orders.models.ts → src/app/core/models/user.model.ts
- `HandoffDetail` --references--> `Row`  [EXTRACTED]
  src/app/modules/procurement/procurement.models.ts → src/app/core/models/api.model.ts

## Import Cycles
- None detected.

## Communities (37 total, 15 thin omitted)

### Community 0 - "Angular Core & Error Handling"
Cohesion: 0.07
Nodes (30): @angular/common, @angular/core, @angular/forms, @angular/material, rxjs, ErrorKind, toAppError(), load() (+22 more)

### Community 1 - "@angular/router"
Cohesion: 0.06
Nodes (30): @angular/router, routes, authGuard(), guestGuard(), roleGuard(), safeReturnUrl(), roleDenied(), SessionService (+22 more)

### Community 2 - "api.service.ts"
Cohesion: 0.09
Nodes (13): pusher-js, ApiService, apiUrl(), normalize(), QueryParams, SKIP_AUTH, toParams(), Notification (+5 more)

### Community 3 - "handoff-detail.page.ts"
Cohesion: 0.09
Nodes (9): PROCUREMENT_ACTORS, SUPERVISOR, HandoffDetailPage, ProcurementInboxPage, DOCUMENT_TYPES, EXECUTION_TYPES, HandoffDetail, ProcurementInboxItem (+1 more)

### Community 4 - "knowledge.page.ts"
Cohesion: 0.19
Nodes (7): Category, CATEGORY_FIELDS, CategoryMaterial, CategorySkill, CreateUserRequest, AdminService, URGENCIES

### Community 5 - "package.json"
Cohesion: 0.11
Nodes (17): name, packageManager, private, version, @angular/animations, @angular/build, @angular/cdk, @angular/cli (+9 more)

### Community 7 - "interceptors.ts"
Cohesion: 0.21
Nodes (8): @angular/platform-browser, AppComponent, appConfig, isOwnApi(), AppError, SESSION_ENDING, authInterceptor(), sessionEndInterceptor()

### Community 8 - "maintenance.service.ts"
Cohesion: 0.25
Nodes (10): Items, Row, ReportDetail, ReviewResult, AssignableUser, AssignRequest, COMPLETION_UPLOAD, NEXT_STATUS (+2 more)

### Community 9 - "report-detail.page.spec.ts"
Cohesion: 0.19
Nodes (4): Decision, ReportDetailPage, DETAIL, submitAndCapture()

### Community 11 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @angular/animations, @angular/cdk, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/material (+5 more)

### Community 14 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, angular-eslint, @angular/language-service, eslint, jsdom (+4 more)

### Community 15 - "maintenance.models.ts"
Cohesion: 0.20
Nodes (7): CategoryRef, MaintenanceReportItem, REPORT_STATUSES, ReportImage, ReportTimelineEntry, Screening, ReportListPage

### Community 16 - "seefix-web-admin"
Cohesion: 0.22
Nodes (9): seefix-web-admin, skipTests, style, @schematics/angular:component, prefix, projectType, root, schematics (+1 more)

### Community 17 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, lint, ng, start, test, test:ci, typecheck (+1 more)

### Community 18 - "dashboard.page.ts"
Cohesion: 0.31
Nodes (4): Metric, ActionItem, ActionCenterPage, entityLink()

### Community 19 - "angular.json"
Cohesion: 0.25
Nodes (7): cli, packageManager, schematicCollections, newProjectRoot, projects, $schema, version

### Community 20 - "build"
Cohesion: 0.25
Nodes (8): build, builder, configurations, defaultConfiguration, production, budgets, buildTarget, outputHashing

### Community 22 - "architect"
Cohesion: 0.29
Nodes (7): lint, test, builder, options, lintFilePatterns, architect, builder

### Community 23 - "options"
Cohesion: 0.29
Nodes (7): options, allowedCommonJsDependencies, assets, browser, inlineStyleLanguage, styles, tsConfig

### Community 24 - "serve"
Cohesion: 0.33
Nodes (6): serve, proxyConfig, builder, configurations, defaultConfiguration, options

### Community 25 - "development"
Cohesion: 0.33
Nodes (6): development, buildTarget, extractLicenses, fileReplacements, optimization, sourceMap

### Community 28 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): angular, tseslint, angular-eslint, typescript-eslint

## Knowledge Gaps
- **12 isolated node(s):** `@angular/animations`, `@angular/build`, `@angular/cli`, `@angular/compiler`, `@angular/compiler-cli` (+7 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 212 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@angular/core` connect `Angular Core & Error Handling` to `@angular/router`, `api.service.ts`, `handoff-detail.page.ts`, `knowledge.page.ts`, `package.json`, `interceptors.ts`, `maintenance.service.ts`, `report-detail.page.spec.ts`, `MaintenanceService`, `dashboard.page.ts`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **What connects `@angular/animations`, `@angular/build`, `@angular/cli` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Angular Core & Error Handling` be split into smaller, more focused modules?**
  _Cohesion score 0.07263157894736842 - nodes in this community are weakly interconnected._
- **Why does `@angular/router` connect `@angular/router` to `Angular Core & Error Handling`, `api.service.ts`, `handoff-detail.page.ts`, `package.json`, `interceptors.ts`, `report-detail.page.spec.ts`, `dashboard.page.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Should `@angular/router` be split into smaller, more focused modules?**
  _Cohesion score 0.060041407867494824 - nodes in this community are weakly interconnected._
- **Why does `@angular/material` connect `Angular Core & Error Handling` to `@angular/router`, `handoff-detail.page.ts`, `knowledge.page.ts`, `package.json`, `interceptors.ts`, `dashboard.page.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `api.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08599033816425121 - nodes in this community are weakly interconnected._