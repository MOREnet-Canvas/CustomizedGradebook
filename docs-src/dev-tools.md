# Debug Tooling

`src/masteryOutlook/cgDevTools.js` · `src/utils/logger.js`

---

## Overview

The debug tooling layer consists of two pieces that work together:

- **`logger`** — a levelled logging utility that gates all `[DEBUG]` and `[TRACE]` output behind a runtime flag, available everywhere in the codebase.
- **`exposeCGDevTools()`** — a single function that, when debug mode is active, attaches a rich `window.__CG_DEV` namespace to the browser window so developers can introspect and drive the extension interactively from DevTools.

Both pieces are always included in the production bundle. Neither requires a separate dev build — everything is controlled at runtime.

---

## Activating Debug Mode

Three equivalent ways, in priority order (highest first):

| Method | How | Persists? |
|--------|-----|-----------|
| URL parameter | `?debug=true` or `?debug=trace` | Yes — written to `sessionStorage` |
| sessionStorage | `sessionStorage.setItem('cg_debug', 'true')` then reload | Until tab closes or manually cleared |
| Dev build | `ENV_DEV = true` at build time | Build only |

**Deactivate:**
```js
sessionStorage.removeItem('cg_debug');
location.reload();
// or navigate to any page with ?debug=false
```

---

## logger (`src/utils/logger.js`)

### Log levels

| Level | Value | When shown |
|-------|-------|------------|
| `TRACE` | `-1` | `?debug=trace` only |
| `DEBUG` | `0` | dev build or `?debug=true` |
| `INFO` | `1` | always |
| `WARN` | `2` | always |
| `ERROR` | `3` | always |

### Exports

#### `logger` (object)

| Method | Signature | Notes |
|--------|-----------|-------|
| `logger.trace(...args)` | `void` | High-frequency loops only; `[TRACE]` prefix, grey |
| `logger.debug(...args)` | `void` | Standard dev output; `[DEBUG]` prefix |
| `logger.info(...args)` | `void` | Always-on operational messages; `[INFO]` prefix |
| `logger.warn(...args)` | `void` | `console.warn`; `[WARN]` prefix |
| `logger.error(...args)` | `void` | `console.error`; `[ERROR]` prefix |
| `logger.isDebugEnabled()` | `boolean` | Guard used by `exposeCGDevTools()` |
| `logger.isTraceEnabled()` | `boolean` | Rarely needed outside of logger itself |
| `logger.getLogLevel()` | `number` | Returns the numeric level constant |

#### `logBanner(envName, buildVersion)` → `void`
Prints the startup banner to the console with environment and version info. Called once from the init layer on page load.

#### `exposeVersion(envName, buildVersion)` → `void`
Writes `window.CG = { env, version, traceEnabled, debugEnabled, logLevel }`. Useful for quick sanity checks from the DevTools console.

#### `log(...args)` → `void` *(deprecated)*
Alias for `logger.debug()`. Still present for backward compatibility; do not use in new code.

### Gotcha — log level is fixed at module load
`determineLogLevel()` runs exactly once when `logger.js` is first imported. Changing `sessionStorage` after the fact requires a page reload to take effect.

---

## exposeCGDevTools (`src/masteryOutlook/cgDevTools.js`)

### Purpose

Attaches `window.__CG_DEV` when `logger.isDebugEnabled()` returns `true`. The object is a curated set of pre-wired handles into the extension's internal modules, so a developer can inspect state, drive syncs, and test individual functions without reloading the page or modifying source.

### Call site

```js
// src/customGradebookInit.js (called after all modules load)
import { exposeCGDevTools } from './masteryOutlook/cgDevTools.js';
exposeCGDevTools();
```

### `exposeCGDevTools()` → `void`

No-op when debug mode is not active. Otherwise, populates `window.__CG_DEV` and prints a collapsed help group to the console.

### `window.__CG_DEV` namespace

| Property | Type | Description |
|----------|------|-------------|
| `apiClient` | `CanvasApiClient` | Pre-constructed instance, CSRF token already cached |
| `courseId` | `string \| null` | Current course ID from URL; `null` on non-course pages |
| `readCache()` | `() => Promise<Object>` | Read `mastery_outlook_cache.json` from Canvas Files |
| `writeCache(cache)` | `(Object) => Promise<void>` | Write cache back to Canvas Files |
| `readPLAssignments()` | `() => Promise<Object>` | Read `pl_assignments` section from cache |
| `writePLAssignments(pl)` | `(Object) => Promise<void>` | Write `pl_assignments` section |
| `runPLSync(opts)` | `(opts) => Promise<Object>` | Run the full PL sync for one outcome (see below) |
| `checkSyncNeeded(outcomeId)` | `(string) => Promise<Object>` | Returns `{ hasSetup, predictionCount }` |
| `resetOutcomeScoresToZero()` | `() => Promise<void>` | Interactive dev utility — lists outcomes, prompts for ID, zeros all students |
| `powerLawPredict(scores)` | `(number[]) => number` | Raw power-law prediction from score array |
| `computeStudentOutcome(scores)` | `(number[]) => Object` | Full computed object: `{ status, plPrediction, … }` |
| `PL_STATES` | `Object` | State machine state constants (all valid state names) |
| `config` | `Object` | Current `window.CG_CONFIG` |

### `runPLSync` options

```js
await __CG_DEV.runPLSync({
  outcome:       { id: '598', title: 'Outcome 1' },  // required
  onProgress:    (state, name, msg, done, total) => console.log(state, msg),
  targetUserIds: ['1234', '5678'],   // optional — omit to sync all students
})
```

### `resetOutcomeScoresToZero()` detail

Interactive-only utility (uses `console.table`, `prompt`, and `confirm`). Steps:

1. Loads the in-memory cache from Canvas Files
2. Prints the full outcome list via `console.table`
3. Prompts for an outcome ID
4. Validates the outcome exists **and** `pl_assignments` is set up for it
5. Confirms before writing
6. Pushes score `0` to every student via `submitRubricAssessmentBatch` (concurrency 5, 3 retries)
7. Clears `last_synced_score` / `last_synced_at` in `sync_state` — does **not** set `manual_override`

> **Gotcha** — This writes to Canvas. Run sync immediately after to restore PL predictions.

---

## Quick-reference cheat sheet

```js
// Inspect cache
const cache = await __CG_DEV.readCache()
cache.students.find(s => s.id === '642')

// Force full sync for one outcome
await __CG_DEV.runPLSync({ outcome: { id: '598', title: 'Outcome 1' } })

// Check if an outcome has been set up (assignment + rubric created)
await __CG_DEV.checkSyncNeeded('598')
// → { hasSetup: true, predictionCount: 24 }

// Test the power law algorithm in isolation
__CG_DEV.powerLawPredict([2, 2.5, 3, 3.5])  // → predicted next score
__CG_DEV.computeStudentOutcome([2, 2.5, 3])  // → { status, plPrediction, … }

// Deactivate debug mode
sessionStorage.removeItem('cg_debug'); location.reload();
```
