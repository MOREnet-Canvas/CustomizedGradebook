# PL Sync State & Teacher Override — Design Specification
**For:** Augment Code  
**Date:** April 2026  
**Relates to:** `src/masteryOutlook/` — PL sync feature  
**No legacy code to consider** — this is a greenfield feature.

---

## Implementation Notes (Read First)

**`possibleManualOverride` vs `manual_override` — critical distinction:**
- `possibleManualOverride` is stored in the **main cache** (`mastery_outlook_cache.json` under `student.outcomes[n]`). It is temporary and derived — recomputed on every Refresh Data by comparing `canvasScore` vs `last_synced_score`. It is never written to `sync_state`.
- `manual_override` lives in **`sync_state`** (permanent, teacher-confirmed). It is only set when a teacher explicitly clicks "Confirm override". Refresh Data never sets it.

Augment must not conflate these two. `possibleManualOverride` is a UI hint derived from data. `manual_override` is a permanent teacher decision.

**`plOutlookActions.js` is the key new file:**
The view never orchestrates multi-step chains directly. The view calls a single function like `handleIgnoreAlignment(studentId, outcomeId, alignmentId, reason)` and `plOutlookActions.js` handles everything downstream — recalculate, sync, update Current Score, post comment, re-render. This keeps the view layer clean.

**`last_synced_score` for new students:**
When `FETCHING_SUBMISSIONS` runs for a student who has never been synced, and their first sync completes via `handleSyncing`, that handler must write `last_synced_score` and `last_synced_at` to `sync_state` for the first time — same as for existing students. There is no special case needed; `handleSyncing` already writes sync state for every student it processes.

**Score comparison — no threshold:**
Score comparison uses exact match rounded to 2 decimal places, matching the existing `scoresMatch` helper already in `plOutlookStateHandlers.js`:
```javascript
const scoresMatch = (a, b) => Math.round(a * 100) === Math.round(b * 100)
```
There is no `SYNC_THRESHOLD`. A score either matches or it doesn't. This applies to:
- Deciding whether a student needs sync (`CALCULATING_CHANGES`)
- Detecting a possible manual override (Refresh Data step 8)
- Verifying scores after sync (`VERIFYING`)

**Assignment naming:**
PL override assignments are named `${outcomeName} — ${PL_ASSIGNMENT_SUFFIX}` where `PL_ASSIGNMENT_SUFFIX` comes from `config.js` (default: `'Projected Score'`). Grades auto-post — no `post_manually` setting is used. Students and teachers see the same scores in the Learning Mastery Gradebook.

---

## 1. Overview

The Mastery Outlook displays two scores per student per outcome:
- **Canvas Score** — what Canvas currently shows in the Learning Mastery Gradebook (source of truth for students and teachers — they must always match)
- **PL Pred.** — what the Power Law algorithm calculated from assessment history

Teachers need to see both, understand why they differ, and take action. This spec defines the data model, the four sync status states, and every teacher interaction that modifies the cache or Canvas.

---

## 2. Cache Structure — Complete Schema

All PL sync data lives in `mastery_outlook_cache.json` alongside the existing `outcomes`, `students`, and `metadata` sections. There is no separate file.

```json
{
  "metadata": { ... },
  "outcomes": [ ... ],
  "students": [ ... ],

  "pl_assignments": {
    "598": {
      "assignment_id": 3595,
      "rubric_id": 1434,
      "rubric_association_id": "2651",
      "criterion_id": "_1024",
      "submission_ids": {
        "642": "26049",
        "643": "26050",
        "644": "26051",
        "645": "26052",
        "646": "26053"
      },
      "created_at": "2026-04-22T15:54:55.934Z"
    }
  },

  "sync_state": {
    "598": {
      "642": {
        "last_synced_score": 4.0,
        "last_synced_at": "2026-04-22T09:00:00Z",
        "manual_override": false,
        "override_score": null,
        "override_reason": null,
        "override_comment_posted": false,
        "override_by": null,
        "override_at": null
      },
      "643": {
        "last_synced_score": 2.65,
        "last_synced_at": "2026-04-22T09:00:00Z",
        "manual_override": true,
        "override_score": 3.5,
        "override_reason": "Demonstrated mastery verbally",
        "override_comment_posted": true,
        "override_by": "teacher_julia",
        "override_at": "2026-04-22T10:15:00Z"
      }
    }
  },

  "ignored_alignments": [
    {
      "student_id": "642",
      "outcome_id": "598",
      "alignment_id": "assignment_3475",
      "reason": "Absent that day",
      "ignored_by": "teacher_julia",
      "ignored_at": "2026-04-22T09:30:00Z",
      "comment_posted": true
    }
  ],

  "current_score_overrides": {
    "642": {
      "score": 3.2,
      "reason": "End of semester adjustment",
      "override_by": "teacher_julia",
      "override_at": "2026-04-22T10:00:00Z",
      "comment_posted": true
    }
  }
}
```

