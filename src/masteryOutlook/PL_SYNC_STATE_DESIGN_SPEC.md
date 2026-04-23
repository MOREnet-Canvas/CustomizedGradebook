# PL Sync State & Teacher Override — Design Specification
**For:** Augment Code  
**Date:** April 2026  
**Relates to:** `src/masteryOutlook/` — PL sync feature

---

## 1. Overview

The Mastery Outlook displays two scores per student per outcome:
- **Canvas Score** — what Canvas currently shows in the Learning Mastery Gradebook (source of truth for students)
- **PL Pred.** — what the Power Law algorithm calculated from assessment history

Teachers need to see both, understand why they differ, and take action. This spec defines the data model, the four sync status states, and every teacher interaction that modifies pl_config.json or Canvas.

---

## 2. pl_config.json — Complete Structure

The pl_config.json file lives in the existing `mastery_outlook_cache.json` as a `pl_assignments` and `sync_state` section (managed via `readPLAssignments` / `writePLAssignments` in `masteryOutlookCacheService.js`).

```json
{
  "pl_assignments": {
    "598": {
      "assignment_id": 3591,
      "rubric_id": 1431,
      "rubric_association_id": "2648",
      "criterion_id": "_2657",
      "submission_ids": {
        "642": "26039",
        "643": "26040"
      },
      "created_at": "2026-04-22T09:00:00Z"
    }
  },

  "sync_state": {
    "598": {
      "642": {
        "last_synced_score": 1.37,
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

### Field definitions — sync_state per student per outcome

| Field | Type | Description |
|---|---|---|
| `last_synced_score` | number\|null | PL score that was last pushed to Canvas. null = never synced |
| `last_synced_at` | ISO string\|null | When last sync happened |
| `manual_override` | boolean | Teacher explicitly confirmed this difference is intentional |
| `override_score` | number\|null | The Canvas score at time of override confirmation |
| `override_reason` | string\|null | Optional teacher note |
| `override_comment_posted` | boolean | Whether comment was posted to Current Score assignment |
| `override_by` | string\|null | Canvas user ID of teacher who confirmed override |
| `override_at` | ISO string\|null | When override was confirmed |

---

## 3. The Four Sync Status States

Computed at display time from `sync_state`, `plPrediction`, and `canvasScore`.

```javascript
const SYNC_THRESHOLD = 0.25  // minimum meaningful difference

