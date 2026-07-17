# State Machine

`src/masteryOutlook/plOutlookStateMachine.js` · `src/masteryOutlook/plOutlookStateHandlers.js` · `src/masteryOutlook/plOutlookSync.js` · `src/masteryOutlook/plOutlookActions.js`

---

## Overview

The PL Outlook sync feature is built around a per-outcome state machine that drives the process of pushing Power Law predicted scores back to Canvas. One `PLOutlookStateMachine` instance is created per `runPLSync()` call — it is not a singleton.

The design deliberately mirrors `src/gradebook/stateMachine.js` (the gradebook UpdateFlow machine) with the same `transition/context/event` API, `on()`/`emit()` event system, and `getStateHistory()`/`reset()` shape. The key differences: it is scoped to a single outcome, uses the mastery outlook cache for setup detection, and reports progress via an `onProgress` callback rather than a floating banner.

---

## States and transitions

```
IDLE
  └─▶ CHECKING_SETUP
        ├─▶ CREATING_ASSIGNMENT ──▶ CHECKING_STUDENTS ─┐
        │                       └─▶ COMPLETE            │
        └─▶ CHECKING_STUDENTS ◀────────────────────────┘
              ├─▶ FETCHING_SUBMISSIONS ──▶ CALCULATING_CHANGES
              └─▶ CALCULATING_CHANGES
                    ├─▶ SYNCING ──▶ VERIFYING ──▶ COMPLETE
                    └─▶ COMPLETE  (zero updates)
                    └─▶ ERROR
      (any state) ──▶ ERROR ──▶ IDLE
      COMPLETE ──▶ IDLE
```

| State | Exported constant | What happens |
|-------|-------------------|-------------|
| `IDLE` | `PL_STATES.IDLE` | Start/end state. Machine idles between runs. |
| `CHECKING_SETUP` | `PL_STATES.CHECKING_SETUP` | Reads `pl_assignments` from cache. Fast-path: if entry exists, skip setup. |
| `CREATING_ASSIGNMENT` | `PL_STATES.CREATING_ASSIGNMENT` | One-time per-outcome: set outcome to `latest`, create assignment + rubric, cache submission IDs. |
| `CHECKING_STUDENTS` | `PL_STATES.CHECKING_STUDENTS` | Fetches active enrollment, filters departed students, detects new students. |
| `FETCHING_SUBMISSIONS` | `PL_STATES.FETCHING_SUBMISSIONS` | Fetches submission records for students who joined after initial setup. |
| `CALCULATING_CHANGES` | `PL_STATES.CALCULATING_CHANGES` | Compares PL predictions vs Canvas rollup scores. Builds sync list. |
| `SYNCING` | `PL_STATES.SYNCING` | Batch-pushes scores via GraphQL. Updates `last_synced_score` in `sync_state`. |
| `VERIFYING` | `PL_STATES.VERIFYING` | Re-fetches rollups and confirms scores match. Polls until no progress or convergence. |
| `COMPLETE` | `PL_STATES.COMPLETE` | Reports outcome. Transitions back to `IDLE`. |
| `ERROR` | `PL_STATES.ERROR` | Catches thrown errors. Logs and transitions to `IDLE`. |

---

## `PLOutlookStateMachine` class

**File:** `src/masteryOutlook/plOutlookStateMachine.js`

### Constructor

