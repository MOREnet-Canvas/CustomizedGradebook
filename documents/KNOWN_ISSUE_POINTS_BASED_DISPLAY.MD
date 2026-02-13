

# KNOWN ISSUE: Points-Based Traditional Courses Display

## Issue Summary

The script currently displays some traditional-ish (non-standards-based, but points based) courses in points 
format instead of percentage format, even though it doesn't actually read Canvas's grading scheme settings.

## Current Behavior

When a traditional course has:
- An enrollment grade with a letter grade (e.g., "Developing", "Target")
- That letter grade matches the script's configured rating scale (`OUTCOME_AND_RUBRIC_RATINGS`)

The script will:
1. Convert the percentage to points: `percentage / 100 * DEFAULT_MAX_POINTS`
2. Display as points (e.g., "3.22 / 4.00" or "3.22 (Developing)")
3. Set `displayType = 'points'`

## Why This Happens

**Location:** `src/utils/gradeFormatting.js` → `calculateDisplayValue()`

```javascript
// When source is ENROLLMENT and letter grade matches rating scale
if (source === DISPLAY_SOURCE.ENROLLMENT) {
    const isValidGrade = isValidLetterGrade(letterGrade);
    
    if (isValidGrade) {
        // Converts percentage to points using DEFAULT_MAX_POINTS (4)
        const pointValue = percentageToPoints(score);
        displayValue = `${pointValue.toFixed(2)} (${letterGrade})`;
    }
}
```

## The Problem

The script does **NOT** read Canvas's actual grading scheme settings:
- `show_total_grade_as_points` (whether Canvas displays as points)
- `points_based` (whether grading scheme is points-based)
- `scaling_factor` (the actual max points, e.g., 4, 5, 10)

Instead, it makes its own decision based on:
- Whether the letter grade matches the script's rating scale
- Hardcoded `DEFAULT_MAX_POINTS = 4`

## When It Works (By Coincidence)

The display is **correct** when:
- Course uses a 4-point grading scheme (matching `DEFAULT_MAX_POINTS`)
- Letter grades match the script's rating scale
- Canvas's calculation aligns with `percentage / 100 * 4`

**Example:** Traditional course with:
- `effective_final_score: 80.5%`
- `current_grade: "Developing"`
- `scaling_factor: 4`
- Script shows: `3.22 / 4.00` ✓ Correct

## When It Would Fail

The display would be **incorrect** when:
- Course uses a different point scale (e.g., 5, 10, 100 points)
    - Script shows: `4.03 / 4.00` (should be `5.03 / 5.00`)
- Letter grades don't match the rating scale
    - Script shows: `80.50%` (might should be `3.22 / 4.00`)
- Custom grading schemes with different conversions

## Impact

**Currently Affected:**
- Traditional courses with points-based grading schemes
- All-grades page display
- Dashboard display (if traditional courses are shown)

**Not Affected:**
- Standards-based courses (AVG assignment) - these work correctly
- Canvas's native grade pages - Canvas handles these correctly

## Potential Solutions

### Option 1: Keep As-Is (Current Decision)
- Accept that some traditional courses display as points
- Works for current use case
- Risk of incorrect display with different grading schemes

### Option 2: Only Customize Standards-Based Courses
- Remove conversion logic for enrollment grades
- Only convert when source is `ASSIGNMENT` (AVG assignment)
- Let Canvas handle traditional courses natively
- Simpler, more maintainable

### Option 3: Read Actual Grading Scheme Settings
- Fetch grading scheme data from Canvas API
- Use `show_total_grade_as_points` and `scaling_factor`
- Display exactly as Canvas would
- More complex, requires additional API calls

## Related Code

**Key Files:**
- `src/utils/gradeFormatting.js` - Conversion logic
- `src/services/courseSnapshotService.js` - Display value calculation
- `src/utils/courseDetection.js` - Course classification

**Key Functions:**
- `calculateDisplayValue()` - Decides points vs percentage
- `percentageToPoints()` - Converts percentage to 4-point scale
- `isValidLetterGrade()` - Checks if letter grade matches rating scale

## Decision

**Status:** Leaving as-is for now (2026-01-27)

**Rationale:**
- Works for current use case
- No immediate issues reported
- Can revisit if problems arise with different grading schemes

---

**Document Location:** This should be saved as `docs/POINTS_BASED_TRADITIONAL_COURSES.md`

This document provides:
- Clear description of the issue
- Why it happens (with code reference)
- When it works vs. fails
- Potential solutions for future consideration
- Current decision and rationale

Would you like me to suggest any additions or modifications to this document?