function getSyncStatus(studentId, outcomeId, plPrediction, canvasScore, plConfig) {
  const state = plConfig.sync_state?.[outcomeId]?.[studentId]

  // 1. Manual override — teacher explicitly confirmed
  if (state?.manual_override) {
    return { status: 'manual_override' }
  }

  // 2. Never synced
  if (!state?.last_synced_score) {
    return { status: 'needs_sync' }
  }

  // 3. Canvas score differs from last synced score
  //    → teacher changed it in native Canvas gradebook after sync
  const canvasChangedAfterSync =
    Math.abs(canvasScore - state.last_synced_score) > SYNC_THRESHOLD

  if (canvasChangedAfterSync) {
    return {
      status: 'possible_override',
      canvasScore,
      lastSyncedScore: state.last_synced_score
    }
  }

  // 4. PL prediction changed since last sync (new assessments, ignored alignment, etc.)
  const plChangedSinceSync =
    Math.abs(plPrediction - canvasScore) > SYNC_THRESHOLD

  if (plChangedSinceSync) {
    return { status: 'needs_sync' }
  }

  // All match
  return { status: 'synced' }
}
```

### Status display

| Status | Badge | Color | Meaning |
|---|---|---|---|
| `synced` | `✓ Synced` | Green | PL pred = Canvas score = last synced |
| `needs_sync` | `↑ Needs sync` | Amber | PL pred changed, Canvas not yet updated |
| `possible_override` | `⚑ Override?` | Orange | Canvas score changed after last sync — teacher may have changed it manually |
| `manual_override` | `⚑ Override` | Orange | Teacher explicitly confirmed this difference is intentional |

---

## 4. Student Row Display

Each student row in the expanded outcome view shows:

```
[dot] Name          Canvas Score   PL Pred.    Sync Status         Actions
────────────────────────────────────────────────────────────────────────────
[●]  Aaliya M.      2.87           2.87        ✓ Synced
[●]  Brandon K.     3.50           1.37        ⚑ Override?         [Confirm] [Sync to PL]
[●]  Devon T.       1.00           1.37        ↑ Needs sync        [Sync]
[●]  Elena R.       3.50           3.50        ⚑ Override          [Revert to PL]
```

- **Canvas Score** — from `canvasScore` field in the mastery outlook cache (populated by `fetchOutcomeRollups` during Refresh Data)
- **PL Pred.** — from `plPrediction` in cache. Shows `NE` if status is NE (not enough data)
- Alignment circles (score history dots) appear to the right of the name, same as current design
- Ignored alignments shown as faded/strikethrough circles

---

## 5. Teacher Actions & What They Write

### 5A. Ignore an alignment

**Trigger:** Teacher clicks the ignore button on a specific alignment circle in the student row

**Writes to pl_config.json:**
```javascript
// Add to ignored_alignments array
{
  student_id: studentId,
  outcome_id: outcomeId,
  alignment_id: alignmentId,      // e.g. "assignment_3475"
  reason: reasonText || null,
  ignored_by: currentUserId,
  ignored_at: new Date().toISOString(),
  comment_posted: false
}
```

**Then immediately:**
1. Recalculate PL for this student × this outcome (local, using filtered scores)
2. Update `plPrediction` in the display
3. Run sync for this student × this outcome only → push new PL score to Canvas
4. Write `last_synced_score` and `last_synced_at` to `sync_state`
5. Recalculate Current Score for this student (avg of all outcome PL scores)
6. Push updated Current Score to Canvas (via existing avg_assignment rubric flow)
7. If reason provided → post comment to original assignment + append to Current Score assignment
8. Set `comment_posted: true`
9. Re-render student row

**UI feedback:** Spinner on student row during steps 3-6, then resolves to updated state.

### 5B. Un-ignore an alignment

**Trigger:** Teacher clicks un-ignore on a faded alignment circle

**Writes to pl_config.json:**
```javascript
// Remove from ignored_alignments array
config.ignored_alignments = config.ignored_alignments.filter(
  a => !(a.student_id === studentId && a.outcome_id === outcomeId && a.alignment_id === alignmentId)
)
```

**Then:** Same chain as 5A (recalculate → sync → update Current Score)

### 5C. Confirm a manual override ("⚑ Override?" → "⚑ Override")

**Trigger:** Teacher clicks [Confirm] on a `possible_override` row

**UI:** Small inline form appears:
```
This score was manually set to 3.50 in Canvas.
Reason (optional): [________________]
[Post comment to Current Score] ← checkbox, default on
[Confirm override]  [Cancel]
```

**Writes to pl_config.json:**
```javascript
config.sync_state[outcomeId][studentId] = {
  ...existing,
  manual_override: true,
  override_score: canvasScore,
  override_reason: reasonText || null,
  override_comment_posted: false,
  override_by: currentUserId,
  override_at: new Date().toISOString()
}
```

**Then:**
- If comment checkbox checked → append to Current Score assignment comment thread
- Set `override_comment_posted: true`
- Re-render row as `manual_override` status
- Next sync will SKIP this student for this outcome

**Does NOT:** Push any score to Canvas, change PL calculation, affect other students

### 5D. Dismiss override suspicion ("⚑ Override?" → sync to PL)

**Trigger:** Teacher clicks [Sync to PL] on a `possible_override` row

**Writes to pl_config.json:**
```javascript
config.sync_state[outcomeId][studentId] = {
  ...existing,
  manual_override: false,
  override_score: null,
  override_reason: null,
  override_by: null,
  override_at: null
}
```

**Then:** Immediately sync PL score to Canvas for this student × this outcome,
write `last_synced_score`, re-render row as `synced` or `needs_sync`.

### 5E. Revert manual override to PL

**Trigger:** Teacher clicks [Revert to PL] on a `manual_override` row

**UI:** Confirm dialog:
```
Revert to Power Law prediction of 1.37?
This will overwrite the current Canvas score of 3.50.
[Revert]  [Cancel]
```

**Writes to pl_config.json:**
```javascript
config.sync_state[outcomeId][studentId] = {
  last_synced_score: null,   // forces re-sync
  last_synced_at: null,
  manual_override: false,
  override_score: null,
  override_reason: null,
  override_comment_posted: false,
  override_by: null,
  override_at: null
}
```

**Then:** Immediately sync PL score to Canvas, write new `last_synced_score`, re-render.

### 5F. Override Current Score

**Trigger:** Teacher clicks override on the Current Score row for a student

**UI:** Inline form:
```
Override Current Score for Aaliya M.
Calculated: 2.47
New score: [____]
Reason: [________________]
[Save override]
```

**Writes to pl_config.json:**
```javascript
config.current_score_overrides[studentId] = {
  score: overrideScore,
  reason: reasonText || null,
  override_by: currentUserId,
  override_at: new Date().toISOString(),
  comment_posted: false
}
```

**Then:**
- Push override score to Canvas avg_assignment rubric (via existing GraphQL flow)
- Post comment to Current Score assignment if reason provided
- Set `comment_posted: true`

**On next Update Current Score run:** If `current_score_overrides[studentId]` exists,
skip that student — do not overwrite their manual Current Score.

### 5G. Clear Current Score override

**Trigger:** Teacher clicks [Revert to calculated] on an overridden Current Score

**Removes** `current_score_overrides[studentId]` from pl_config.json.
**Then:** Push recalculated Current Score to Canvas.

---

## 6. Refresh Data — What Changes

Refresh Data (fetch new scores from Canvas) now does additional steps:

```
Existing steps:
  1. Fetch outcome names
  2. Fetch student roster
  3. Fetch outcome results (filtered to exclude PL override assignments)
  4. Fetch Canvas rollup scores
  5. Compute PL statistics
  6. Preserve pl_assignments across write

