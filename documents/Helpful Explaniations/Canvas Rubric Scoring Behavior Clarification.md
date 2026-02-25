# Canvas Rubric Scoring Behavior Clarification

## What Canvas Actually Does

Canvas rubric grading works in three distinct layers:

### Layer 1 – Criterion Scoring
Each rubric criterion has a setting:

- **Checked** → contributes to the rubric total
- **Unchecked ("Use this criterion for scoring")** → does NOT contribute to the rubric total

If all criteria are unchecked, the rubric produces **no numeric total**.

---

### Layer 2 – Rubric Total
The rubric total is calculated as the sum of all criteria marked for scoring.

If no criteria are used for scoring:

- Rubric total = 0
- No meaningful numeric value is generated

---

### Layer 3 – Assignment Score
The assignment score is updated from the rubric total **only if**:

- “Use this rubric for assignment grading” is checked
- A rubric total exists (from scoring-enabled criteria)

If Layer 1 produces no numeric total, Layer 3 has nothing to apply.

---

## Important Clarification About Documentation

Some Canvas help documentation states:

> “Check ‘Use this rubric for assignment grading’ so that the rubric score will be used as the assignment score.”

This statement is **incomplete** and can be misleading.

It is only true when:

- At least one rubric criterion is marked for scoring
- The rubric produces a numeric total
- The assignment has meaningful points possible

If all criteria have “Use this criterion for scoring” unchecked:

- The rubric does NOT generate a score
- The assignment grade will NOT update
- Manual grade entry would still be required

---

## Special Case: Outcome-Only Rubrics

Canvas still updates **Outcome mastery** when rubric ratings are selected, even if:

- Criteria are not used for scoring
- The assignment grade does not change
- The assignment is worth 0 points

This demonstrates that:

- Outcome scoring and assignment grading are separate systems in Canvas.

---

## Summary

“Use this rubric for assignment grading” only applies an existing rubric total to the assignment score.

If no scoring criteria exist, there is no total to apply.

Therefore, the website statement is technically incomplete and does not account for:

- All criteria ignored
- Outcome-only rubrics
- 0-point assignments
- Standards-based grading configurations

Understanding this separation is critical when designing outcome-driven or standards-based grading systems.