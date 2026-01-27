# Single Source of Truth Refactoring

## Problem Statement

The codebase had duplicate logic for grade conversion and display across multiple pages:
- **Dashboard** used `calculateDisplayValue()` to convert grades
- **All-Grades Page** had its own conversion logic in `enrichCoursesWithSnapshots()`
- **Grade Page** used raw snapshot values

This caused:
1. **Inconsistent display** - Same course showed different formats on different pages
2. **Duplicate code** - Conversion logic existed in multiple places
3. **Confusion** - Hard to understand which logic was authoritative
4. **Maintenance burden** - Changes needed in multiple places

## Solution

**Single Source of Truth**: The snapshot service now calculates display values once and stores them in session storage. All pages use these pre-calculated values.

### Architecture Changes

```
BEFORE:
┌─────────────────┐
│ Snapshot Service│
│ - Stores raw %  │
│ - Stores model  │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┐
    │          │          │
┌───▼───┐  ┌──▼───┐  ┌───▼────┐
│Dashboard│ │All-Gr│ │Grade Pg│
│Convert  │ │Convert│ │Use raw │
│to points│ │to pts │ │values  │
└─────────┘ └──────┘ └────────┘
  (Different logic in each)

AFTER:
┌──────────────────────────┐
│   Snapshot Service       │
│ - Stores raw score       │
│ - Stores model           │
│ - CALCULATES display     │
│   values (ONCE)          │
│ - displayScore           │
│ - displayLetterGrade     │
│ - displayType            │
└────────┬─────────────────┘
         │
    ┌────┴─────┬──────────┐
    │          │          │
┌───▼───┐  ┌──▼───┐  ┌───▼────┐
│Dashboard│ │All-Gr│ │Grade Pg│
│Use      │ │Use   │ │Use     │
│display  │ │display│ │display │
│values   │ │values │ │values  │
└─────────┘ └──────┘ └────────┘
  (Identical rendering)
```

## Changes Made

### 1. Snapshot Service (`src/services/courseSnapshotService.js`)

**Added display fields to snapshot structure:**
```javascript
{
  // ... existing fields ...
  displayScore: number,                // Display-ready score (converted to points for SBG)
  displayLetterGrade: string|null,     // Display-ready letter grade
  displayType: 'points' | 'percentage' // How to display the score
}
```

**Added display calculation in `populateCourseSnapshot()`:**
- Uses `calculateDisplayValue()` to determine how to display the grade
- Parses the result to extract display values
- Stores in snapshot for all pages to use

**New imports:**
- `percentageToPoints`, `calculateDisplayValue`, `DISPLAY_SOURCE` from `gradeFormatting.js`
- `scoreToGradeLevel` from `gradeExtractor.js`
- `GRADE_SOURCE` from `gradeDataService.js`

### 2. All-Grades Page (`src/student/allGradesPageCustomizer.js`)

**Simplified `enrichCoursesWithSnapshots()`:**
- Removed all conversion logic
- Removed enrollment data extraction
- Now just reads `displayScore`, `displayLetterGrade`, `displayType` from snapshot
- 50% less code, much clearer

**Removed imports:**
- `scoreToGradeLevel` (no longer needed)
- `percentageToPoints` (no longer needed)
- `populateCourseSnapshot` (no longer needed)

### 3. Dashboard (`src/dashboard/gradeDisplay.js`)

**Updated `updateCourseCard()`:**
- Changed to pass `displayScore`, `displayLetterGrade`, `displayType` to renderer
- Added `displayType` to gradeData object

### 4. Dashboard Card Renderer (`src/dashboard/cardRenderer.js`)

**Rewrote `formatGradeDisplay()`:**
- No longer calls `calculateDisplayValue()`
- Now formats pre-calculated display values
- Simpler logic: just format based on `displayType`

**Updated function signatures:**
- `formatGradeDisplay()` now expects `displayType` parameter
- `createGradeBadge()` now expects `displayType` parameter
- `renderGradeOnCard()` now expects `displayType` parameter

**Removed imports:**
- `calculateDisplayValue`, `DISPLAY_SOURCE` (no longer needed)

### 5. Grade Page Customizer (`src/student/gradePageCustomizer.js`)

**Updated grade data extraction:**
- Changed from `snapshot.score` to `snapshot.displayScore`
- Changed from `snapshot.letterGrade` to `snapshot.displayLetterGrade`

## Benefits

1. **Consistency** - All pages show identical grades for the same course
2. **Single Source of Truth** - Display logic exists in ONE place (snapshot service)
3. **Performance** - Conversion happens once, not on every render
4. **Maintainability** - Changes to display logic only need to happen in one place
5. **Clarity** - Each module has a clear responsibility

## Testing Checklist

- [ ] Dashboard shows correct grades (points for SBG, % for traditional)
- [ ] All-grades page shows identical grades to dashboard
- [ ] Grade page shows correct mastery score
- [ ] Session storage caching still works
- [ ] Refresh logic still works correctly
- [ ] Standards-based courses show points (e.g., "2.74 (Developing)")
- [ ] Traditional courses show percentages (e.g., "85.00%")
- [ ] Same course shows same grade on all pages

