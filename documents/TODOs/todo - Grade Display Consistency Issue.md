# TODO

## Grade Display Consistency Issue

**Problem**: Student and teacher pages display grades differently when Canvas returns numeric letter grades.

**Current Behavior**:
- **Student page**: Shows `1.79 (1.79)` or just `1.79` when Canvas returns numeric grade
    - Uses cached snapshot data
    - Suppresses numeric letter grades via `calculateDisplayValue()` in `gradeFormatting.js`
    - Does not calculate descriptive letter grades from scores

- **Teacher page**: Shows `1.79 (Beginning)`
    - Fetches fresh data from Canvas API
    - Calculates letter grade from score using `scoreToGradeLevel()` when Canvas returns numeric grade
    - Provides descriptive feedback based on `OUTCOME_AND_RUBRIC_RATINGS` scale

**Root Cause**:
Canvas assignment doesn't have a grading scheme configured, so it returns the score as both `score` and `grade` (e.g., `score: 1.79, grade: "1.79"`). The student page suppresses this numeric "letter grade" while the teacher page converts it to a descriptive grade.

**Recommendation**:
Make both pages calculate descriptive letter grades from scores when Canvas returns numeric grades. This provides:
- Consistent display across teacher and student views
- More informative feedback for students (shows what the score means)
- Proper standards-based grading display
- Independence from Canvas grading scheme configuration

**Files Involved**:
- `src/utils/gradeFormatting.js` - Contains logic that suppresses numeric letter grades
- `src/teacher/teacherStudentGradeCustomizer.js` - Contains logic that calculates letter grades
- `src/services/courseSnapshotService.js` - Uses `calculateDisplayValue()` for student page
- `src/student/gradeExtractor.js` - Contains `scoreToGradeLevel()` function

**Next Steps**:
1. Modify `calculateDisplayValue()` to calculate letter grades from scores when grade is numeric (similar to teacher page logic)
2. Test with courses that have and don't have grading schemes configured
3. Verify consistency across student page, teacher page, dashboard, and all-grades page