NEW steps after step 6:
  7. Read current sync_state from pl_config.json
  8. For each student × outcome where pl_assignment exists:
       canvasScore = from fresh rollup
       lastSyncedScore = from sync_state
       if canvasScore differs from lastSyncedScore by > SYNC_THRESHOLD:
         mark as possible_override in cache for UI display
         (do NOT auto-set manual_override — teacher must confirm)
  9. Write updated cache including possible_override flags
```

The `possible_override` flag is stored in the student outcome data in the main cache
(not in pl_config.json) since it's derived/temporary:

```javascript
// In student.outcomes[n]:
{
  outcomeId: 598,
  plPrediction: 1.37,
  canvasScore: 3.50,
  status: 'ok',
  possibleManualOverride: true,   // NEW — set during Refresh Data
  // ... other fields
}
```

---

## 7. Sync Trigger Rules

| Trigger | Scope | Auto or Manual |
|---|---|---|
| Ignore/un-ignore alignment | Single student × single outcome + Current Score | Auto (immediate) |
| Confirm override | No sync — just records intent | — |
| Revert override | Single student × single outcome | Auto (immediate) |
| Override Current Score | Single student Current Score only | Auto (immediate) |
| [Sync outcome] button in outcome row header | All non-overridden students for that outcome | Manual |
| [Sync all] button in dashboard header | All outcomes, all non-overridden students | Manual |
| Refresh Data | Does NOT sync — only fetches and calculates | — |

**Manual override students are always skipped during outcome sync and sync all.**

---

## 8. Comment Posting Rules

Two comment targets per student:

| Target | When posted | Content | Posted once or appends |
|---|---|---|---|
| Original assignment | When alignment is first ignored | "Alignment excluded — [Assignment Name] — [reason]" | Once (tracked by `comment_posted`) |
| Current Score assignment | On any teacher action with a reason | Running log entry with date, action, score | Always appends |

Current Score comment log entry format:
```
[2026-04-22] Argumentative Writing: 1.37 (Power Law)
  Alignment excluded — Essay #2 — Absent that day
```

```
[2026-04-22] Textual Evidence: 3.50 (Manual override)
  Score confirmed as manual — Demonstrated mastery verbally
```

---

## 9. The Automatic Chain (Single Student Action)

When a teacher ignores an alignment or reverts an override, this chain runs automatically — teacher takes one action and everything downstream updates:

```
1. Write to pl_config.json (ignored_alignments or sync_state)
2. Recalculate PL prediction for this student × this outcome
   (local computation, no API calls, uses filtered score array)
