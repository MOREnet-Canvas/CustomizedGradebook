# SpeedGrader, Outcome Rubrics, and Why Grades Don’t Save (Sedalia Scenario)

## Summary
We reproduced the Sedalia SpeedGrader issue where clicking **Submit Assessment** on an outcome-aligned rubric does **not** populate the SpeedGrader grade box, and the submission remains ungraded.

We also found a reliable configuration that *does* cause SpeedGrader to populate the grade box from the rubric, and we confirmed what happens after running **Refresh Mastery**.

---

## What Causes the “Grade Box Stays Blank” Behavior
In the failing setup:

- The **assignment** has:
    - `points_possible = 0`
    - `use_rubric_for_grading = true`
- The **rubric criteria** used are outcome-linked and configured so they do **not** contribute to scoring:
    - criterion-level `ignore_for_scoring = true`
- When teachers submit the rubric assessment in SpeedGrader, Canvas records the outcome alignment, but **does not write** a numeric assignment score to the submission, so the SpeedGrader grade box stays empty.

This is consistent with Canvas treating the rubric as “outcomes reporting” rather than “scoring.”

---

## What Configuration *Does* Make SpeedGrader Populate the Grade Box
We created a working case on assignment `3458` (course `565`) by changing rubric/assignment settings so the rubric is a “scorable rubric” even though the assignment later returns to 0 points.

The working configuration had:

- Criterion-level:
    - `ignore_for_scoring = false` (scoring is enabled)
- Rubric total points:
    - `rubric_settings.points_possible = 4`
- Assignment points:
    - temporarily `assignment.points_possible = 4` (during grading)

With these settings:
- Submitting the rubric assessment in SpeedGrader **populates the grade box**
- Canvas writes `submission.score`, and `submission.grade` matches the rubric rating label (for example “Beyond Target”)

---

## What Happens After Running “Refresh Mastery”
After grading with the scorable rubric, we ran **Refresh Mastery**.

Observed behavior:
- `assignment.points_possible` is reset to `0`
- The graded submission remains valid:
    - `submission.score` stays populated
    - `submission.grade` continues to match the rubric rating label
- The rubric itself continues to show `rubric_settings.points_possible = 4` and criterion points, even while the assignment points are 0.

This is important:
- It means teachers can grade successfully in SpeedGrader (because the rubric is scorable and assignment points are temporarily non-zero),
- Then the course can return to the desired standards-based configuration after Refresh Mastery (assignment points back to 0), without losing the stored grades.

---

## Key Fields We Verified (Diagnostics)
The “three point concepts” that matter:

1) Assignment points:
```json
{
  "assignment.points_possible": 0
}
```

2) Rubric total points:
```json
{
  "assignment.rubric_settings.points_possible": 4
}
```

3) Criterion points and scoring flag:
```json
{
  "rubric[0].points": 4,
  "rubric[0].ignore_for_scoring": false
}
```

We also verified that after rubric submission and refresh:
- The submission object contains:
    - `submission.score` (numeric)
    - `submission.grade` (label)
    - `submission.workflow_state = "graded"`

---

## Operational Recommendation (Teacher Workflow)
If the district wants assignments to end up as 0-point standards-based entries but still wants rubric submission to create an actual grade:

1) Temporarily ensure:
    - rubric criteria are scorable (`ignore_for_scoring = false`)
    - rubric has points (`rubric_settings.points_possible > 0`)
    - assignment points are non-zero during grading (for example 4)

2) Teachers grade in SpeedGrader using the rubric and click **Submit Assessment**
    - grade box populates and assignment score/grade is stored

3) Run **Refresh Mastery**
    - assignment points return to 0
    - stored submission score/grade remains intact and matches rubric rating label

---

## Notes About Changing Existing Outcome Rubrics
Canvas may block editing certain rubric criteria when outcome results already exist, especially if changes would affect scoring. This is why we sometimes need a “recreate rubric with same outcomes” approach when the rubric has already been used for grading.