### `sync_state` field definitions (per student per outcome)

| Field | Type | Description |
|---|---|---|
| `last_synced_score` | number\|null | PL score last pushed to Canvas. null = never synced |
| `last_synced_at` | ISO string\|null | When last sync happened |
| `manual_override` | boolean | Teacher explicitly confirmed this difference is intentional |
| `override_score` | number\|null | Canvas score at time of override confirmation |
| `override_reason` | string\|null | Optional teacher note |
| `override_comment_posted` | boolean | Whether comment was posted to Current Score assignment |
| `override_by` | string\|null | Canvas user ID of confirming teacher |
| `override_at` | ISO string\|null | When override was confirmed |

### `possibleManualOverride` — in main cache only (NOT in sync_state)

Stored in `student.outcomes[n]` in the main cache. Recomputed on every Refresh Data. Never persisted to `sync_state`.

```javascript
// student.outcomes[n] in mastery_outlook_cache.json:
{
  outcomeId: 598,
  plPrediction: 1.37,
  canvasScore: 3.50,
  status: 'ok',
  possibleManualOverride: true,   // derived during Refresh Data — temporary
  // ... existing fields unchanged
}
```

---

## 3. The Four Sync Status States

Computed at display time from `sync_state`, `plPrediction`, and `canvasScore`.
**No threshold** — uses exact comparison rounded to 2 decimal places.

```javascript
// Use existing scoresMatch helper from plOutlookStateHandlers.js
const scoresMatch = (a, b) => Math.round(a * 100) === Math.round(b * 100)

export function getSyncStatus(studentId, outcomeId, plPrediction, canvasScore, plConfig) {
  const state = plConfig?.sync_state?.[String(outcomeId)]?.[String(studentId)]

  // No PL prediction available (NE status — not enough assessment data)
  if (plPrediction === null || plPrediction === undefined) {
    return { status: 'ne', label: 'NE — not enough data' }
  }

  // No PL assignment set up yet for this outcome
  if (!plConfig?.pl_assignments?.[String(outcomeId)]?.assignment_id) {
    return { status: 'not_setup', label: 'Setup needed' }
  }

  // Manual override — teacher explicitly confirmed this difference is intentional
  if (state?.manual_override) {
    return {
      status: 'manual_override',
      label: '⚑ Override',
      overrideScore: state.override_score,
      overrideReason: state.override_reason,
      overrideBy: state.override_by,
      overrideAt: state.override_at
    }
  }

  // Never synced — no last_synced_score on record
  if (state?.last_synced_score === null || state?.last_synced_score === undefined) {
    return { status: 'needs_sync', label: '↑ Needs sync' }
  }

  // Canvas score differs from what was last synced
  // → teacher changed it in native Canvas gradebook after sync
  if (canvasScore !== null && !scoresMatch(canvasScore, state.last_synced_score)) {
    return {
      status: 'possible_override',
      label: '⚑ Override?',
      canvasScore,
      lastSyncedScore: state.last_synced_score,
      plPrediction
    }
  }

  // PL prediction changed since last sync
  // (new assessments came in, an alignment was ignored/unignored, etc.)
  if (canvasScore !== null && !scoresMatch(plPrediction, canvasScore)) {
    return { status: 'needs_sync', label: '↑ Needs sync' }
  }

  // All match — Canvas score = PL prediction = last synced score
  return { status: 'synced', label: '✓ Synced' }
}
```

### Status display

