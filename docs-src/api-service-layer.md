# API Service Layer

`src/utils/canvasApiClient.js` · `src/services/enrollmentService.js` · `src/services/gradeOverride.js` · `src/services/outcomeService.js` · `src/services/gradeCalculator.js`

---

## Overview

All network communication with Canvas goes through `CanvasApiClient`. Domain-specific services (enrollment, grade override, outcome, grade calculation) are thin wrappers that call the client, add business logic, and return normalized data structures.

---

## `CanvasApiClient`

The central HTTP client. Handles CSRF authentication, `per_page=100` injection, Link-header pagination, and JSON serialization.

### Constructor

```js
const apiClient = new CanvasApiClient();
```

Reads `_csrf_token` from `document.cookie` at construction time and caches it for the lifetime of the instance. **Throws** if the cookie is not found (user not authenticated).

> **Design note** — Canvas accepts previously-issued CSRF tokens even after cookie rotation. Caching once at construction is intentional and tested. See `documents/CSRF-TOKEN-DECISION.md` for the full analysis.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `(url, options?, context?) → Promise<any>` | Single-page GET. Automatically appends `per_page=100` if absent. |
| `getAllPages` | `(url, options?, context?) → Promise<any[]>` | Paginated GET. Follows `Link: rel="next"` headers until exhausted. Returns combined array. |
| `getWithResponse` | `(url, options?, context?) → Promise<Response>` | Returns the raw `Response` object so callers can read headers (e.g. `Link: rel="last"` for parallel pagination). Body is **not** parsed. |
| `post` | `(url, data, options?, context?) → Promise<any>` | POST with JSON body. Injects `authenticity_token` into JSON bodies automatically. |
| `put` | `(url, data, options?, context?) → Promise<any>` | PUT with JSON body. Same token injection as `post`. |
| `delete` | `(url, options?, context?) → Promise<any>` | DELETE request. |
| `graphql` | `(query, variables?, context?) → Promise<any>` | POST to `/api/graphql` with `Content-Type: application/json`. |

**`context` parameter** — passed to `safeFetch`/`safeJsonParse` for error log attribution. Use a unique, descriptive string (e.g. `'fetchCourseStudents'`) so errors in logs can be traced to the specific call site.

**CSRF injection** — For JSON bodies, `authenticity_token` is added if not already present. For non-JSON bodies (e.g. CSV for outcome imports), data is passed as-is.

**`getAllPages` object response** — if a paginated endpoint returns a JSON object instead of an array on the first page (e.g. `final_grade_overrides`), `getAllPages` returns that object immediately without following pagination.

> **Gotcha** — `get()` adds `per_page=100` automatically. If you need a different page size, include `per_page=N` in the URL before calling `get()`.

---

## `enrollmentService.js`

### `fetchAllEnrollments(apiClient, options?)` → `Promise<Array>`

Fetches `StudentEnrollment` and `ObserverEnrollment` for the current user (`/api/v1/users/self/enrollments`).

| Option | Default | Description |
|--------|---------|-------------|
| `state` | `'active'` | Enrollment state filter |
| `includeTotalScores` | `true` | Adds `include[]=total_scores` to request |

Returns empty array on failure (never throws).

---

### `fetchSingleEnrollment(courseId, apiClient)` → `Promise<Object|null>`

Returns the first matching student or observer enrollment for the current user in a specific course. Handles both `StudentEnrollment` and `ObserverEnrollment` (observer must have `associated_user_id`).

Returns `null` if not found or on error.

---

### `fetchCourseStudents(courseId, apiClient)` → `Promise<Array>`

Teacher-facing. Uses `getAllPages` to handle courses with more than 100 students.

Returns:
```js
[{ userId: string, name: string, sortableName: string, sectionId: string }]
```

Normalizes `user.name`, `user.short_name`, `user.sortable_name` with graceful fallbacks.

---

### `fetchObservedStudents(courseId, observerEnrollments, apiClient)` → `Promise<Array>`

Returns observed students for a parent (observer) in a course. Fetches all observees via `/api/v1/users/self/observees`, then cross-references with `observerEnrollments` to determine which are enrolled in the target course.

Returns the same `{ userId, name, sortableName, sectionId }` shape as `fetchCourseStudents`.

---

### `fetchCourseSections(courseId, apiClient)` → `Promise<Array>`

Returns `[{ id: string, name: string }]` sorted alphabetically by name.

---

### `parseEnrollmentGrade(enrollmentData)` → `{ score, letterGrade, customGradeStatusId, overrideScore } | null`

Normalizes the two Canvas grade structures (nested `grades` object vs. top-level `computed_*` fields). Returns `null` if no grade data is found.

| Return field | Source priority |
|-------------|----------------|
| `score` | `grades.current_score` → `grades.final_score` → `computed_current_score` → … |
| `letterGrade` | `grades.current_grade` → `grades.final_grade` → `computed_current_grade` → … |
| `customGradeStatusId` | `grades.customGradeStatusId` |
| `overrideScore` | `grades.override_score` |

---

### `extractEnrollmentData(enrollments)` → `Map<string, { percentage, letterGrade }>`

Converts an enrollments array to a `Map<courseId, { percentage, letterGrade }>`. Calls `parseEnrollmentGrade` on each entry. Note: maps `score` → `percentage` for backward compatibility with existing code.

---

## `gradeOverride.js`

