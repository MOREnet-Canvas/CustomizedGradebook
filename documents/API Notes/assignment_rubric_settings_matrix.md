# Canvas “Average Learning Mastery Grade” settings matrix

This matrix focuses on the exact knobs in your snippets and what they tend to do in practice (grade storage, scheme interpretation, and whether the SpeedGrader/gradebox “auto-updates”).

## A) Submission update payload (bulk gradeData)

| Setting | Your current value | Recommended for your flow | What it changes | Common gotcha / note |
|---|---:|---:|---|---|
| `posted_grade` | `average` (number) | **String** `"3.5"` (or keep number if your API client stringifies) | The value Canvas interprets as the submitted grade input | If this matches a grading scheme value (e.g., 3.0 / 3.5 / 4.0), Canvas can treat it like a scheme token depending on context. |
| `prefer_points_over_scheme` | `false` | **true** (for numeric averages) | If `posted_grade` looks like a grading scheme value, this tells Canvas to treat it as **points** instead of scheme | This is the safest default when you are sending numeric averages that might equal scheme values. |
| `text_comment` | `"Score: ... Updated: ..."` | optional | Adds a submission comment | If you run this often, you’ll generate lots of comments. |
| `rubric_assessment[criterionId].points` | `average` | keep | Sets rubric criterion points | **Rubric points do not reliably drive gradebox** unless scoring criteria + nonzero assignment points are satisfied (see rubric section). |

---

## B) Rubric + rubric association behavior

| Setting | Your current value | Recommended for your flow | What it changes | Common gotcha / note |
|---|---:|---:|---|---|
| `rubric.criteria[0].ignore_for_scoring` | `true` | depends | Whether rubric criterion counts toward assignment scoring | If **all criteria** are `ignore_for_scoring: true`, Canvas treats the rubric as evaluative; it won’t propagate rubric totals into the gradebox. |
| `rubric_association.use_for_grading` | `true` | keep | Marks rubric usable in grading UI | This does **not** force Canvas to compute assignment score from rubric points. |
| `rubric_association.purpose` | `"grading"` | keep | Categorizes association | Still won’t override the “must be grade-bearing” rules. |
| `rubric_association.hide_points` | `false` | optional | Show/hide rubric points | Cosmetic; doesn’t fix propagation. |

---

## C) Assignment settings (the “Average Learning Mastery Grade” assignment)

| Setting | Your current value | Recommended for your flow | What it changes | Common gotcha / note |
|---|---:|---:|---|---|
| `points_possible` | `0` | **0 if you must** (SBG pattern) OR `DEFAULT_MAX_POINTS` if you can | Whether assignment is considered grade-bearing | If `0`, Canvas often won’t update gradebox from rubric (even with `use_for_grading`). API grade updates can still store a score. |
| `grading_type` | `"gpa_scale"` | `"gpa_scale"` (ok) | How Canvas displays and interprets grading inputs | With GPA, numeric values often match scheme values → increases need for `prefer_points_over_scheme: true`. |
| `grading_standard_id` | `7` | keep (if correct scheme) | Which grading scheme is used for GPA/letter conversions | If wrong scheme ID, you’ll see unexpected labels/levels or conversions. |
| `omit_from_final_grade` | `true` | keep | Excludes from course total | Great for “utility” assignments, but it also means it won’t affect final grade calculations (by design). |
| `submission_types` | `["none"]` | keep | No student submissions required | Still allows teacher grading / API submission updates. |
| `published` | `true` | keep | Visibility | Unpublished assignments can behave weirdly with some grade displays. |
| `notify_of_update` | `true` | optional | Notifies about changes | In bulk updates, this can spam notifications depending on settings. |

---

## D) “What happens” matrix (key combinations)

| points_possible | any rubric criterion ignore_for_scoring=false? | Are you relying on rubric to drive gradebox? | Likely gradebox auto-updates from rubric? | Can API `posted_grade` store a numeric grade? | Notes |
|---:|---:|---:|---:|---:|---|
| 0 | no (all true) | yes | ❌ No | ✅ Yes | This is your current rubric pattern: rubric saves, but gradebox won’t propagate from rubric. |
| 0 | yes (at least one false) | yes | ❌ Usually still no | ✅ Yes | Zero points still blocks the “grade-bearing” path in many places. |
| >0 | no (all true) | yes | ❌ No | ✅ Yes | Even with points, if everything is ignore_for_scoring, rubric won’t compute assignment score. |
| >0 | yes (≥1 false) | yes | ✅ Usually yes | ✅ Yes | This is the classic “rubric drives gradebox” setup. |
| 0 or >0 | (any) | **no** (you compute + PUT grade) | N/A | ✅ Yes | Your script-driven approach: compute average and send it via API; use `prefer_points_over_scheme: true` to avoid scheme ambiguity. |

---

## E) CSV version (same info, compact)

```csv
Category,Setting,Your Value,Recommended,Effect,Gotcha
Submission,posted_grade,average,"""3.5"" (string)","Value Canvas interprets as grade","May match scheme values"
Submission,prefer_points_over_scheme,false,true,"Treat posted_grade as points if it matches scheme","Important for GPA/letter-style schemes"
Submission,text_comment,"Score...Updated...",optional,"Adds comment to submission","Can create lots of comments over time"
Submission,rubric_assessment.points,average,keep,"Sets rubric criterion points","Does not guarantee gradebox updates"
Rubric,ignore_for_scoring,true,depends,"Whether criterion counts toward assignment total","All true => rubric won't propagate to gradebox"
RubricAssoc,use_for_grading,true,keep,"Rubric shows in grading UI","Does not force grade computation"
RubricAssoc,purpose,grading,keep,"Categorizes association","Does not override grade-bearing rules"
Assignment,points_possible,0,"0 (if required) or >0","Grade-bearing signal","0 often blocks rubric->gradebox"
Assignment,grading_type,gpa_scale,gpa_scale,"Display/interpretation rules","Increases scheme-value ambiguity"
Assignment,grading_standard_id,7,keep,"Which scheme is used","Wrong ID => unexpected labels/levels"
Assignment,omit_from_final_grade,true,keep,"Excluded from final grade","By design"
Assignment,submission_types,[none],keep,"No submissions required","Still gradeable via API"
```