| Status | Badge | Color | Meaning |
|---|---|---|---|
| `synced` | `✓ Synced` | Green | PL pred = Canvas score = last synced |
| `needs_sync` | `↑ Needs sync` | Amber | PL pred changed, Canvas not yet updated |
| `possible_override` | `⚑ Override?` | Orange | Canvas score changed after last sync |
| `manual_override` | `⚑ Override` | Orange | Teacher confirmed intentional difference |
| `ne` | `NE` | Grey | Not enough assessment data for PL |
| `not_setup` | `Setup needed` | Grey | First sync not yet run for this outcome |

---

## 4. Student Row Display

Each student row in the expanded outcome view:

```
[dot] Name          Canvas Score   PL Pred.    Sync Status         Actions
────────────────────────────────────────────────────────────────────────────
[●]  Aaliya M.      2.87           2.87        ✓ Synced
[●]  Brandon K.     3.50           1.37        ⚑ Override?         [Confirm] [Sync to PL]
[●]  Devon T.       1.00           1.37        ↑ Needs sync        [Sync]
[●]  Elena R.       3.50           3.50        ⚑ Override          [Revert to PL]
[●]  Finn O.        NE             NE          NE
```

- **Canvas Score** — `canvasScore` from cache, populated by `fetchOutcomeRollups` during Refresh Data
- **PL Pred.** — `plPrediction` from cache. Shows `NE` if status is `NE`
- Alignment circles appear to the right — ignored ones shown faded/strikethrough
- Actions only shown when relevant to the current status

---

## 5. Teacher Actions & What They Write

### 5A. Ignore an alignment

**Trigger:** Teacher clicks ignore on a specific alignment circle

**Writes to cache:**
```javascript
config.ignored_alignments.push({
  student_id:   studentId,
  outcome_id:   outcomeId,
  alignment_id: alignmentId,   // e.g. "assignment_3475"
  reason:       reasonText || null,
  ignored_by:   currentUserId,
  ignored_at:   new Date().toISOString(),
  comment_posted: false
})
```

**Automatic chain (see Section 9):** Recalculate PL → sync to Canvas → update Current Score → post comment if reason provided → re-render row.

### 5B. Un-ignore an alignment

**Trigger:** Teacher clicks un-ignore on a faded alignment circle

**Writes to cache:**
```javascript
config.ignored_alignments = config.ignored_alignments.filter(
  a => !(a.student_id === studentId &&
         a.outcome_id === outcomeId &&
         a.alignment_id === alignmentId)
)
```

**Automatic chain:** Same as 5A.

### 5C. Confirm a manual override (`possible_override` → `manual_override`)

**Trigger:** Teacher clicks [Confirm] on a `possible_override` row

**UI — inline form:**
```
This score was manually set to 3.50 in Canvas.
Reason (optional): [________________]
☑ Post comment to Current Score assignment
[Confirm override]  [Cancel]
```

**Writes to cache:**
```javascript
config.sync_state[outcomeId][studentId] = {
  ...existing,
  manual_override:          true,
  override_score:           canvasScore,
  override_reason:          reasonText || null,
  override_comment_posted:  false,
  override_by:              currentUserId,
  override_at:              new Date().toISOString()
}
```

**Does NOT** push any score to Canvas or affect other students.  
**Does** post comment to Current Score assignment if reason provided and checkbox checked.  
**Next sync** skips this student for this outcome entirely.

### 5D. Dismiss override (`possible_override` → sync to PL)

**Trigger:** Teacher clicks [Sync to PL] on a `possible_override` row

**Writes to cache:** Clears all override fields in `sync_state[outcomeId][studentId]`

**Automatic chain:** Immediately syncs PL score for this student × this outcome → writes new `last_synced_score` → re-renders row as `synced`.

### 5E. Revert manual override to PL (`manual_override` → sync)

**Trigger:** Teacher clicks [Revert to PL] on a `manual_override` row

**UI — confirm dialog:**
```
Revert to Power Law prediction of 1.37?
This will overwrite the current Canvas score of 3.50.
[Revert]  [Cancel]
```

**Writes to cache:**
```javascript
config.sync_state[outcomeId][studentId] = {
  last_synced_score:        null,  // force re-sync
  last_synced_at:           null,
  manual_override:          false,
  override_score:           null,
  override_reason:          null,
  override_comment_posted:  false,
  override_by:              null,
  override_at:              null
}
```

**Automatic chain:** Immediately syncs PL score → writes new `last_synced_score` → re-renders as `synced`.

