# Data Layer

`src/masteryOutlook/masteryOutlookState.js` · `src/masteryOutlook/masteryOutlookCacheService.js` · `src/masteryOutlook/masteryOutlookAvgService.js`

---

## Overview

The data layer has two distinct tiers:

- **In-memory transient state** (`masteryOutlookState.js`) — module-level `Set` and `Map` objects that track live UI state (spinners, in-flight operations). Never persisted; reset on page reload.
- **Persistent JSON cache** (`masteryOutlookCacheService.js`) — a single JSON file written to Canvas Files and read back at startup. The `masteryOutlookAvgService.js` reads from this cache at sync time to avoid repeating setup REST calls.

---

## In-Memory State — `masteryOutlookState.js`

All exports are module-level singletons. Import directly; never re-declare in individual files.

| Export | Type | Key format | Description |
|--------|------|-----------|-------------|
| `fetchingStudentIds` | `Set<string>` | `"outcomeId_studentId"` | In-flight per-student refresh operations. Guards against race between `outcomeRow.js` lazy fetch and the refresh button in `studentSyncTable.js`. |
| `syncingStudentIds` | `Set<string>` | `"outcomeId_studentId"` | In-flight score pushes. Written by `handleSyncStudents`; read by `buildOutcomeStudentRow` to show a per-row spinner. Always cleared in a `finally` block. |
| `syncStudentPhase` | `Map<string, string>` | `"outcomeId_studentId"` → `'pushing' \| 'verifying'` | Tracks current phase for each key in `syncingStudentIds`. Advances as the state machine progresses so the row UI can distinguish "Pushing…" from "Verifying…". |
| `syncingOutcomeIds` | `Set<string>` | `"outcomeId"` | In-flight outcome-level syncs. Triggers the outcome chip "Checking…" / "Syncing…" banner. |
| `syncingOutcomePhase` | `Map<string, string>` | `"outcomeId"` → `'checking' \| 'syncing'` | Held for the **entire** sync run so the chip doesn't flash "N need" between calculation and completion. Cleared alongside `syncingOutcomeIds`. |

> **Gotcha** — Because these are module-level, they are shared across all outcome rows and all calls for a given page load. Always clear entries in a `finally` block. A forgotten entry leaves a row stuck in the spinner state until page reload.

---

## Persistent Cache — `masteryOutlookCacheService.js`

### Cache file location

```
Canvas Files / MOREnet_CustomizedGradebook / mastery_outlook_cache / mastery_outlook_cache.json
```

Folders are created locked (`locked: true`, `hidden: false`) — unpublished so students cannot access them, but visible to teachers.

### Schema version

`SCHEMA_VERSION = '1.0'`. On read, `cache.metadata.schemaVersion` is compared. A mismatch returns `null` and discards the file (no migration — the caller must trigger a full Refresh Data).

---

### `ensureFolder(courseId, apiClient)` → `Promise<string>`

Returns the Canvas folder ID of `mastery_outlook_cache/`. Memoized per `courseId` — first call does up to 5 roundtrips (root folder, parent list/create, parent lock, subfolder list/create, subfolder lock); subsequent calls return immediately from `_cachedFolderIdByCourse`.

Invalidates its own memo on write failure so stale folder IDs don't persist across retry.

---

### `writeMasteryOutlookCache(courseId, apiClient, cacheData)` → `Promise<Object>`

Persists the full cache object to Canvas Files via a 3-step upload protocol:

1. **Request upload URL** — `POST /api/v1/courses/:id/files` with `on_duplicate: 'overwrite'`
2. **Upload** — multipart `POST` to the presigned S3-style `upload_url`
3. **Lock file** — `PUT /api/v1/files/:id` with `locked: true, hidden: false`

Always stamps `metadata.schemaVersion` before writing.

**Throws** on any step failure. Invalidates the folder memo so the next call re-discovers the folder ID.

---

### `readMasteryOutlookCache(courseId, apiClient)` → `Promise<Object|null>`

Returns the parsed cache or `null` if:
- File not found
- Schema version mismatch
- Invalid JSON (corrupted file)

Treats all read errors as "no cache" — never throws.

---

### `readPLAssignments(courseId, apiClient)` → `Promise<Object>`

Returns `cache.pl_assignments` or `{}`. Shape:
```js
{
  [outcomeId]: {
    assignment_id,
    rubric_id,
    rubric_association_id,
    criterion_id,
    submission_ids: { [userId]: submissionId }
  }
}
```

---

### `writePLAssignments(courseId, plAssignments, apiClient)` → `Promise<Object>`

Read-before-write merge: reads the current cache, sets `pl_assignments`, writes back. If no cache exists yet, creates a minimal placeholder so other fields are not lost.

---

### `readSyncState(courseId, apiClient)` → `Promise<Object>`

Returns `cache.sync_state` or `{}` (never `null`). Shape:
```js
{
  [outcomeId]: {
    [studentId]: {
      status,
      last_synced_score,
      last_synced_at,
      manual_override,       // true if teacher manually edited Canvas after last PL push
      will_post,             // teacher-set score override (null = track Marzano)
      will_post_lock,        // 'locked' | 'unlocked' | undefined
      will_post_note,        // pending teacher note text
      will_post_note_last_submitted,  // note text as last sent to Canvas
      verify_mismatch,       // true if Canvas didn't confirm score after all retries
      avg_verify_at,         // ISO timestamp of avg assignment verification
      avg_verify_mismatch    // true if avg assignment verify found a mismatch
    }
  }
}
```