### `getAllEnrollmentIds(courseId, apiClient)` → `Promise<Map<string, string>>`

Returns a `Map<userId, enrollmentId>` for all student enrollments in a course. Paginated via `getAllPages`. Memoized per course in `__enrollmentMapCache` (module-level `Map`). Subsequent calls for the same course return immediately.

---

### `getEnrollmentIdForUser(courseId, userId, apiClient)` → `Promise<string|null>`

Thin wrapper around `getAllEnrollmentIds`. Returns the enrollment ID for one user, or `null` if not found.

---

### `setOverrideScoreGQL(enrollmentId, overrideScore, apiClient)` → `Promise<number|null>`

Runs the `setOverrideScore` GraphQL mutation directly. Returns the applied override score or `null`. **Throws** on GraphQL errors.

`overrideScore` is on the 0–100 percentage scale (pass through `OVERRIDE_SCALE(average)` before calling).

---

### `queueOverride(courseId, userId, average, apiClient)` → `Promise<void>`

Combines enrollment lookup and override mutation in one call. No-op if `ENABLE_GRADE_OVERRIDE` is `false`. Silent fail — logs warnings, never throws. Used during concurrent bulk grade submissions.

`average` is on the 0–4 Marzano scale; the function applies `OVERRIDE_SCALE` internally.

---

## `outcomeService.js`

### `getRollup(courseId, apiClient)` → `Promise<Object>`

`GET /api/v1/courses/:id/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`

Returns the raw rollup response object (not paginated — relies on `per_page=100`).

---

### `getOutcomeObjectByName(data)` → `Object|null`

Searches `data.linked.outcomes` for an outcome whose `title` matches `AVG_OUTCOME_NAME` (from config). Returns the outcome object or `null`.

---

### `createOutcome(courseId, apiClient)` → `Promise<void>`

Creates the "Current Score" outcome via Canvas CSV import (`POST /api/v1/courses/:id/outcome_imports?import_type=instructure_csv`). Polls the import status every 2 s, up to 15 attempts (30 s total). Throws `TimeoutError` if import doesn't complete in time.

Generates a unique `vendor_guid` (`MOREnet_<8-char-random>`) to avoid Canvas name conflicts.

---

### `setOutcomeOrderWithAvgFirst(courseId, avgOutcomeId, apiClient, rollupData?)` → `Promise<void>`

Reorders outcomes in the Learning Mastery Gradebook to place `AVG_OUTCOME` first. Accepts pre-fetched `rollupData` to avoid an extra API call. Skips reordering if `AVG_OUTCOME` is already first. Non-critical — logs a warning and does not throw on failure.

Canvas expects `POST /api/v1/courses/:id/assign_outcome_order` with `X-Requested-With: XMLHttpRequest` and an array of `{ outcome_id, position }` objects (1-based positions).

---

## `gradeCalculator.js`

### `calculateStudentAverages(data, outcomeId, courseId, apiClient)` → `Promise<Array<{userId, average}>>`

The core grade calculation engine. Returns only students whose average has changed (or whose override grade needs updating).

**Exclusion rules (applied before averaging):**

1. The `outcomeId` outcome itself (the "Current Score" assignment — avoids circular calculation)
2. Any outcome whose title matches a keyword in `EXCLUDED_OUTCOME_KEYWORDS` (e.g. `"attendance"`)
3. Students with zero relevant scores are skipped entirely

**Update detection:**

| Mode | Config flag | Condition to include student |
|------|-------------|------------------------------|
| Outcome update | `ENABLE_OUTCOME_UPDATES` | `oldAverage !== newAverage` |
| Override update | `ENABLE_GRADE_OVERRIDE` | `|actual% - expected%| > 0.01` |

A student is included if either condition is true. If both flags are false, no students are returned.

**Returns** `[{ userId: string, average: number }]` where `average` is rounded to 2 decimal places.

---

### Shared helpers (also exported for `ieGradeCalculator.js`)

| Function | Description |
|----------|-------------|
| `buildOutcomeMap(data)` | Returns `{ [outcomeId]: title }` from `data.linked.outcomes` |
| `getCurrentOutcomeScore(scores, outcomeId)` | Finds score for a specific outcome in a rollup scores array |
| `getRelevantScores(scores, outcomeMap, excludedIds, excludedKeywords)` | Filters scores to only those that count toward the average |
| `computeAverage(scores)` | Mean of `score` values, rounded to 2 decimal places |

---

## Gotchas

- **`__enrollmentMapCache` is module-level** — it persists for the page session. If a teacher adds a student mid-session, the stale cache will not include them until the page is reloaded.
- **`outcome_rollups` does not support `user_ids[]`** — Canvas returns 400. Always fetch all students and filter in JavaScript. (See also the same gotcha in `masteryOutlookAvgService.js`.)
- **`getAllPages` returns early for object responses** — if the first page returns a JSON object instead of an array, pagination stops immediately and that object is returned. This is by design for endpoints like `final_grade_overrides`.
- **`createOutcome` uses a random `vendor_guid`** — each call generates a new GUID. If called twice before the first import completes, two outcomes may be created. Guard the call site against re-entry.
- **CSRF token caching** — the token is read once at `new CanvasApiClient()`. If Canvas rotates the cookie during a long session, the cached token remains valid (by empirical observation), but if authentication is lost entirely, all subsequent calls will fail with 401.
