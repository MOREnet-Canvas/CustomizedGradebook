# PL Outlook Sync — Augment Code Handoff
**For:** Augment Code (has full codebase access)  
**From:** Claude conversation (April 2026)  
**Purpose:** Implement PL score sync to Canvas outcome rollups

---

## Context

This project adds Power Law predicted scores to Canvas outcome rollups.
Three prototype files were written by Claude and are in the outputs folder:
- `plOutlookStateMachine.js`
- `plOutlookStateHandlers.js`  
- `plOutlookSync.js`

These need to be adapted to the actual codebase patterns — specifically
using `masteryOutlookCacheService.js` as the model for cache I/O and
`stateHandlers.js` / `stateMachine.js` as the model for state machine patterns.

---

## 1. Files to Create

All files go in `src/masteryOutlook/`:

```
src/masteryOutlook/
  plOutlookStateMachine.js    ← prototype exists, adapt to match stateMachine.js patterns
  plOutlookStateHandlers.js   ← prototype exists, adapt to match stateHandlers.js patterns
  plOutlookSync.js            ← prototype exists, adapt
  plOutlookConfig.js          ← NEW: create by copying masteryOutlookCacheService.js pattern
```

---

## 2. plOutlookConfig.js — Model on masteryOutlookCacheService.js

Create `plOutlookConfig.js` as a near-copy of `masteryOutlookCacheService.js` with:
- Same folder: `MOREnet_CustomizedGradebook/` (reuse existing parent folder)
- New subfolder: `pl_config/`
- New file: `pl_config.json`
- Same 3-step upload process
- Same read/search/validate pattern
- Schema version: `'1.0'`
- No schema version mismatch discard needed (PL config is additive, not replaced)

Export: `readPLConfig(courseId, apiClient)` and `writePLConfig(courseId, data, apiClient)`

### pl_config.json structure:
```json
{
  "version": 1,
  "updated_at": "2026-04-21T10:00:00Z",
  "pl_assignments": {
    "598": {
      "assignment_id": 3590,
      "rubric_id": 1430,
      "rubric_association_id": "2647",
      "criterion_id": "_4317",
      "submission_ids": {
        "642": "26036",
        "643": "26037"
      },
      "created_at": "2026-04-21T10:00:00Z"
    }
  },
  "pl_predictions": {
    "598": {
      "642": 2.87,
      "643": 3.15
    }
  },
  "ignored_alignments": [],
  "manual_overrides": []
}
```

The `pl_predictions` section is written by the Refresh Data flow
(masteryOutlookDataService.js) after PL calculations — Augment needs to
wire that in too (see Section 5 below).

---

## 3. Key Proven Canvas API Behavior (DO NOT CHANGE)

These were validated through extensive console testing. Critical:

### Assignment Setup (one-time per outcome)
```javascript
// Step 1: Create assignment VISIBLE TO EVERYONE first
// Canvas only creates submission records for students when assignment is visible
// This is what makes GraphQL work — same pattern as the avg_outcome assignment
{
  submission_types: ['none'],          // NOT 'not_graded' — causes 422
  only_visible_to_overrides: false,    // VISIBLE first — submission records needed
  points_possible: 0,
  omit_from_final_grade: true,
  published: true
}

// Step 2: Wait 3 seconds for Canvas to create submission records
await new Promise(r => setTimeout(r, 3000))  // like MASTERY_REFRESH_DELAY_MS

// Step 3: Fetch and cache all submission IDs while still visible
GET /api/v1/courses/:id/assignments/:id/submissions?per_page=100

// Step 4: Flip to hidden — students can no longer see it
// Submission records PERSIST after this flip — they are permanent
{ only_visible_to_overrides: true }
```

This is exactly how the existing avg_outcome assignment (ID 3573) works —
visible to everyone, 0 points, Canvas creates submission records for all students.
The PL override assignments follow the same pattern, just flipped hidden after setup.

### Why GraphQL Works After Setup
The existing `submitRubricAssessmentBatch` in `graphqlGradingService.js` uses
`saveRubricAssessment` GraphQL mutation. This DOES drive outcome rollups correctly
**as long as real submission records exist** (non-null submission ID).

The failure we saw during testing was because `only_visible_to_overrides: true`
prevents Canvas from creating submission records — so GraphQL had nothing to attach to.
After the setup flow (visible → create records → hide), submission IDs are real and
permanent, and GraphQL works exactly like avg_outcome.

**Use the existing `submitRubricAssessmentBatch` unchanged for PL sync.**
No new grading infrastructure needed.

### Criterion IDs
- Canvas returns `_4317` style (underscore-prefixed) for rubric criteria
- This IS the real permanent ID — not a temporary client-side format
- Use as-is in GraphQL `assessmentDetails` as `criterion_${criterionId}`
- Fetch from: `GET /api/v1/courses/:id/assignments/:id` → `rubric[0].id`

### Rubric Association ID
- Found in `full_rubric_assessment.rubric_association.id` on submission response
- Also returned in rubric creation response
- Required for GraphQL `saveRubricAssessment` — store in pl_config.json