```js
new PLOutlookStateMachine(initialContext)
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `courseId` | `string` | Yes | Canvas course ID |
| `outcomeId` | `string` | Yes | Canvas outcome ID |
| `outcomeName` | `string` | Yes | Human-readable name for UI/logging |
| `apiClient` | `CanvasApiClient` | Yes | Pre-constructed API client |
| `onProgress` | `Function` | No | `(state, outcomeName, message, done, total) => void` |
| `targetUserIds` | `string[] \| null` | No | Limit sync to specific students; `null` = all |
| `setupOnly` | `boolean` | No | Stop after `CREATING_ASSIGNMENT` — no score push |
| `cachedPLEntry` | `Object \| null` | No | In-memory `pl_assignments` entry; skips disk read in `CHECKING_SETUP` |
| `plScoreOverrides` | `Object \| null` | No | `{ [userId]: plScore }` — in-memory predictions after ignore/recompute |
| `canvasScoreOverrides` | `Object \| null` | No | `{ [userId]: canvasScore }` — skips rollup re-fetch in `CALCULATING_CHANGES` |

Context fields populated during the run:

| Field | Populated by | Type |
|-------|-------------|------|
| `assignmentId` | `CHECKING_SETUP` | `string` |
| `rubricId` | `CHECKING_SETUP` | `string` |
| `rubricAssociationId` | `CHECKING_SETUP` | `string` |
| `rubricCriterionId` | `CHECKING_SETUP` | `string` |
| `submissionIdByUserId` | `CHECKING_SETUP` / `FETCHING_SUBMISSIONS` | `Map<userId, submissionId>` |
| `activeUserIds` | `CHECKING_STUDENTS` | `Set<string>` |
| `effectiveTargetIds` | `CHECKING_STUDENTS` | `Set<string>` |
| `studentsToSync` | `CALCULATING_CHANGES` | `Array<{userId, submissionId, rubricAssociationId, rubricCriterionId, points, score, plScore, canvasScore, will_post_note}>` |
| `numberOfUpdates` | `CALCULATING_CHANGES` | `number` |
| `successCount` | `SYNCING` | `number` |
| `errors` | `SYNCING` | `Array` |
| `verifyMismatches` | `VERIFYING` | `Array` |

### Methods

| Method | Returns | Notes |
|--------|---------|-------|
| `getCurrentState()` | `string` | Current `PL_STATES.*` value |
| `getContext()` | `Object` | Shallow copy of context — safe to read, do not mutate |
| `updateContext(updates)` | `void` | Merges `updates` into context |
| `getStateHistory()` | `string[]` | Ordered list of all states visited |
| `canTransition(toState)` | `boolean` | Checks valid transition map |
| `transition(toState, contextUpdates)` | `void` | Throws if transition is invalid |
| `progress(message, done, total)` | `void` | Calls `onProgress` if set |
| `on(event, callback)` | `void` | Subscribe to `'stateChange'` or `'reset'` events |
| `emit(event, data)` | `void` | Called internally by `transition()` and `reset()` |
| `reset()` | `void` | Resets to `IDLE`, clears history, emits `'reset'` |

---

## State handlers (`plOutlookStateHandlers.js`)

Each handler receives `sm` (the `PLOutlookStateMachine` instance), performs its work via `sm.getContext()` / `sm.updateContext()`, and **returns the next `PL_STATE`** to transition to.

| Export | Next state(s) returned |
|--------|------------------------|
| `handleCheckingSetup(sm)` | `CHECKING_STUDENTS` (cached) or `CREATING_ASSIGNMENT` (first run) |
| `handleCreatingAssignment(sm)` | `CHECKING_STUDENTS` or `COMPLETE` (if `setupOnly`) |
| `handleCheckingStudents(sm)` | `FETCHING_SUBMISSIONS` (new students) or `CALCULATING_CHANGES` |
| `handleFetchingSubmissions(sm)` | `CALCULATING_CHANGES` |
| `handleCalculatingChanges(sm)` | `SYNCING` or `COMPLETE` (zero updates) |
| `handleSyncing(sm)` | `VERIFYING` |
| `handleVerifying(sm)` | `COMPLETE` |
| `handleComplete(sm)` | `IDLE` |
| `handleError(sm)` | `IDLE` |

### `PL_STATE_HANDLERS` registry

```js
export const PL_STATE_HANDLERS = {
  [PL_STATES.CHECKING_SETUP]:       handleCheckingSetup,
  [PL_STATES.CREATING_ASSIGNMENT]:  handleCreatingAssignment,
  // …all states mapped
};
```

Used by `runPLSync()` to dispatch to the correct handler.

### Key handler details

#### `handleCreatingAssignment` — one-time setup

1. Checks if a PL assignment already exists in Canvas (`findExistingPLAssignment`) — adopts it if found rather than creating a duplicate.
2. Sets `calculation_method: 'latest'` on the outcome so PL overrides always win.
3. Creates an assignment with `only_visible_to_overrides: false` (briefly visible to generate submission records), `grading_type: PL_GRADING_TYPE`, `omit_from_final_grade: true`.
4. Creates a rubric linked to the outcome with `OUTCOME_AND_RUBRIC_RATINGS` from `config.js`.
5. Waits **3 seconds** for Canvas to generate submission records, then fetches them all.
6. Flips assignment to `only_visible_to_overrides: true` — hides it from the assignments list.
7. Writes `pl_assignments[outcomeId]` into the cache.

> **Gotcha** — Grading type cannot be changed on an assignment that already has submissions. Pre-existing (adopted) assignments keep their original `grading_type`.

#### `handleCalculatingChanges` — fast-path (#54)

When `canvasScoreOverrides` is provided (populated by `handleSyncStudents` from in-memory `canvasScore`), the handler skips the `/outcome_rollups` re-fetch entirely. `VERIFYING` still re-fetches rollups post-push as a backstop.

Scores that already match (within `scoresMatch()` tolerance) are silently skipped. Students with `manual_override: true` in `sync_state` are always skipped.

Score resolution order:
1. `will_post` (teacher-set explicit value) — used as-is, not rounded
2. `plScoreOverrides[userId]` (in-memory after ignore/recompute) — rounded to nearest 0.5
3. `plPrediction` from disk cache — rounded to nearest 0.5

#### `handleVerifying` — polling loop

Polls `/outcome_rollups` every 5 seconds. Stops when:
- All scores match (`mismatches.length === 0`), or
- No progress for 50 consecutive polls (`noProgressCount >= noProgressLimit`).

> **Gotcha** — `outcome_rollups` does not support `?page=N`. Must follow `Link: rel="next"` header cursors. `apiClient.getAllPages()` exits after page 1 on this endpoint — use `getWithResponse()` + manual cursor loop.

---

## Run orchestrator (`plOutlookSync.js`)

### `runPLSync(opts)` → `Promise<Result>`

The main public entry point. Creates a `PLOutlookStateMachine`, wires it to `PL_STATE_HANDLERS`, and drives the run loop.

```js
const result = await runPLSync({
  courseId, outcomeId, outcomeName, apiClient,
  onProgress: (state, outcomeName, msg, done, total) => { /* update UI */ },
  targetUserIds: ['642'],   // optional — omit for all students
  setupOnly: false,
});
// result: { success, successCount, errors, stateHistory }
```

| Return field | Type | Description |
|-------------|------|-------------|
| `success` | `boolean` | `true` if `ERROR` state was never entered |
| `successCount` | `number` | Students successfully pushed |
| `errors` | `Array` | Permanent push failures |
| `stateHistory` | `string[]` | All states visited in order |

The run loop:
1. Transitions to `CHECKING_SETUP`.
2. Calls `PL_STATE_HANDLERS[currentState](sm)` — each handler returns the next state.
3. Unhandled errors in a handler trigger a transition to `ERROR`.
4. Loop exits when state is `IDLE` or `ERROR`.
5. Calls `sm.reset()` before returning.

### `checkSyncNeeded(opts)` → `Promise<StatusCounts>`

Read-only pre-flight. Reads cache, `pl_assignments`, and `sync_state` — no Canvas API writes.

```js
const info = await checkSyncNeeded({ courseId, outcomeId, apiClient });
// → { hasSetup, predictionCount, total, synced, needsSync, possibleOverride,
//     manualOverride, ne, notSetup }
```

### `runPLSyncForAllOutcomes(opts)` → `Promise<Result[]>`

Runs `runPLSync` sequentially for every outcome in the cache. Returns an array of per-outcome results. No parallelism — outcomes are processed one at a time.

---

## Actions layer (`plOutlookActions.js`)

Teacher-initiated actions that mutate `sync_state` and trigger cache writes. All actions share a common signature:

```js
{ courseId, outcomeId, studentId, cache, apiClient, onRerender, ...actionSpecific }
```

When `cache` is provided (normal UI path): mutates in-memory, fires `onRerender()` immediately for instant feedback, schedules a debounced background write (800 ms trailing edge). Without `cache`: synchronous read-modify-write.

| Export | What it does |
|--------|-------------|
| `handleConfirmOverride` | Sets `manual_override: true` — Canvas score wins on next sync |
| `handleDismissOverride` | Clears `manual_override`, clears `last_synced_score`, immediately re-pushes PL prediction via `runPLSync` |
| `handleRevertOverride` | Alias of `handleDismissOverride` — shown as "Revert to PL" in the UI |
| `handleSetWillPost` | Sets `will_post + will_post_lock + note` — explicit teacher score |
| `handleClearWillPost` | Clears all `will_post` fields |
| `handleMarzanoPillClick` | Clears `will_post + will_post_lock`; preserves note |
| `handleCanvasPillClick` | Sets `will_post = canvasScore, will_post_lock = 'unlocked'` |
| `handleCustomValueTyped` | Sets `will_post = value`; promotes lock to `'unlocked'` unless already `'locked'` |
| `handleLockWillPost` | Sets `will_post_lock = 'locked'` |
| `handleUnlockWillPost` | Sets `will_post_lock = 'unlocked'` |
| `handleNoteChanged` | Synchronous; updates `will_post_note` and schedules cache write |
| `handleSyncStudents` | Orchestrates a full sync for one outcome + specific students; updates `canvasScore` in-memory post-sync |
| `handleIgnoreAlignment` | Adds to `cache.ignored_alignments`, recomputes PL projection locally |
| `handleUnignoreAlignment` | Removes from `cache.ignored_alignments`, recomputes PL projection locally |
| `handleOverrideCurrentScore` | Writes `current_score_overrides[studentId]` |
| `handleClearCurrentScoreOverride` | Removes from `current_score_overrides` |
| `initWriteScheduler(cache)` | Seeds the dedupe baseline after initial cache load — prevents a false "no change" skip on the first write |
| `flushCacheWrite(courseId, cache, apiClient)` | Immediately flushes any pending debounced write — called before `runPLSync` so disk is up to date |

### `will_post_lock` values

| Value | Meaning |
|-------|---------|
| `'none'` | No teacher override; use PL prediction |
| `'unlocked'` | Teacher has set a score but allows it to be overwritten by future PL syncs |
| `'locked'` | Teacher has locked the score; PL sync will not overwrite it |

### Debounced write mechanism

- `scheduleCacheWrite` uses a 800 ms trailing-edge timer. Multiple rapid mutations coalesce into a single write.
- `flushCacheWrite` cancels the timer and writes immediately. Safe to call when nothing is pending.
- A snapshot of `sync_state`, `ignored_alignments`, and `current_score_overrides` is compared before writing — if unchanged, the write is skipped.
- `_writeInFlight` prevents concurrent writes by polling every 50 ms until the in-flight write settles.

---

## Gotchas

- **One machine per sync call** — `PLOutlookStateMachine` is constructed fresh each time. Do not reuse an instance across outcomes or sync runs.
- **`setupOnly: true` stops after `CREATING_ASSIGNMENT`** — use for the Initialize flow so teachers can review predictions before the first push. The assignment exists in Canvas but no scores are posted.
- **`findExistingPLAssignment` safeguard** — prevents duplicate assignments on retry. If an assignment with the expected name suffix already exists in Canvas, it is adopted rather than creating a second one.
- **3-second delay in `CREATING_ASSIGNMENT` and `FETCHING_SUBMISSIONS`** — Canvas needs time to generate submission records after an assignment becomes visible. If the delay is insufficient (e.g. large rosters), some students may be missing from the initial submission map and will be picked up in `FETCHING_SUBMISSIONS` on the next sync.
- **`ignore/unignore` are in-memory only** — no Canvas API call, no cache file write. The teacher must explicitly sync to push the recomputed prediction.
