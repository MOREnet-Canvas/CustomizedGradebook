# Build Pipeline

`buildScripts/` · `src/customGradebookInit.js` · `src/ui/styles.js`

---

## Overview

The build system uses **esbuild** to bundle the ES-module source tree into a single IIFE bundle for injection into Canvas pages. There are two target bundles:

| Bundle | Entry point | Output |
|--------|-------------|--------|
| Desktop (main) | `src/customGradebookInit.js` | `dist/[env]/customGradebookInit.js` |
| Mobile (parent app) | `src/masteryDashboard/mobileInit.js` | `dist/mobile/[env]/mobileInit.js` |

Releases are uploaded to GitHub Releases tags (`dev`, `mobile-dev`, `v1.x.y`) and loaded into Canvas via loader scripts in `loader files/`.

---

## Build-time constants (defines)

esbuild replaces these global identifiers at bundle time via the `define` option. They are **not** runtime variables and cannot be read from `window`.

| Constant | Dev value | Prod value | Type |
|----------|-----------|------------|------|
| `ENV_NAME` | `"dev"` | `"prod"` | `string` |
| `ENV_DEV` | `true` | `false` | `boolean` |
| `ENV_PROD` | `false` | `true` | `boolean` |
| `BUILD_VERSION` | `"MM/DD/YYYY HH:MM:SS (dev, abcd123)"` | same pattern with `"prod"` | `string` |

These are used in `logger.js` (`ENV_DEV` controls default log level) and `customGradebookInit.js` (informational logging).

---

## npm scripts

| Script | What it does |
|--------|-------------|
| `npm run deploy:dev` | Build dev + mobile-dev bundles (unminified + source maps) and upload to GitHub Releases |
| `npm run redeploy:prod` | Rebuild prod bundle without bumping version; upload to the existing release tag |
| `npm run redeploy:mobile` | Rebuild prod mobile bundle and upload |
| `npm run release:patch` | Bump patch version, build minified prod bundle, create git tag + GitHub Release, upload |
| `npm run release:minor` | Same as above for minor bump |
| `npm run release:major` | Same as above for major bump |
| `npm run release:mobile:patch/minor/major` | Version bump + build + upload for the mobile bundle |
| `npm test` | Run Vitest unit tests |

---

## `buildScripts/release.js` — prod release flow

Pre-flight → version bump → build → GitHub Release, in sequence:

1. **Pre-flight**: Aborts if there are uncommitted changes (`git diff`). Warns (does not abort) if not on `main`.
2. **Version bump**: `npm version [patch|minor|major] --no-git-tag-version` → writes new version to `package.json` → commits → creates an annotated git tag (`v1.x.y`).
3. **Git push**: `git push --follow-tags` — pushes commit and tag together.
4. **esbuild**: Bundles `src/customGradebookInit.js` as IIFE, minified, no source maps, target `es2017`. Output: `dist/prod/customGradebookInit.js`.
5. **GitHub Release**: `gh release create vX.Y.Z` → uploads `customGradebookInit.js` as a release asset.
6. **Version manifest**: Updated automatically by a GitHub Actions workflow (`update-version-manifest.yml`) triggered by the pushed tag.

### `getBuildMetadata(mode)` helper (internal)

Generates the `BUILD_VERSION` string embedded in each bundle.

```
"06/25/2026 11:45:00 AM (prod, a1b2c3d)"
```

- Timestamp is in **America/Chicago** timezone.
- Git hash comes from `git rev-parse --short HEAD`.

---

## `buildScripts/deploy-dev.js` — dev deployment flow

No version bump. Builds both bundles (unminified, source maps enabled for the desktop bundle) and uploads to two permanent release tags:

- Desktop → `gh release upload dev dist/dev/customGradebookInit.js ...`
- Mobile → `gh release upload mobile-dev dist/mobile/dev/mobileInit.js`

---

## `src/customGradebookInit.js` — initialization entry point

The IIFE that runs when the Canvas page loads. Responsibilities:

1. Logs the startup banner (`logBanner`) and stamps `window.CG` with env/version.
2. Stashes `ENV.OBSERVER_OPTIONS.OBSERVED_USERS_LIST` to `sessionStorage` so the mastery dashboard can access it across navigations.
3. Runs security snapshot validation (`validateAllSnapshots`).
4. Initializes modules conditionally by page type:

| Condition | Module(s) initialized |
|-----------|----------------------|
| Always | `initAdminDashboard()`, `initMasteryOutlook()`, `initMasteryDashboardViewer()`, `initStudentGradeCustomization()`, `exposeCGDevTools()` |
| `isAdminDashboardPage()` | Early return — skips everything below |
| `isCourseSettingsPage()` | `initMasteryDashboardCreation()` |
| `isGradebookPage()` | `injectButtons()`, async `initAssignmentKebabMenuInjection()` (standards-based courses only) |
| `isDashboardPage()` | `initDashboardGradeDisplay()` |
| `isSpeedGraderPage()` | `initSpeedGraderDropdown()`, `initSpeedGraderAutoGrade()` |
| `isTeacherViewingStudentGrades()` + teacher role | `initTeacherStudentGradeCustomizer()` |
| `ENV_DEV` only | Exposes `window.CG_testAllGradesDataSources`, `window.CG_clearAllSnapshots`, `window.CG_debugSnapshots`, `window.CG_debugAssignmentDetection` |

### Standards-based course detection

Before `initAssignmentKebabMenuInjection` runs, the init layer fetches (or reads from cache) a course snapshot and checks `snapshot.model === 'standards'`. Traditional courses are skipped silently.

---

## `src/ui/styles.js` — injectStyles()

### `injectStyles(css, id)` → `void`

Injects a `<style>` element into `document.head`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `css` | `string` | CSS text to inject |
| `id` | `string` (optional) | ID for deduplication — if an element with this ID already exists, the call is a no-op |

**Usage pattern** — every view module calls `injectStyles` at init time with a stable ID:

```js
import { injectStyles } from '../ui/styles.js';
import { MY_STYLES } from './myViewStyles.js';

injectStyles(MY_STYLES, 'cg-my-view-styles');
```

**Gotcha** — The idempotency check uses `document.getElementById(id)`. If `id` is omitted, a new `<style>` element is appended on every call, which can cause duplicate styles if a module is initialized more than once.

---

## Loader files

The `loader files/` directory contains Canvas JavaScript injection scripts. These are **not** bundled by esbuild — they are pasted into Canvas Theme settings or Global JavaScript and use a `<script>` tag or dynamic import to load the bundle from the GitHub Release asset URL.

| File | Purpose |
|------|---------|
| `loader_production.js` | Production loader — fetches from latest versioned release |
| `loader_dev.js` | Dev loader — fetches from the `dev` rolling release tag |
| `dev_loader.js` | Local dev convenience loader |
| `mobile_loader.js` | Mobile / parent-app loader |

---

## Gotchas

- **`gh` CLI required** — all upload steps call `gh release upload`. Ensure `gh` is authenticated before running any release script.
- **Must be on `main`** — the release script warns but does not block. Running a release from a feature branch will create a tag pointing at that branch's HEAD.
- **Version manifest is async** — `versions.json` is updated by GitHub Actions after the tag push, not during the release script. There is a short window after `release:*` completes where `versions.json` is stale.
- **Mobile bundle has no source map** — `deploy-dev.js` sets `sourcemap: false` for the mobile build even in dev mode.