### Grading — CONFIRMED WORKING (GraphQL)
```javascript
// GraphQL saveRubricAssessment — same as avg_outcome
// Works when submission records exist (after setup flow)
// Drives outcome rollup correctly
const criterionKey = `criterion_${criterionId}`  // e.g. "criterion__4317"
const assessmentDetails = {
  assessment_type: 'grading',
  [criterionKey]: { points: 3.5, comments: null, save_comment: '0' }
}
// submitRubricAssessmentBatch handles this automatically
```

---

## 4. Departed Students

Filter to active enrollments only before building sync list:
```javascript
// fetchCourseStudents already exists in enrollmentService.js
// It must filter to enrollment_state: 'active' only
// Students not in active enrollment = silently skipped, logged as info
// Their cached submission_ids remain in pl_config.json in case they return
```

Check `enrollmentService.js` — if `fetchCourseStudents` doesn't filter
by `enrollment_state: active`, add that filter.

---

## 5. Wiring pl_predictions into the Cache

`masteryOutlookDataService.js` already calculates PL predictions via `powerLaw.js`.
After `computeStudentOutcome()` runs, the predictions need to be written
to `pl_config.json` under `pl_predictions[outcomeId][userId] = plPrediction`.

This should happen at the end of the Refresh Data flow, alongside writing
`mastery_outlook_cache.json`. Augment should find where
`writeMasteryOutlookCache` is called and add a `writePLConfig` call there
with the predictions extracted from the computed data.

The prediction to store per student per outcome is:
```javascript
computed.plPrediction  // from computeStudentOutcome() in powerLaw.js
// null if status === 'NE' (not enough data) — skip these
```

---

## 6. Grading Service — Use Existing submitRubricAssessmentBatch

No new batch function needed. Use the existing `submitRubricAssessmentBatch`
from `graphqlGradingService.js` directly — same as `handleUpdatingGrades`
in `stateHandlers.js`.

Each student object passed to the batch needs:
```javascript
{
  submissionId,         // from pl_config.json submission_ids map
  rubricAssociationId,  // from pl_config.json pl_assignments[outcomeId].rubric_association_id
  rubricCriterionId,    // from pl_config.json pl_assignments[outcomeId].criterion_id
  points,               // PL predicted score
  userId,               // for error reporting
  score                 // same as points, for error reporting
  // No comment needed — PL sync doesn't post comments here
  // No enrollmentId/overrideScore — PL sync doesn't touch grade overrides
}
```

The criterion key format in assessmentDetails is `criterion_${rubricCriterionId}`,
e.g. `criterion__4317` (double underscore — the ID itself starts with underscore).

---

## 7. State Machine Differences from Existing Flow

| Aspect | avg_outcome flow | PL sync flow |
|---|---|---|
| Scope | One outcome (Current Score) | Per regular outcome |
| Setup check | Canvas API calls | pl_config.json read (fast) |
| Score calculation | Average of outcome scores | Power Law prediction |
| Grading method | GraphQL saveRubricAssessment | REST PUT + rubric_assessment |
| Progress display | Floating banner | Inline in outcome row |
| User confirmation | None | None |
| Departed students | Not explicitly handled | Filter to active enrollment |
| Submission IDs | Fetched every run | Cached in pl_config.json |

---

## 8. Outcome Calculation Method

Before first use, each outcome's `calculation_method` should be set to `latest`:
```javascript
PUT /api/v1/outcomes/:outcome_id
{ calculation_method: 'latest' }
```

This was tested and works even on outcomes that already have scores.
`latest` means the most recent rubric assessment wins — so the PL override
assignment always controls the rollup score after syncing.

This should happen in `CREATING_ASSIGNMENT` state, before assignment creation.

---

## 9. checkSyncNeeded — For UI Count Display

The Mastery Outlook view needs to show "X students need updating" per outcome
before the teacher initiates sync. `plOutlookSync.js` has a `checkSyncNeeded()`
function — it needs to be called when the outcome row is expanded/rendered
and the result shown inline.

This requires `pl_predictions` to be populated in pl_config.json (see Section 5).

---

## 10. Test Credentials (morenetlab.instructure.com)

These IDs are from console testing — useful for integration testing:
```
Course ID:              566
Outcome 1 ID:           598  (calculation_method already set to 'latest')
PL Override Assignment: 3590 (no_submission test assignment — may be cleaned up)
Rubric ID:              1430
Rubric Association ID:  2647
Criterion ID:           _4317
Test students:          642, 643, 644, 645, 646
Section ID:             514
```

---

## 11. Files to Reference in Codebase

- `src/masteryOutlook/masteryOutlookCacheService.js` — model for plOutlookConfig.js
- `src/masteryOutlook/powerLaw.js` — use `computeStudentOutcome()`, `powerLawPredict()`
- `src/masteryOutlook/masteryOutlookDataService.js` — where to wire in pl_predictions write
- `src/gradebook/stateHandlers.js` — model for state handler patterns
- `src/gradebook/stateMachine.js` — model for state machine class
- `src/services/graphqlGradingService.js` — model for batch pattern (but use REST not GraphQL)
- `src/services/enrollmentService.js` — check fetchCourseStudents filters active only
- `src/utils/canvasApiClient.js` — use existing apiClient.get/post/put/delete

---

## 12. Full Testing Documentation

See `pl_override_assignment_findings.md` in the outputs folder for
complete record of all console tests, what worked, what failed, and why.