### 5F. Override Current Score

**Trigger:** Teacher clicks override on a student's Current Score

**UI — inline form:**
```
Override Current Score for Aaliya M.
Calculated: 2.47
New score: [____]
Reason: [________________]
[Save override]
```

**Writes to cache:**
```javascript
config.current_score_overrides[studentId] = {
  score:       overrideScore,
  reason:      reasonText || null,
  override_by: currentUserId,
  override_at: new Date().toISOString(),
  comment_posted: false
}
```

**Then:** Pushes override score to Canvas avg_assignment rubric. Posts comment if reason provided.

**On next Update Current Score run:** If `current_score_overrides[studentId]` exists, skip that student — do not overwrite their manual Current Score.

### 5G. Clear Current Score override

**Trigger:** Teacher clicks [Revert to calculated]

**Removes** `current_score_overrides[studentId]` from cache.  
**Then:** Pushes recalculated Current Score to Canvas.

---

## 6. Refresh Data — Additional Steps

Add these steps after the existing write cycle:

```
Existing steps (unchanged):
  1. Fetch outcome names
  2. Fetch student roster (active enrollments only)
  3. Fetch outcome results — filtered to exclude PL override assignments
  4. Fetch Canvas rollup scores
  5. Compute PL statistics
  6. Preserve pl_assignments across write (read-before-write merge)

NEW steps:
  7. Read sync_state from cache (readSyncState)
  8. For each student × outcome where pl_assignment exists:
       canvasScore     = from fresh rollup (step 4)
       lastSyncedScore = from sync_state[outcomeId][studentId].last_synced_score
       manualOverride  = from sync_state[outcomeId][studentId].manual_override

       if NOT manualOverride AND lastSyncedScore exists
          AND NOT scoresMatch(canvasScore, lastSyncedScore):
         student.outcomes[n].possibleManualOverride = true
       else:
         student.outcomes[n].possibleManualOverride = false

  9. Write updated cache (possibleManualOverride now part of student outcome data)
```

**Rule:** Refresh Data sets `possibleManualOverride` but never sets `manual_override`. Only teachers can set `manual_override` via the confirm flow (5C).

---

## 7. Sync Trigger Rules

| Trigger | Scope | Auto or Manual |
|---|---|---|
| Ignore / un-ignore alignment | Single student × single outcome + Current Score | Auto (immediate) |
| Confirm override (5C) | No Canvas write — records intent only | — |
| Dismiss override → sync to PL (5D) | Single student × single outcome | Auto (immediate) |
| Revert manual override (5E) | Single student × single outcome | Auto (immediate) |
| Override Current Score (5F) | Single student Current Score only | Auto (immediate) |
| [Sync outcome] button | All non-overridden students for that outcome | Manual |
| [Sync all] button | All outcomes, all non-overridden students | Manual |
| Refresh Data | Fetch + calculate only — NO Canvas writes | — |

**Students with `manual_override: true` are always skipped during [Sync outcome] and [Sync all].**

---

## 8. Comment Posting Rules

| Target | When | Content | Frequency |
|---|---|---|---|
| Original alignment assignment | When alignment first ignored | "Alignment excluded from PL — [reason]" | Once (tracked by `comment_posted`) |
| Current Score assignment | Any teacher action with a reason | Running log entry — date, outcome, action, score | Always appends |

**Current Score comment format:**
```
[2026-04-22] Argumentative Writing: 1.37 → Power Law prediction
  Alignment excluded — Essay #2 (assignment_3475) — Absent that day

[2026-04-22] Textual Evidence: 3.50 → Manual override confirmed
  Score confirmed as intentional — Demonstrated mastery verbally
```

---

## 9. The Automatic Chain (Single Student Action)

One teacher action triggers this entire chain automatically. The view calls one function in `plOutlookActions.js` and does not manage the sequence itself.

