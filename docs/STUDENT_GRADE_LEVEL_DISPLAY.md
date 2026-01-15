# Student Grade Level Display Enhancement

## Overview

Enhanced the student grade normalization feature to display both the numeric score AND the grade level description (e.g., "Target", "Developing") together in the overall grade display.

## Changes Made

### 1. Updated Grade Extraction (`src/student/gradeExtractor.js`)

**Before:**
```javascript
export function extractCurrentScoreFromPage() {
    // ... code ...
    return "2.74";  // Just the numeric score
}
```

**After:**
```javascript
export function extractCurrentScoreFromPage() {
    // ... code ...
    return {
        score: "2.74",
        letterGrade: "Developing"
    };
}
```

**Key Changes:**
- Now returns an object with both `score` and `letterGrade` instead of just a string
- First attempts to extract letter grade from the DOM (Canvas may display it)
- Falls back to calculating letter grade using `scoreToGradeLevel()` if not found in DOM
- Matches letter grades against configured `OUTCOME_AND_RUBRIC_RATINGS` scale

### 2. Updated Grade Page Customizer (`src/student/gradePageCustomizer.js`)

**Added:**
- `formatGradeDisplay(score, letterGrade)` - Formats display as "3.0 (Target)"
- Updated `replaceRightSidebar()` to accept gradeData object and display formatted grade
- Updated `applyCustomizations()` to pass gradeData object
- Updated `runOnce()` to handle new return format

**Display Format:**
- With letter grade: `"3.0 (Target)"`
- Without letter grade: `"3.0"`

### 3. Updated Grade Normalizer (`src/student/gradeNormalizer.js`)

**Added:**
- `formatGradeDisplay(score, letterGrade)` - Same formatting function
- Updated `normalizeFinalGradeRow()` to display both score and letter grade

**Final Grade Row Display:**
- Before: `"3.0"` or `"67.43%"` (percentage)
- After: `"3.0 (Target)"` or `"2.5 (Approaching Target)"`

## Display Examples

### Sidebar Display
**Before:**
```
Current Score: 2.74
```

**After:**
```
Current Score: 2.74 (Developing)
```

### Final Grade Row
**Before:**
```
Grade: 67.43%
```

**After:**
```
Grade: 2.74 (Developing)
```

### Grade Levels Mapping

Based on the configured `OUTCOME_AND_RUBRIC_RATINGS` scale:

| Score Range | Grade Level |
|-------------|-------------|
| 4.0 | Exemplary |
| 3.5 - 3.99 | Beyond Target |
| 3.0 - 3.49 | Target |
| 2.5 - 2.99 | Approaching Target |
| 2.0 - 2.49 | Developing |
| 1.5 - 1.99 | Beginning |
| 1.0 - 1.49 | Needs Partial Support |
| 0.5 - 0.99 | Needs Full Support |
| 0.0 - 0.49 | No Evidence |

## Implementation Approach

### Why Not Use Canvas API?

While the dashboard module uses the Canvas API to fetch both `score` and `letterGrade` from assignment submissions, the student grade normalization uses DOM extraction because:

1. **Already on the page**: The grades page already has all the data rendered
2. **No additional API calls**: Avoids extra network requests
3. **Simpler implementation**: Works with existing DOM-based approach
4. **Fallback calculation**: Can calculate letter grade from score if not in DOM

### DOM Extraction Strategy

The code attempts to find the letter grade in the DOM first:
```javascript
const letterGradeCandidates = [
    row.querySelector('.assignment_score .tooltip'),
    row.querySelector('.assignment_score'),
    row.querySelector('.letter-grade'),
    row.querySelector('.grade-display')
];
```

If not found, it calculates using the existing `scoreToGradeLevel()` function:
```javascript
if (!letterGrade) {
    letterGrade = scoreToGradeLevel(score);
}
```

## Testing

### Manual Testing Checklist

- [ ] **Grades Page Sidebar**: Shows "Current Score: X.XX (Grade Level)"
- [ ] **Final Grade Row**: Shows "X.XX (Grade Level)" instead of percentage
- [ ] **Grade Levels Accurate**: Verify grade levels match the rating scale
- [ ] **Fallback Works**: If letter grade not in DOM, calculated value is correct
- [ ] **No Letter Grade**: If calculation fails, shows just numeric score

### Test Cases

1. **Student with Target grade (3.0)**
   - Expected: "3.0 (Target)"

2. **Student with Developing grade (2.5)**
   - Expected: "2.5 (Approaching Target)"

3. **Student with exact rating match (4.0)**
   - Expected: "4.0 (Exemplary)"

4. **Student with score between ratings (2.74)**
   - Expected: "2.74 (Developing)" (rounds down to nearest rating)

## Benefits

✅ **Clearer Communication**: Students see both numeric and descriptive grade  
✅ **Standards-Based**: Emphasizes mastery levels over percentages  
✅ **Consistent Format**: Matches dashboard display pattern  
✅ **Backward Compatible**: Falls back gracefully if letter grade unavailable  
✅ **No Breaking Changes**: Existing functionality preserved  

## Future Enhancements

Potential improvements:
1. Fetch letter grade from Canvas API for guaranteed accuracy
2. Support custom grade level labels per course
3. Add color coding based on grade level
4. Display grade level trend (improving/declining)