3. runPLSync({ targetUserIds: [studentId], outcome })
   → pushes new PL score to Canvas outcome rollup
   → writes last_synced_score to sync_state
4. Recalculate Current Score for this student
   (avg of all outcome plPredictions, respecting current_score_overrides)
5. Push Current Score to Canvas avg_assignment
   (via existing submitRubricAssessmentBatch flow)
6. If comment needed → post to original assignment + append to Current Score
7. Re-render student row with updated scores and status
```

Steps 3 and 5 run in parallel where possible (different assignments).
Student row shows a spinner during steps 3-6, then resolves.

---

## 10. Files to Modify

| File | Change |
|---|---|
| `masteryOutlookCacheService.js` | Add `readSyncState`, `writeSyncState` helpers alongside existing `readPLAssignments`/`writePLAssignments` |
| `masteryOutlookDataService.js` | Step 7-9 in Refresh Data — detect `possibleManualOverride` from rollup vs sync_state comparison |
| `plOutlookStateHandlers.js` | `handleSyncing` — write `last_synced_score` and `last_synced_at` to sync_state after batch completes. Skip students where `manual_override: true` |
| `plOutlookSync.js` | `runPLSync` — accept `targetUserIds` for single-student sync. `checkSyncNeeded` — return counts by status (needs_sync, possible_override, manual_override) |
| `masteryOutlookView.js` | Student row rendering — show Canvas Score + PL Pred columns, sync status badge, ignore alignment controls, action buttons |
| NEW: `plOutlookActions.js` | The automatic chain (Section 9) — orchestrates ignore/revert/override actions, called from the view |

---

## 11. getSyncStatus — Full Implementation Reference

```javascript
// src/masteryOutlook/plOutlookSync.js or plOutlookActions.js

export const SYNC_THRESHOLD = 0.25

export function getSyncStatus(studentId, outcomeId, plPrediction, canvasScore, plConfig) {
  const state = plConfig?.sync_state?.[String(outcomeId)]?.[String(studentId)]

  // No PL prediction available (NE status)
  if (plPrediction === null || plPrediction === undefined) {
    return { status: 'ne', label: 'NE — not enough data' }
  }

  // No PL assignment set up yet
  if (!plConfig?.pl_assignments?.[String(outcomeId)]?.assignment_id) {
    return { status: 'not_setup', label: 'Setup needed' }
  }

  // Manual override confirmed by teacher
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

  // Never synced
  if (!state?.last_synced_score) {
    return { status: 'needs_sync', label: '↑ Needs sync' }
  }

  // Canvas score changed after last sync — possible teacher manual change
  const canvasChangedAfterSync =
    canvasScore !== null &&
    Math.abs(canvasScore - state.last_synced_score) > SYNC_THRESHOLD

  if (canvasChangedAfterSync) {
    return {
      status: 'possible_override',
      label: '⚑ Override?',
      canvasScore,
      lastSyncedScore: state.last_synced_score,
      plPrediction
    }
  }

  // PL prediction changed since last sync
  const plChangedSinceSync =
    canvasScore !== null &&
    Math.abs(plPrediction - canvasScore) > SYNC_THRESHOLD

  if (plChangedSinceSync) {
    return { status: 'needs_sync', label: '↑ Needs sync' }
  }

  return { status: 'synced', label: '✓ Synced' }
}
```

---

## 12. checkSyncNeeded — Extended Return Value

Update `checkSyncNeeded` in `plOutlookSync.js` to return counts by status
so the outcome row header can show a meaningful summary before sync:

```javascript
// Returns:
{
  hasSetup: boolean,
  total: number,
  needsSync: number,       // status === 'needs_sync'
  possibleOverride: number, // status === 'possible_override'
  manualOverride: number,  // status === 'manual_override'
  synced: number,          // status === 'synced'
  ne: number               // status === 'ne'
}
```

Outcome row header summary (collapsed, before expanding):
```
Outcome 1    [2.06]    [spread bar]    3 below    Re-teach    ▼
             ↑ 3 need sync · ⚑ 1 override?
```
