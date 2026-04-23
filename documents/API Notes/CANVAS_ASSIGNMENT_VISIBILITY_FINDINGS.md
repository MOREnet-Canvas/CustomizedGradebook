# Canvas Assignment Visibility — Research Findings
**Date:** April 2026  
**Context:** PL Override assignments for CustomizedGradebook PL sync feature  
**Course:** morenetlab.instructure.com, Course 566  
**Tested with:** 5 test students, assignment types: `submission_types: ['none']`, `points_possible: 0`

---

## Overview

PL override assignments need to:
- Be invisible in the student assignments list and gradebook columns
- Allow teacher grading via API (to drive outcome rollups)
- Show scores to students in the Learning Mastery Gradebook
- Match what teachers see in the Learning Mastery Gradebook

This document records every visibility setting tested, what it controlled, and the confirmed behavior.

---

## Setting 1 — `only_visible_to_overrides`

**API field:** `assignment.only_visible_to_overrides` (boolean)  
**Set via:** REST PUT `/api/v1/courses/:id/assignments/:id`

| Value | Student assignments list | Student gradebook column | Teacher gradebook | Submission records created |
|---|---|---|---|---|
| `false` | ✅ Visible | ✅ Visible | ✅ Visible | ✅ Yes — for ALL students automatically |
| `true` | ❌ Hidden | ❌ Hidden | ✅ Visible | ❌ No — only for students with an override |

### Critical finding
Canvas only creates submission records for students when `only_visible_to_overrides: false`. **Submission records must exist for GraphQL `saveRubricAssessment` to work.** Without a real submission ID, GraphQL returns "Submission not found".

### Production pattern confirmed
Create assignment with `only_visible_to_overrides: false` → wait 3 seconds → fetch and cache all submission IDs → flip to `only_visible_to_overrides: true`. Submission records **persist permanently** after the flip — they are not deleted when visibility changes.

---

## Setting 2 — `post_manually` / Posting Policy

**API field:** `assignment.post_manually` (boolean)  
**Set via REST:** REST PUT `/api/v1/courses/:id/assignments/:id` — **accepted but silently ignored by Canvas**  
**Set via GraphQL:** `setAssignmentPostPolicy(input: { assignmentId, postManually: true })` — **works correctly**  
**REST endpoint** `/api/v1/courses/:id/assignments/:id/post_policy` — **404 on this Canvas version**

| Value | Student sees grade in LMGB | Student sees grade in Recent Feedback | Teacher sees grade |
|---|---|---|---|
| `false` (default) | ✅ Yes | ✅ Yes (notification sent) | ✅ Yes |
| `true` | ❌ No | ❌ No | ✅ Yes |

### Critical finding
`post_manually: true` in the assignment creation body is **silently ignored** by Canvas. The REST API accepts it without error but Canvas does not apply it. Must use the GraphQL mutation `setAssignmentPostPolicy` instead.

### Recent Feedback behavior
When `post_manually: false` (default), any graded submission triggers a Recent Feedback notification visible to the student on the course home page. This happens regardless of `only_visible_to_overrides`. The notification shows the assignment name and score.

When `post_manually: true` (set via GraphQL), grades are written to Canvas internally and drive outcome rollups, but no Recent Feedback notification is sent and students cannot see the score anywhere in the student-facing UI.

### Decision for PL sync
`post_manually` is **not used** in the final implementation. Students and teachers must see the same scores in the Learning Mastery Gradebook. Grades auto-post so students can see their projected scores. The assignment is hidden from the assignments list and gradebook columns via `only_visible_to_overrides: true`, but the score remains visible in the Learning Mastery Gradebook.

---

## Setting 3 — `omit_from_final_grade`

**API field:** `assignment.omit_from_final_grade` (boolean)  
**Set via:** REST PUT `/api/v1/courses/:id/assignments/:id`

| Value | Counts toward total grade | Shows "does not count" banner to students |
|---|---|---|
| `false` | ✅ Yes | ❌ No banner |
| `true` | ❌ No | ✅ Banner shown |

### Behavior confirmed
When `true`, Canvas shows a blue banner on the assignment page: "This assignment does not count toward the final grade." This is visible to students and is useful transparency for explaining why the assignment exists.

---

## Setting 4 — `points_possible`

**API field:** `assignment.points_possible` (number)  
**Set via:** REST PUT `/api/v1/courses/:id/assignments/:id`

### Critical finding — rubric creation resets points_possible
When a rubric is attached to an assignment via `rubric_association` with `use_for_grading: true`, Canvas **automatically resets `points_possible` to match the rubric's total points** (e.g. 4). This overrides the `points_possible: 0` set during assignment creation.

**Workaround:** After rubric creation, explicitly PUT the assignment again to reset `points_possible: 0`. This must be the last PUT in the setup sequence.

| Value | Teacher gradebook shows | Affects final grade calculation |
|---|---|---|
| `0` | "Out of 0" | No (also requires `omit_from_final_grade: true`) |
| `4` (rubric default) | "Out of 4" | No (if `omit_from_final_grade: true`) |

### Why points_possible matters even with omit_from_final_grade
Even though the assignment doesn't count toward the final grade, `points_possible: 4` shows "Out of 4" in the teacher gradebook which is confusing. Teachers may interpret this as the assignment having grade weight. Reset to 0 after rubric creation.

---

## Setting 5 — `use_for_grading` on Rubric Association

**API field:** `rubric_association.use_for_grading` (boolean)  
**Set via:** POST `/api/v1/courses/:id/rubrics` rubric_association body

| Value | Rubric score drives assignment grade | Outcome result created | Outcome rollup updated |
|---|---|---|---|
| `true` | ✅ Yes | ✅ Yes | ✅ Yes |
| `false` | ❌ No | ✅ Yes (unconfirmed) | ❓ Untested |

