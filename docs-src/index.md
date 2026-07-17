# Customized Gradebook — Developer Reference

**CustomizedGradebook** is a Canvas LMS browser extension (injected via the Canvas Theme JS field) that adds teacher analytics, grade sync, and student-facing grade display enhancements to Canvas.

---

## What it does

| Feature | Audience | Canvas page |
|---------|----------|-------------|
| **Mastery Outlook** — Power Law grade sync | Teachers | `/courses/:id/pages/mastery-outlook` |
| **Mastery View** — Outcome progress viewer | Teachers, parents | `/courses/:id/pages/mastery-dashboard?cg_web=1` |
| **Gradebook enhancements** — Refresh Mastery button, kebab menu | Teachers | `/courses/:id/gradebook` |
| **Student grade customization** — reformatted grade display | Students, observers | `/courses/:id/grades`, `/grades`, dashboard |
| **SpeedGrader integration** — dropdown auto-activate, score sync | Teachers | `/courses/:id/gradebook/speed_grader` |
| **Admin Dashboard** — virtual management page | Admins | Any account page + `?cg_admin_dashboard=1` |

---

## Architecture overview

```
customGradebookInit.js          ← IIFE entry point; routes to feature inits
│
├── Page detection              src/utils/pageDetection.js, src/utils/canvas.js
│   getUserRoleGroup()          src/utils/canvas.js
│
├── Mastery Outlook             src/masteryOutlook/
│   ├── Data layer              masteryOutlookDataService.js, masteryOutlookCacheService.js
│   ├── State machine           plOutlookStateMachine.js + plOutlookStateHandlers.js
│   ├── User actions            plOutlookActions.js
│   ├── View                    masteryOutlookView.js, outcomeRow.js, studentSyncTable.js
│   ├── Sync status             plOutlookSyncStatus.js
│   └── Avg assignment update   masteryOutlookAvgService.js
│
├── Mastery Dashboard           src/masteryDashboard/
│   └── Creation                src/masteryDashboardCreation/
│
├── Gradebook                   src/gradebook/
│   ├── Update state machine    stateMachine.js, stateHandlers.js
│   └── Orchestration           updateFlowOrchestrator.js
│
├── Student-side                src/student/, src/dashboard/
│
├── SpeedGrader                 src/speedgrader/
│
├── Admin                       src/admin/
│
└── Shared services             src/services/, src/utils/
    ├── API client              canvasApiClient.js
    ├── Enrollment              enrollmentService.js
    ├── Grade override          gradeOverride.js
    ├── Grade calculation       gradeCalculator.js
    ├── Outcome CRUD            outcomeService.js
    └── GraphQL grading         graphqlGradingService.js
```

---

## Key design decisions

### Runtime configuration via `window.CG_CONFIG`

All behavior is controlled by constants in `src/config.js`. Every constant reads `window.CG_CONFIG` first, falling back to a default. Loader files set `window.CG_CONFIG` before the bundle loads, enabling per-tenant customization without a rebuild. → [Configuration](configuration.md)

### Persistent cache in Canvas Files

The Mastery Outlook cache is a single JSON file stored in Canvas Files (`MOREnet_CustomizedGradebook/mastery_outlook_cache/mastery_outlook_cache.json`). This makes it accessible to all teachers in a course and persistent across sessions, without requiring an external database. → [Data Layer](data-layer.md)

### In-memory transient state

Spinner state and in-flight operation guards use module-level `Set` and `Map` objects (`masteryOutlookState.js`). These are never persisted and reset on page reload. Always clear them in `finally` blocks. → [Data Layer](data-layer.md)

### Power Law regression for grade prediction

Canvas's built-in scoring methods (decaying average, highest, latest) are replaced by Marzano's Power Law (`y = a·x^b`) for Mastery Outlook. A minimum of 3 scored attempts is required; students with fewer show "NE" (Not Enough data). → [Power Law](power-law.md)

### State machine for complex sync flows

Both the Mastery Outlook PL sync and the gradebook Refresh Mastery flow are modeled as explicit state machines (`PLOutlookStateMachine`, `gradebook/stateMachine.js`). This makes the multi-step async flows (push → verify → complete) auditable and testable. → [State Machine](state-machine.md)

### CSRF via `_csrf_token` cookie + `authenticity_token` body

`CanvasApiClient` reads the `_csrf_token` cookie once at construction and injects it as both the `X-CSRF-Token` header and the `authenticity_token` body field on every mutating request. → [API Service Layer](api-service-layer.md)

---

## Developer navigation

| If you want to… | Read… |
|----------------|-------|
| Understand the overall feature set | [Feature Walkthroughs](walkthroughs/mastery-outlook.md) |
| Add a new Canvas API call | [API Service Layer](api-service-layer.md) |
| Work on the grade sync pipeline | [State Machine](state-machine.md), [Sync Modules](sync-modules.md) |
| Modify the persistent cache | [Data Layer](data-layer.md) |
| Detect a new Canvas page type | [Page Detection](page-detection.md) |
| Change configuration defaults | [Configuration](configuration.md) |
| Debug a Canvas API failure | [Canvas API Gotchas](canvas-api-gotchas.md) |
| Add a Power Law metric | [Power Law](power-law.md) |
| Change the build or release process | [Build Pipeline](build-pipeline.md) |
| Use the debug REPL in browser | [Dev Tools](dev-tools.md) |

---

## For Admins

- [Admin Dashboard Overview](admin-dashboard.md)
- [Account Filtering](account-filtering.md)

## For Mobile Module

- [Mobile Module Overview](mobile/overview.md) — Parent Mastery for Canvas Parent app
- [Installation Guide](mobile/installation.md) — Install the mobile loader
- [Setup Guide](mobile/setup.md) — Configure courses for Parent Mastery

## Development

- [Development Workflows](development/workflows.md) — Dev/prod release processes
- [Versioning System](development/versioning.md) — Semantic versioning and auto-patch

---

## Installation notes

- The theme must be installed at the **Root Account (ID: 1)** for student dashboard and `/grades` customizations to work.
- Use Account Filtering to restrict where CG runs by sub-account.
- The **Mobile Module** is a separate component with independent versioning.

## Quick Links

- [GitHub Repository](https://github.com/MOREnet-Canvas/CustomizedGradebook)
- [GitHub Releases](https://github.com/MOREnet-Canvas/CustomizedGradebook/releases)
- [Button Setup Tool](https://morenet-canvas.github.io/CustomizedGradebook/button_directions.html)