---

### `writeSyncState(courseId, syncState, apiClient, baseCache?)` → `Promise<Object>`

Read-before-write merge. Pass the **full** `sync_state` object. Callers that need to update a single student entry should `readSyncState` first, mutate in place, then call this.

`baseCache` (optional): pass an already-loaded cache object to skip the read roundtrip (~600 ms saved). Caller must ensure the cache is fresh enough that other fields won't be clobbered.

---

### `readIgnoredAlignments(courseId, apiClient)` → `Promise<Array>`

Returns `cache.ignored_alignments` or `[]`. Shape:
```js
[{ student_id, outcome_id, alignment_id, reason, ignored_by, ignored_at, comment_posted }]
```

---

### `readAvgAssignment(courseId, apiClient)` → `Promise<Object|null>`

Returns `cache.avg_assignment` or `null` if not yet set up. Shape:
```js
{
  assignment_id,
  rubric_id,
  rubric_association_id,
  criterion_id,
  avg_outcome_id,
  submission_ids: { [userId]: submissionId },
  created_at
}
```

---

## Avg Assignment Service — `masteryOutlookAvgService.js`

### Purpose

After a Marzano score push, updates the "Current Score" (average) assignment for affected students. Always a best-effort, silent-fail operation — the Marzano sync has already succeeded before this runs.

---

### `updateAvgAssignmentForStudents(opts)` → `Promise<boolean>`

| Option | Type | Description |
|--------|------|-------------|
| `courseId` | `string` | |
| `outcomeId` | `string` | The outcome that was just synced |
| `outcomeName` | `string` | Used to prefix the submission comment |
| `studentIds` | `string[]` | Students whose scores were updated |
| `notes` | `{ [studentId]: string }` | Teacher note text per student |
| `cache` | `Object` | In-memory Mastery Outlook cache |
| `apiClient` | `CanvasApiClient` | |

Returns `true` if all batch calls succeeded, `false` if any failed or setup was missing. Never throws.

**8-step flow:**

| Step | What happens |
|------|-------------|
| 1 | Read `avg_assignment` from in-memory cache; abort if missing (teacher must run Refresh Data) |
| 2 | `GET /api/v1/courses/:id/outcome_rollups` for fresh Canvas averages |
| 3 | `calculateStudentAverages(rollup, avg_outcome_id)` — only students whose avg changed are returned |
| 4 | `getAllEnrollmentIds(courseId, apiClient)` — memory-cached after first call |
| 5 | Build batch params: `points`, `comment`, `enrollmentId`/`overrideScore` if enrollment found |
| 6 | `submitRubricAssessmentBatch(students, apiClient, { concurrency: 3, maxAttempts: 2 })` |
| 7 | Mark notes as submitted (`will_post_note_last_submitted`), run `refreshMasteryForAssignment`, persist cache |
| 8 | Verify avg scores via polling loop (no-progress-in-50-polls exit); persist `avg_verify_at` / `avg_verify_mismatch` |

**Comment format:**

- With note: `"<outcomeName> Score updated: <plScore>, Note: <noteText> | <AVG_OUTCOME_NAME> updated: <avg>"`
- Without note: `"<outcomeName> Score updated: <plScore> | <AVG_OUTCOME_NAME> updated: <avg>"`

> **Gotcha — `outcome_rollups` ignores `user_ids[]`**: Canvas returns 400 if you pass `user_ids[]` to the rollup endpoint. The service fetches all students and filters in JavaScript.

> **Gotcha — notes for unchanged averages**: Students with a pending note but no average change are handled separately via `postNoteToAvgAssignment` (see below). The main batch only runs for students whose average actually changed.

---

### `postNoteToAvgAssignment(opts)` → `Promise<boolean>`

Posts a submission comment on the Current Score assignment for students whose average **did not** change but who have a pending note.

Uses the **Canvas REST submissions API** (`PUT /api/v1/courses/:id/assignments/:id/submissions/:userId`) rather than GraphQL. GraphQL rubric mutations always write criterion data; this REST endpoint posts a comment without touching the rubric score or grade override.

After posting, marks `will_post_note_last_submitted` in the in-memory cache and persists to disk.

Returns `true` if all comments posted, `false` if any failed. Never throws.

---

## Gotchas

- **Schema version mismatch discards all data** — there is no migration path. If `SCHEMA_VERSION` is bumped, all existing caches are silently dropped and the teacher must run Refresh Data.
- **`writeSyncState` is a full-file overwrite** — always read-before-write. If two code paths call `writeSyncState` concurrently (rare but possible), one write will overwrite the other's data. The design assumes serialized writes.
- **`ensureFolder` memo survives the page session** — if a teacher deletes the Canvas folder mid-session, the memo returns the stale folder ID and writes fail. The error handler calls `invalidateFolderCache` so the next attempt re-discovers, but the first write attempt throws.
- **Avg verify polling** uses a no-progress counter (50 polls at 5 s = ~4 min max). A stuck verification emits a detailed log warning with recovery instructions but does not block the sync completion status.
