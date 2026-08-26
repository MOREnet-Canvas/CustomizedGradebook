# CLAUDE.md

Project rules and context for **CustomizedGradebook** — a Canvas LMS browser extension injected via the Canvas Theme JS field.

---

# Rules

## Output Defaults

**Code-only by default.** Respond with code changes, not prose.

- Do not write long explanations or summaries.
- Do not explain code unless asked.
- Keep responses to the change itself, plus clarification questions if needed.

**Explanations are opt-in.** Only give walkthroughs / rationale when explicitly asked ("explain why", "walk me through this", "debug mode on").

## Documentation Files

Do not create, modify, or update standalone documentation files unless explicitly requested for that specific change set. This covers README files (`.md`, `.txt`, or similar), architecture/design docs, and changelog entries.

Always allowed without asking:

- JSDoc comments (`/** */`) on functions, classes, and exported members
- Inline `//` comments explaining non-obvious logic
- Type annotations and parameter descriptions inside code files

Doc files become fair game only on an explicit trigger — "doc mode on", "update the README", "add documentation for this".

## Terminal Commands

**Read-only commands may be run without asking** — e.g. `git status`, `git log`, `git diff`, `gh issue list`, `gh pr view`, `npm test`, `npm ls`, `node --version`.

**Ask before anything that writes.** Get explicit approval before running commands that change files, repo state, or anything remote:

- `git commit`, `git push`, `git checkout`, `git reset`, `git merge`, `git rebase`
- `npm run deploy:*`, `npm run release:*`, `npm install`, `npm version`
- `gh release`, `gh pr create`, `gh issue create/close`, `gh workflow run`
- Any file creation, move, or deletion outside the edit being requested

Never assume or fabricate command output. If a command was not actually run, say so.

## Use Existing Services — Do Not Recreate

Before writing any new utility, helper, or service function:

1. Check `AI_SERVICES_REFERENCE.md` (repo root) for an existing service.
2. Search the codebase for an implementation that already covers the need.
3. Prefer calling or extending an existing service over creating a parallel one.
4. If an existing service is close but not exact, modify it safely rather than duplicating it.

Services that already exist:

| Need | Use |
|---|---|
| Canvas API calls | `CanvasApiClient` — `src/utils/canvasApiClient.js` |
| Role detection | `getUserRoleGroup()` — `src/utils/canvas.js` |
| Course ID | `getCourseId()` — `src/utils/canvas.js` |
| Student roster | `fetchCourseStudents()` — `src/services/enrollmentService.js` |
| Logging | `logger` — `src/utils/logger.js` |

If nothing exists, create it — but place it where similar utilities live, name it consistently with the existing pattern, and export it so other modules can consume it.

## New Modules Must Consider Shared Use

When creating a new module or service:

- Identify which functions other modules are likely to need.
- Export those explicitly; do not leave them internal-only by default.
- Do not hardcode assumptions that tie the module to a single caller.

## Clarify Before Coding

If requirements are unclear or have multiple valid readings, ask targeted questions **before** writing code. Do not guess silently.

If the uncertainty is minor and non-blocking, make the smallest reasonable assumption and state it in one short line.

## Code Quality

Prefer:

- Simple, readable code over clever code
- Consistent naming and structure across the project
- Small modules with a clear single responsibility
- Removing dead code and duplication when encountered, if safe and directly related

Refactors are allowed when they improve correctness, clarity, or reduce duplication.

## Safe Product Evolution

Changes that affect the wider system must be called out explicitly in the response:

- **Adding a dependency** — what was added, and why it is necessary
- **Changing build/deploy config** — what file changed, what behavior changes
- **Changing file structure** — what moved or was renamed, and the new import paths

State these inline in the response. Do not create or update documentation files for them.

## Pre-Response Check (Silent)

- [ ] No `.md`/`.txt` documentation files created unless requested
- [ ] No prose explanations added unless requested
- [ ] No write-commands run without approval; no command output assumed
- [ ] No utility/service created that duplicates an existing one
- [ ] New modules export shared-use functions explicitly

---

# Project Context

## Commands

| Task | Command |
|---|---|
| Run tests | `npm test` (vitest, jsdom env) |
| Deploy dev build | `npm run deploy:dev` — builds **desktop and mobile**, uploads to the rolling `dev` and `mobile-dev` releases |
| Redeploy prod (no version bump) | `npm run redeploy:prod` |
| Redeploy mobile | `npm run redeploy:mobile` |
| Release | `npm run release:patch` \| `release:minor` \| `release:major` |
| Release mobile | `npm run release:mobile:patch` \| `:minor` \| `:major` |
| Regenerate mermaid diagrams | `npm run export:all` |

Notes:

- There is **no separate `build:dev` / `build:prod` script** — the deploy/release scripts in `buildScripts/` run esbuild themselves.
- Deploy and release are **write commands** — ask before running them (see Terminal Commands). `release:*` commits, tags, and pushes.
- Node 22.x locally and in CI, so local build === CI build.
- Everything except `deploy:dev` refuses to run with a dirty working tree.
- `.github/workflows/dev-release.yml` is **inactive** — its `push` trigger is commented out and it calls the nonexistent `build:dev`. Dev publishing is local-only.