### Decision
`use_for_grading: true` is used in the final implementation. This is what drives the outcome rollup — the rubric score sets the assignment grade which Canvas uses to calculate the outcome result. Setting to `false` was considered to prevent the `points_possible` reset problem but was not pursued since the explicit reset PUT solves it more cleanly.

---

## Setting 6 — `published`

**API field:** `assignment.published` (boolean)

| Value | Can be graded via API | Visible to students | Submission records created |
|---|---|---|---|
| `true` | ✅ Yes | Depends on other settings | ✅ Yes (if visible) |
| `false` | ❌ No — REST grading returns 403 | ❌ No | ❌ No |

### Confirmed behavior
Unpublished assignments cannot be graded via the REST API — returns 403 Forbidden. GraphQL `saveRubricAssessment` was not tested on unpublished assignments. Assignment must be published for the sync flow to work.

---

## Setting 7 — Per-Student Overrides

**API:** POST `/api/v1/courses/:id/assignments/:id/overrides`  
**Body:** `{ assignment_override: { student_ids: [userId], title: 'label' } }`

| Scenario | Submission record exists | Can grade via REST | Can grade via GraphQL |
|---|---|---|---|
| No override, `only_visible_to_overrides: false` | ✅ Yes | ✅ Yes | ✅ Yes |
| No override, `only_visible_to_overrides: true` | ❌ No | ❌ 403 | ❌ "Submission not found" |
| Override exists, `only_visible_to_overrides: true` | ❌ No (still null) | ❌ 403 | ❌ "Submission not found" |
| Override exists + REST grade attempted first | ✅ Created by REST grade | ✅ Yes | ✅ Yes |

### Per-student override approach — abandoned
An earlier approach used per-student overrides to grade individual students: add override → grade → delete override. This works but has two problems:
1. The override makes the assignment visible to that student while it exists
2. After override deletion, `workflow_state` becomes `deleted` on the submission, though the outcome result persists

This approach was abandoned in favor of the visibility toggle pattern (Setting 1).

---

## Confirmed Production Setup Sequence

```
1. POST assignment
   only_visible_to_overrides: false   ← visible so Canvas creates submission records
   points_possible: 0
   omit_from_final_grade: true
   submission_types: ['none']
   published: true
   grading_type: 'points'

2. POST rubric with rubric_association
   use_for_grading: true
   purpose: 'grading'
   → Canvas resets points_possible to 4 (rubric total)

3. GET assignment to read criterion ID
   → rubric[0].id gives the criterion ID (e.g. "_1024")
   → criterion IDs always have underscore prefix — this is permanent, not temporary

4. Wait 3 seconds
   → Canvas needs time to create submission records for all enrolled students

5. GET submissions to cache submission IDs
   → submission IDs are permanent — safe to cache indefinitely
   → departed students: their submission IDs stay cached but are skipped during sync

6. PUT assignment — final state enforcement
   only_visible_to_overrides: true    ← hidden from student assignments list
   points_possible: 0                 ← reset after rubric creation changed it

7. (No post_manually setting needed)
   → Grades auto-post so students see scores in Learning Mastery Gradebook
   → Assignment hidden from assignments list and gradebook columns
   → Score visible in LMGB to both teachers and students
```

---

## What Students See vs What Teachers See

| Location | `only_visible_to_overrides: true` + grades posted | Notes |
|---|---|---|
| Assignments list | ❌ Hidden | Assignment does not appear |
| Gradebook column | ❌ Hidden | No column in student gradebook |
| Learning Mastery Gradebook | ✅ Visible | Score shows as outcome rollup |
| Recent Feedback | ✅ Visible | Notification sent when grade posted |
| Assignment detail page | ❌ "You don't have access" | If navigated to directly |
| Teacher gradebook | ✅ Visible | Shows in its own column |
| Teacher Learning Mastery Gradebook | ✅ Visible | Matches student LMGB |

### Recent Feedback notification
The Recent Feedback widget on the course home page will show the assignment name and score when a grade is first posted. This is acceptable — it shows the student their projected score by name (e.g. "Outcome 1 — Projected Score: Approaching Target"). Subsequent updates to the same assignment do not generate new notifications if the student has already seen the first one.

---

## Canvas API Quirks Summary

| Quirk | Impact | Workaround |
|---|---|---|
| `post_manually: true` in REST body is silently ignored | Grade hiding via REST doesn't work | Use GraphQL `setAssignmentPostPolicy` — or don't use post_manually at all |
| Rubric creation resets `points_possible` to rubric total | Assignment shows "Out of 4" | PUT assignment after rubric creation to reset to 0 |
| `only_visible_to_overrides: true` prevents submission record creation | GraphQL `saveRubricAssessment` fails with "Submission not found" | Create assignment visible first, flip to hidden after fetching submission IDs |
| Submission records persist after `only_visible_to_overrides` flip | Safe to cache submission IDs permanently | No workaround needed — this is the desired behavior |
| Criterion IDs always have underscore prefix (e.g. `_1024`) | Must format as `criterion__1024` in GraphQL assessmentDetails | Always use `criterion_${criterionId}` — the double underscore is correct |
| `submission_types: ['none']` not `'not_graded'` | `'not_graded'` causes 422 error | Always use `['none']` for no-submission assignments |
| REST `POST /assignments/:id/post_policy` returns 404 | Can't set posting policy via REST | Use GraphQL `setAssignmentPostPolicy` mutation |
| Outcome results persist after assignment deletion | Deleting a PL override assignment doesn't clear outcome rollups | Good — rollup history survives cleanup. Bad — old test data can persist |
