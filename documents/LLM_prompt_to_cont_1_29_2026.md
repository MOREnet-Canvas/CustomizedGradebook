# LLM Prompt, Continue SpeedGrader Rubric Work (Sedalia)

You are working on a Canvas LMS customization project in a K12 standards-based setup.

## Goal
We need a reliable, automatable process that makes SpeedGrader populate the grade box when a teacher clicks **Submit Assessment** on an outcome-aligned rubric, even though the district ultimately wants assignments to be 0 points.

We discovered the critical behavior:

- SpeedGrader will populate the grade box from the rubric only when:
    - rubric criteria are scorable (`ignore_for_scoring = false`), and
    - the rubric has non-zero total points (`rubric_settings.points_possible > 0`), and
    - the assignment has non-zero points at grading time (for example 4).
- After grading, running **Refresh Mastery** resets assignment points back to 0, but the submission retains a valid `score` and `grade` label, and the label stays aligned with the rubric rating.

We need code/process to:
1) Detect “will not save grade” state (common Sedalia state):
    - `assignment.points_possible = 0` AND rubric criteria `ignore_for_scoring = true` OR rubric total points = 0
2) Convert to “grading session state” where SpeedGrader will write the grade:
    - set criterion `ignore_for_scoring = false`
    - ensure rubric total points is 4
    - set assignment points_possible to 4 (temporarily)
3) After teachers grade, allow Refresh Mastery to reset assignment points to 0 (do not fight it)
4) Preserve / verify submission grade correctness after refresh (submission.grade matches rubric rating)

## Constraints / Lessons Learned
- In Canvas, editing the rubric criteria on an outcome-linked rubric that already has outcome results can be blocked.
    - We saw API responses that effectively prevent changing a rubric’s criteria when it would remove/alter learning outcome results.
- Therefore we need a fallback strategy:
    - If direct PATCH/PUT cannot flip `ignore_for_scoring` on an existing rubric, we must recreate the rubric exactly (same outcomes, same ratings) except set `ignore_for_scoring = false`.

## Required Implementation Deliverables
Create JavaScript (console-testable first) that does the following:

### A) Identify Current Context from the Browser
Given we may be on SpeedGrader or assignment pages:
- Determine `courseId` and `assignmentId`
- Fetch assignment details via:
    - GET `/api/v1/courses/:courseId/assignments/:assignmentId?include[]=rubric`
- From the response, extract:
    - `assignment.points_possible`
    - `assignment.use_rubric_for_grading`
    - `assignment.rubric_settings.points_possible`
    - rubric criteria array, including `id`, `learning_outcome_id`, `ratings`, `ignore_for_scoring`, and `points`

### B) “Can We Flip ignore_for_scoring Directly?”
Attempt the safest direct update path first, without deleting anything:
- Update the rubric criteria to set `ignore_for_scoring = false`
- Ensure `rubric_settings.points_possible = 4`
- Update assignment `points_possible = 4`
- Report success/failure and capture detailed error body (including `errors`, `messages`, and any `error_report_id`)

### C) Fallback: Recreate Rubric if Direct Edit is Blocked
If Canvas blocks the update because the rubric is already tied to outcome results:
1) Snapshot the existing rubric so we can rebuild it exactly:
    - list of criteria:
        - `learning_outcome_id`
        - `description`, `long_description`, `points`
        - full `ratings` list with points + descriptions
        - `mastery_points`
2) Create a new rubric with the exact same criteria but:
    - `ignore_for_scoring = false`
    - ensure rubric points total = 4
3) Reassociate the new rubric to the assignment (use_for_grading=true, purpose=grading)
4) Optionally remove the old rubric association (only if safe), but do NOT delete the rubric if it might be shared elsewhere.
5) Verify:
    - assignment now has rubric settings points = 4
    - criterion ignore_for_scoring false
    - assignment points_possible set to 4

### D) Verification Steps (Automated Checks)
After running the “grading session” conversion, provide helper functions to confirm:
- SpeedGrader will be able to write grades:
    - rubric total points > 0
    - at least one criterion ignore_for_scoring false
    - assignment points_possible > 0 (temporarily)
- After grading and running Refresh Mastery:
    - assignment points_possible may return to 0
    - submission remains graded:
        - `submission.score` populated
        - `submission.grade` matches rubric rating label

Use:
- GET rubric with assessments:
    - GET `/api/v1/courses/:courseId/rubrics/:rubricId?include[]=assessments&style=full`
- GET submission:
    - GET `/api/v1/courses/:courseId/assignments/:assignmentId/submissions/:userId`

### E) Output Requirements
- Produce console scripts that are copy/pasteable.
- Log each network call, URL, status, and JSON body preview.
- Never assume DOM selectors for SpeedGrader exist, because SpeedGrader pages may not have obvious IDs or classes.
- Prefer Canvas API calls and environment parsing.

## What I want you to produce now
1) A clear plan (bulleted) for the robust implementation
2) A single JS console script implementing A+B (direct update attempt) with good diagnostics
3) A second JS console script implementing C (snapshot + recreate rubric + reassociate) as a fallback

Make minimal diffs and keep it practical for my existing Canvas theme/extension codebase.