```
Teacher action (ignore alignment / revert override / dismiss override)
        ↓
1. Write to cache (ignored_alignments or sync_state) via readPLAssignments/writePLAssignments
        ↓
2. Recalculate PL prediction for this student × this outcome
   Local computation — uses filtered score array from cache.students
   Calls powerLawPredict() from powerLaw.js
        ↓
3. runPLSync({ targetUserIds: [studentId], outcome })     ┐
   Pushes new PL score to Canvas outcome rollup           │ Run in
   Writes last_synced_score + last_synced_at to sync_state│ parallel
        ↓                                                  │ where
4. Recalculate Current Score for this student             │ possible
   Avg of all outcome plPredictions                       │
   Respects current_score_overrides                       ┘
        ↓
5. Push Current Score to Canvas avg_assignment
   Via existing submitRubricAssessmentBatch flow
        ↓
6. Post comment if reason provided
   → Original assignment (if alignment ignored)
   → Current Score assignment (always if reason exists)
   Set comment_posted: true in cache
        ↓
7. Re-render student row
   Updated scores, updated sync status badge
```

Student row shows a spinner during steps 3-6.

---

## 10. Files to Create or Modify

| File | Change |
|---|---|
| `masteryOutlookCacheService.js` | Add `readSyncState(courseId, apiClient)` and `writeSyncState(courseId, syncState, apiClient)` — same read-merge-write pattern as `readPLAssignments`/`writePLAssignments`. `sync_state` lives as a section in the shared cache file. |
| `masteryOutlookDataService.js` | Add Refresh Data steps 7-9 — detect `possibleManualOverride` by comparing fresh rollup scores vs `sync_state.last_synced_score` |
| `plOutlookStateHandlers.js` | `handleSyncing` — after batch completes, write `last_synced_score` and `last_synced_at` to `sync_state` for every successfully synced student. Skip students where `sync_state[outcomeId][studentId].manual_override === true` in `handleCalculatingChanges`. |
| `plOutlookSync.js` | `checkSyncNeeded` — return extended counts by status (see Section 12). `runPLSync` already accepts `targetUserIds`. |
| NEW: `plOutlookActions.js` | Implements the automatic chain from Section 9. Exports: `handleIgnoreAlignment`, `handleUnignoreAlignment`, `handleConfirmOverride`, `handleDismissOverride`, `handleRevertOverride`, `handleOverrideCurrentScore`, `handleClearCurrentScoreOverride`. Called from the view. |
| `masteryOutlookView.js` | Student row rendering — Canvas Score column, PL Pred column, sync status badge, ignore alignment circles, action buttons per status. Calls `plOutlookActions.js` functions — does not orchestrate chains directly. |

---

## 11. `readSyncState` / `writeSyncState` — Implementation

Follows exact same pattern as `readPLAssignments` / `writePLAssignments`:

```javascript
// masteryOutlookCacheService.js

export async function readSyncState(courseId, apiClient) {
    const cache = await readMasteryOutlookCache(courseId, apiClient)
    return cache?.sync_state || {}
}

export async function writeSyncState(courseId, syncState, apiClient) {
    const cache = await readMasteryOutlookCache(courseId, apiClient) || buildEmptyCache()
    const merged = { ...cache, sync_state: syncState }
    await writeMasteryOutlookCache(courseId, apiClient, merged)
}
```

Also add `sync_state` to the read-before-write merge in `masteryOutlookInit.js` alongside `pl_assignments`:

```javascript
// Preserve sync_state across Refresh Data (same pattern as pl_assignments)
const existingSyncState = await readSyncState(courseId, apiClient)
if (existingSyncState && Object.keys(existingSyncState).length > 0) {
    cache.sync_state = existingSyncState
}
```

---

## 12. `checkSyncNeeded` — Extended Return Value

```javascript
// Returns per-outcome counts for the outcome row header summary
{
  hasSetup:         boolean,  // pl_assignment exists for this outcome
  total:            number,   // active students with PL predictions
  needsSync:        number,   // status === 'needs_sync'
  possibleOverride: number,   // status === 'possible_override'
  manualOverride:   number,   // status === 'manual_override'
  synced:           number,   // status === 'synced'
  ne:               number    // status === 'ne' (not enough data)
}
```

**Outcome row header summary** (collapsed, before teacher expands):
```
Outcome 1    [2.06]    [spread]    3 below    Re-teach    ▼
             ↑ 3 need sync · ⚑ 1 override?
```

If all synced:
```
Outcome 1    [2.06]    [spread]    3 below    Re-teach    ▼
             ✓ All synced
```

If not yet set up:
```
Outcome 1    [2.06]    [spread]    3 below    Re-teach    ▼
             Setup needed — run sync to initialize
```
