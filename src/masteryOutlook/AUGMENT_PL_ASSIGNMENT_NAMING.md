# Augment Task — PL Assignment Naming & Grade Visibility
**Date:** April 2026  
**Files to read first:** `src/config.js`, `src/masteryOutlook/plOutlookStateHandlers.js`, `src/masteryOutlook/cgDevTools.js`  
**No legacy code to consider** — this is a greenfield feature. There are no previous implementations of PL sync to migrate or maintain compatibility with.

---

## Context

PL override assignments are created once per outcome per course to push Power Law predicted scores to Canvas outcome rollups. Students and teachers must see the same scores in the Learning Mastery Gradebook. The current assignment name `PL Override — Outcome 1` is internal jargon that means nothing to students. This task renames the assignment to something meaningful and removes the grade hiding behavior that was preventing students from seeing their scores.

---

## Change 1 — Add `PL_ASSIGNMENT_SUFFIX` to `src/config.js`

Add in the "UI labels and resource names" section alongside `AVG_OUTCOME_NAME`, `AVG_ASSIGNMENT_NAME`, `AVG_RUBRIC_NAME`:

```javascript
// PL Override assignment naming
// Controls the suffix appended to outcome names for PL override assignments.
// Result: "<Outcome Name> — <PL_ASSIGNMENT_SUFFIX>"
// e.g. "Argumentative Writing — Projected Score"
//
// Teachers can override this in their loader file to match their terminology:
//   "Growth Score"    — Marzano-aligned language
//   "Current Level"   — standards-based grading language  
//   "Trend Score"     — data-focused language
//   "Marzano Score"   — explicit methodology reference
export const PL_ASSIGNMENT_SUFFIX = window.CG_CONFIG?.PL_ASSIGNMENT_SUFFIX ?? 'Projected Score';
export const PL_RUBRIC_SUFFIX = window.CG_CONFIG?.PL_RUBRIC_SUFFIX ?? 'Projected Score Rubric';
```

---

## Change 2 — Update `src/masteryOutlook/plOutlookStateHandlers.js`

### 2a. Update the config import

Add `PL_ASSIGNMENT_SUFFIX` and `PL_RUBRIC_SUFFIX` to the existing config import:

```javascript
import { DEFAULT_MAX_POINTS, OUTCOME_AND_RUBRIC_RATINGS, PL_ASSIGNMENT_SUFFIX, PL_RUBRIC_SUFFIX } from '../config.js';
```

### 2b. Update assignment and rubric names in `handleCreatingAssignment`

```javascript
// Assignment name — change from:
name: `PL Override — ${outcomeName}`
// To:
name: `${outcomeName} — ${PL_ASSIGNMENT_SUFFIX}`

// Rubric name — change from:
title: `PL Override Rubric — ${outcomeName}`
// To:
title: `${outcomeName} — ${PL_RUBRIC_SUFFIX}`
```

### 2c. Add a comment above the assignment creation block

```javascript
// Assignment name uses PL_ASSIGNMENT_SUFFIX from config.js (default: 'Projected Score')
// Result: "<Outcome Name> — Projected Score" e.g. "Argumentative Writing — Projected Score"
// Note: Existing assignments created before this change keep their original names.
// To rename: delete the assignment in Canvas, clear the pl_assignments cache entry
// for that outcome, and re-run sync to trigger CREATING_ASSIGNMENT.
```

---

## Change 3 — Remove grade hiding from `handleCreatingAssignment`

Students and teachers must see the same scores in the Learning Mastery Gradebook. The assignment shows 0 points and "does not count toward final grade" which is sufficient transparency for students.

### 3a. Remove the GraphQL `setAssignmentPostPolicy` mutation

Delete the entire GraphQL call that sets `postManually: true`. It looks like this — remove it entirely:

```javascript
// DELETE THIS ENTIRE BLOCK:
await apiClient.graphql(`
    mutation SetPLAssignmentPostPolicy($assignmentId: ID!) {
        setAssignmentPostPolicy(input: {
            assignmentId: $assignmentId
            postManually: true
        }) {
            postPolicy { postManually }
            errors { attribute message }
        }
    }
`, { assignmentId: String(assignmentId) }, 'PLSync:setPostPolicy');
```

### 3b. Remove `post_manually` from the assignment creation body

The assignment creation POST should not include `post_manually` at all:

```javascript
// Remove post_manually from assignment creation:
assignment: {
    name:                      `${outcomeName} — ${PL_ASSIGNMENT_SUFFIX}`,
    points_possible:           0,
    published:                 true,
    only_visible_to_overrides: false,
    grading_type:              'points',
    submission_types:          ['none'],
    omit_from_final_grade:     true
    // post_manually is NOT set — grades auto-post so students see projected scores
}
```

### 3c. Update the final hide PUT

The PUT that flips visibility at the end of setup should only set these two fields:

```javascript
await apiClient.put(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    {
        assignment: {
            only_visible_to_overrides: true,
            points_possible:           0
        }
    },
    {}, 'PLSync:hideAssignment'
);
logger.info(`[PLSync] Assignment ${assignmentId} finalized — hidden from assignments list, points reset to 0`);
```

---

## Change 4 — Update `cgDevTools.js` help text

In `_printHelp`, update the `runPLSync` example comment to reflect the new naming:

```javascript
// In the 'Example — run PL sync for one outcome' group:
"await __CG_DEV.runPLSync({\n" +
"  outcome: { id: '598', title: 'Outcome 1' },\n" +
"  // Creates assignment: 'Outcome 1 — Projected Score'\n" +
"  onProgress: (state, name, msg, d, t) => console.log(state, msg, d, t)\n" +
"})"
```

---

## What NOT to change

- Cache key structure in `pl_assignments` — still keyed by outcome ID, no migration needed
- The `CREATING_ASSIGNMENT` state flow and transition logic
- Any verification, sync, or calculating changes logic
- The `only_visible_to_overrides: true` flip — assignment stays hidden from the assignments list and student gradebook columns, but grades are visible in Learning Mastery Gradebook
- `FETCHING_SUBMISSIONS` handler — no changes needed
- Test files — no test changes needed for this task

---

## Verification Steps After Changes

After rebuilding:

1. Clear the cache entry for the test outcome:
```javascript
const pl = await __CG_DEV.readPLAssignments()
delete pl['598']
await __CG_DEV.writePLAssignments(pl)
```

2. Delete the existing PL override assignment in Canvas (if any exist)

3. Run fresh sync:
```javascript
await __CG_DEV.runPLSync({
  outcome: { id: '598', title: 'Outcome 1' },
  onProgress: (state, name, msg, d, t) =>
    console.log(`[${state}] ${msg}`, d != null ? `${d}/${t}` : '')
})
```

4. Verify assignment settings:
```javascript
const pl = await __CG_DEV.readPLAssignments()
const assignmentId = pl['598'].assignment_id
const asgn = await __CG_DEV.apiClient.get(
  `/api/v1/courses/${__CG_DEV.courseId}/assignments/${assignmentId}`
)
console.log('name:', asgn.name)                           // "Outcome 1 — Projected Score"
console.log('post_manually:', asgn.post_manually)         // false
console.log('points_possible:', asgn.points_possible)     // 0
console.log('only_visible_to_overrides:', asgn.only_visible_to_overrides) // true
```

5. Check student view — confirm:
   - Assignment does NOT appear in student assignments list or gradebook columns
   - Student CAN see their projected score in the Learning Mastery Gradebook
   - Score matches what the teacher sees in the Learning Mastery Gradebook
