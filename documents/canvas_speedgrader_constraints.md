# Canvas SpeedGrader + Outcome Rubrics

## Technical Findings and Constraints

### Summary

We investigated why **SpeedGrader does not populate the grade box** when teachers submit a rubric assessment in Canvas for standards-based (outcomes-aligned) assignments.

After extensive API and UI-level testing, the behavior is confirmed to be **by design** and enforced consistently by Canvas.

---

## Key Finding (Executive Summary)

**Canvas will not calculate or populate an assignment grade from a rubric unless *all* of the following are true:**

1. The assignment has **points possible > 0**
2. The rubric is **associated with the assignment** and `use_for_grading = true`
3. The rubric contains **at least one scoring criterion**
    - `ignore_for_scoring = false`
    - **not locked to a learning outcome with existing results**

If **any** of these conditions are not met, SpeedGrader will allow rubric assessment submission but will **leave both `score` and `grade` as `null`**.

---

## Why This Happens in Standards-Based Courses

In standards-based setups (such as the Sedalia configuration), teachers are explicitly instructed on how to import and attach learning outcomes to rubrics in a **non-scoring** way.

### Outcome Import (Instructor Workflow)

When importing an outcome into a rubric, teachers are directed to:

- Select the appropriate learning outcome
- **Leave the “Use this criterion for scoring” box unchecked**
- Import the outcome into the rubric for assessment purposes only

Leaving this option unchecked is intentional. If it is checked, Canvas will automatically make the assignment worth the full point value of the outcome (for example, 4 points), which is not desired in a standards-based grading model.

This results in outcome-linked rubric criteria being deliberately configured as non-scoring (`ignore_for_scoring = true`).

---

### Rubric Attachment to the Assignment

After the rubric is built, teachers are then instructed to:

- Select **“Use this rubric for assignment grading”**
- Verify that the rubric shows **“Total Points: 0”**
- Click **“Update Rubric”** to attach it to the assignment

This step is required so the rubric is visible and usable within SpeedGrader.

However, this setting controls **rubric visibility and workflow**, not scoring behavior.

Even though the rubric is marked “for assignment grading”:

- The total points remain **0**
- The rubric still contains **no scoring criteria**
- No assignment points are generated from rubric submission

---

### Why This Creates Confusion

From an instructor’s perspective, this workflow appears contradictory:

- The rubric is explicitly attached *for grading*
- SpeedGrader allows rubric assessment and submission
- Numeric performance levels are selected (e.g., 3, 4)

Yet the assignment grade box remains empty.

This is because, despite the UI language, the rubric is functioning strictly as an **outcome assessment tool**, not a scoring mechanism. Canvas does not compute assignment grades unless the rubric contains at least one scoring-enabled criterion.

---

### Key Distinction

- **“Use this rubric for assignment grading”**  
  → Controls whether the rubric appears in SpeedGrader

- **“Use this criterion for scoring”**  
  → Controls whether Canvas can calculate an assignment grade

In standards-based configurations, the first option is enabled while the second is intentionally disabled, resulting in valid outcome assessment without automatic grade calculation.


This applies even if:

- The assignment has points possible
- `use_rubric_for_grading = true`
- Teachers click **Submit Assessment**
- The rubric displays numeric values

## Confirmed Canvas Enforcement Rules

#### 1. Outcome-linked criteria are permanently non-scoring

Attempts to set:

```javascript
"ignore_for_scoring": false
```

on outcome criteria with results return errors such as:

```
"This rubric removes criterions that have learning outcome results"
```

This applies via:

- REST API
- UI
- GraphQL

#### 2. Rubric association APIs are partially restricted

In this environment:

- Creating rubric associations (POST) is allowed
- Updating or deleting associations (PUT, DELETE) may return 404

The Canvas UI uses internal routes (not /api/v1) which may fail silently

This can result in:

- UI error messages
- State changes still occurring server-side

#### 3. SpeedGrader does not infer grades

SpeedGrader never infers assignment grades from:

- Outcome mastery levels
- Rubric display values
- Learning Mastery Gradebook averages

If the rubric does not contribute to scoring, the grade box is intentionally left blank.

---

## What Does Work Reliably

### Supported by Canvas

- Assignments with scoring rubrics
- Rubrics with non-outcome criteria
- Explicit grade updates via API or UI

### Not Supported (by design)

- Automatic grade calculation from outcome-only rubrics
- Re-enabling scoring on outcome criteria after assessment
- SpeedGrader grade population without scoring criteria

---

## Practical Implications

For standards-based grading models:

- Outcome rubrics should be treated as assessment tools, not grading tools
- Assignment grades must be set using one of the following:
  - A separate scoring rubric
  - A calculated value written explicitly (e.g., "Refresh Mastery" workflow)
  - Manual or automated grade updates via API

This is not a bug or misconfiguration — it is an intentional Canvas constraint.

---

## Conclusion

Canvas enforces a strict separation between:

- Outcome assessment (mastery tracking) and
- Assignment grading (points/grades)

Because of this:

- SpeedGrader will never auto-populate grades from outcome-only rubrics.

Any solution must either:

- Introduce a scoring rubric component, or
- Explicitly write grades after mastery is calculated