## Delivery Model

Two channels, both served from GitHub Releases (not Pages):

- **DEV** → rolling `dev` / `mobile-dev` releases, published locally by `npm run deploy:dev`. Canvas dev loader pulls immediately; desktop bundle is unminified with source maps.
- **PROD** → immutable `vX.Y.Z` releases, minified, no source maps. Canvas prod loader pins a version tag; no cache-busting.
- **Mobile** is versioned independently in `mobile/package.json` (`mobile-vX.Y.Z`), built from `src/masteryDashboard/mobileInit.js`.

Auto-patch loaders resolve version *tracks* (`v1.2-latest`, `latest`, `stable`) through `versions.json`, generated by `update-version-manifest.yml`.

## Architecture

`src/customGradebookInit.js` is an IIFE entry point that detects the Canvas page and user role, then routes to feature inits.

```
customGradebookInit.js          entry point
├── Page detection              src/utils/pageDetection.js, src/utils/canvas.js
├── Mastery Outlook             src/masteryOutlook/    data · state machine · actions · view · sync
├── Mastery Dashboard           src/masteryDashboard/, src/masteryDashboardCreation/
├── Gradebook                   src/gradebook/         stateMachine.js, updateFlowOrchestrator.js
├── Student-side                src/student/, src/dashboard/
├── SpeedGrader                 src/speedgrader/
├── Admin                       src/admin/
└── Shared services             src/services/, src/utils/
```

Design decisions worth knowing before changing anything:

- **Config via `window.CG_CONFIG`** — every constant in `src/config.js` reads `window.CG_CONFIG` first, falling back to a default. Loaders set it before the bundle loads, so per-tenant behavior changes without a rebuild.
- **Persistent cache lives in Canvas Files** — a single JSON blob at `MOREnet_CustomizedGradebook/mastery_outlook_cache/mastery_outlook_cache.json`, shared across teachers in a course. No external database.
- **Transient state is module-level `Set`/`Map`** (`masteryOutlookState.js`) — never persisted, reset on reload. Always clear in `finally` blocks.
- **Power Law replaces Canvas scoring** — Marzano's `y = a·x^b` for Mastery Outlook. Minimum 3 scored attempts; fewer shows "NE".
- **Explicit state machines** for both PL sync and gradebook Refresh Mastery, so multi-step async flows (push → verify → complete) stay auditable.
- **CSRF** — `CanvasApiClient` reads the `_csrf_token` cookie once at construction and injects it as both the `X-CSRF-Token` header and an `authenticity_token` body field on mutating requests.
- **Canvas outcome scores come only from rubric criterion ratings.** Assignment grades, points possible, and grading schemes do not affect them. Changing `points_possible` may refresh the mastery *display* without changing any outcome data.

## Where to Look — Read Before Changing

Do not load these preemptively. Open the relevant one when the task touches its area.

### Developer docs — `docs-src/` (MkDocs source; `docs/` is generated HTML, never edit it)

| Task | File |
|---|---|
| Add a Canvas API call | `docs-src/api-service-layer.md` |
| Grade sync pipeline | `docs-src/state-machine.md`, `docs-src/sync-modules.md` |
| Persistent cache | `docs-src/data-layer.md` |
| Detect a new Canvas page type | `docs-src/page-detection.md` |
| Config defaults | `docs-src/configuration.md` |
| Debug a Canvas API failure | `docs-src/canvas-api-gotchas.md` |
| Power Law metrics | `docs-src/power-law.md` |
| Build / release process | `docs-src/build-pipeline.md`, `docs-src/development/workflows.md`, `docs-src/development/versioning.md` |
| Browser debug REPL | `docs-src/dev-tools.md` |
| Feature behavior | `docs-src/walkthroughs/mastery-outlook.md`, `mastery-view.md`, `supporting-tools.md` |
| Admin features | `docs-src/admin-dashboard.md`, `docs-src/account-filtering.md` |
| Mobile module | `docs-src/mobile/overview.md`, `installation.md`, `setup.md` |

`AI_SERVICES_REFERENCE.md` (repo root) is the service/utility index — check it first before writing any helper.

### Working notes — `documents/`

Rougher, often more current than the polished docs. Consult when the polished doc doesn't cover it.

| Area | Path |
|---|---|
| Release workflow narrative | `documents/DevAndProdReleaseWorkflow.md` |
| Canvas API research | `documents/API Notes/` — rubric settings matrix, outcome rollups |
| Canvas API failure investigations | `documents/API debugging/` — SpeedGrader constraints, grade status updates |
| Past debugging writeups | `documents/Debugging Notes/` — course detection, CSRF decision |
| Module deep-dives | `documents/Module descriptions/` — auto-patch loader, beta loader, snapshot security, state machine, admin guide |
| Known issues & planned work | `documents/TODOs/` — check here before proposing a refactor; it may already be scoped |
| Canvas behavior clarifications | `documents/Helpful Explaniations/` |
| Architecture diagrams | `documents/fileStructureDiagrams/` — `.mmd` sources, `.pdf` renders |

When a `documents/TODOs/` file covers the task at hand, read it first — it usually records constraints discovered the hard way.