## Canvas Outcome Scoring Source of Truth

### Technical Explanation

In Canvas, **outcome scores are derived exclusively from rubric criterion ratings that are aligned to outcomes**. Assignment-level properties such as points possible, assignment grades, grading schemes (letter/percentage), or grade overrides do **not** directly influence outcome scores.

Changing an assignment’s `points_possible` may trigger recalculation or cache invalidation in the Gradebook UI, which can cause existing mastery or outcome results to appear or refresh. However, this process does **not** modify rubric assessments or outcome data. Only changes to rubric ratings (including reassessments) can update outcome scores.

This behavior is consistent across traditional Gradebook and Learning Mastery views and explains why temporarily assigning points can refresh mastery displays without altering underlying outcome values.

### Concise Reference

**Only rubric ratings update outcome scores; assignment grades and points do not.**