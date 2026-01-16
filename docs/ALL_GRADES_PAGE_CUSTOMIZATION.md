# All-Grades Page Customization

## Overview

The all-grades page customizer enhances the Canvas all-grades page (`/grades`) to display converted point values for standards-based courses while preserving percentages for traditional courses. This provides students with a unified view of their grades across all courses, with appropriate formatting for each grading system.

## Features

### 🎯 Core Functionality

1. **Standards-Based Course Detection**
   - Detects courses using standards-based grading (0-4 point scale)
   - Multiple detection methods with caching for performance
   - Configurable course name patterns

2. **Grade Conversion**
   - Converts percentage grades to 0-4 point scale for standards-based courses
   - Preserves percentage display for traditional courses
   - Shows letter grades alongside numeric scores (e.g., "2.57 (Developing)")

3. **Enhanced Table Display**
   - Replaces Canvas grades table with custom enhanced table
   - Visual indicators for course type (Standards vs Traditional)
   - Color-coded grades for easy identification
   - Maintains Canvas UI styling consistency

4. **Performance Optimization**
   - Caches standards-based course detection results
   - Parallel API calls for course processing
   - Fallback strategy for reliability

## Configuration

### Standards-Based Course Patterns

Configure in `src/config.js`:

```javascript
// Array of patterns to match against course names
const defaultStandardsBasedPatterns = [
    "Standards Based",      // String matching (case-insensitive)
    "SBG",                 // Acronym
    "Mastery",             // Keyword
    /\[SBG\]/i,           // Regex: [SBG] in course name
    /^SBG[-\s]/i          // Regex: Starts with "SBG-" or "SBG "
];
export const STANDARDS_BASED_COURSE_PATTERNS = 
    window.CG_CONFIG?.STANDARDS_BASED_COURSE_PATTERNS ?? defaultStandardsBasedPatterns;
```

### Runtime Override

Override via loader file (`upload_dev.js` or `upload_production.js`):

```javascript
window.CG_CONFIG = {
    STANDARDS_BASED_COURSE_PATTERNS: [
        "Standards Based",
        "SBG",
        /\[Mastery\]/i
    ],
    // ... other config
};
```

## Detection Methods

The system uses multiple methods to detect standards-based courses (in order):

### 1. Course Name Pattern Matching
- **Fastest method** - no API calls required
- Checks course name against configured patterns
- Supports both string matching and regex patterns
- **Example**: Course named "Algebra I [SBG]" matches pattern `/\[SBG\]/i`

### 2. AVG Assignment Check
- Checks if course has "Current Score Assignment"
- Uses Canvas API: `/api/v1/courses/{courseId}/assignments?search_term=...`
- Cached per course for performance
- **Example**: Course with assignment named "Current Score Assignment" is detected

### 3. Caching
- Results cached in `sessionStorage` per course
- Cache key: `standardsBased_{courseId}`
- Prevents redundant API calls during session

## Data Source Strategy

### Primary: Enrollments API

**Endpoint**: `/api/v1/users/self/enrollments`

**Parameters**:
- `type[]=StudentEnrollment` - Only student enrollments
- `state[]=active` - Only active courses
- `include[]=total_scores` - Include grade data

**Advantages**:
- ✅ Single API call for all courses
- ✅ Includes grade data (percentage, letter grade)
- ✅ More reliable than DOM parsing
- ✅ Less dependent on Canvas UI changes

**Example Response**:
```json
[
  {
    "course_id": 538,
    "course": {
      "name": "Algebra I [SBG]"
    },
    "grades": {
      "current_score": 64.25,
      "current_grade": "D"
    }
  }
]
```

### Fallback: DOM Parsing

**Used when**: API call fails or returns no data

**Process**:
1. Find table: `table.course_details.student_grades`
2. Extract course rows from `tbody tr`
3. Parse course name, ID, and percentage from each row
4. Make individual API calls for standards detection

**Advantages**:
- ✅ Works even if API is unavailable
- ✅ No additional permissions required

## Grade Conversion Formula

### Percentage to Points

For standards-based courses:

```javascript
pointValue = (percentage / 100) * DEFAULT_MAX_POINTS
```

**Example**:
- Percentage: 64.25%
- DEFAULT_MAX_POINTS: 4
- Point Value: (64.25 / 100) * 4 = **2.57**

### Letter Grade Calculation

Uses existing `scoreToGradeLevel()` function:

```javascript
// Rating scale (from config.js)
const ratings = [
    { description: "Exemplary", points: 4 },
    { description: "Beyond Target", points: 3.5 },
    { description: "Target", points: 3 },
    { description: "Approaching Target", points: 2.5 },
    { description: "Developing", points: 2 },
    // ... more ratings
];

// Find closest rating at or below the score
letterGrade = scoreToGradeLevel(2.57); // Returns "Developing"
```

## Display Format

### Standards-Based Courses

**Grade Display**: `2.57 (Developing)`
- Green color (#0B874B)
- Shows point value with 2 decimal places
- Includes letter grade in parentheses
- Badge: "Standards" (green background)

### Traditional Courses

**Grade Display**: `85.50%`
- Default color (#2D3B45)
- Shows percentage with 2 decimal places
- No letter grade
- Label: "Traditional" (gray text)

### No Grade

**Grade Display**: `N/A`
- Gray color (#73818C)
- Shown when no grade data available

## Table Structure

### Enhanced Table Layout

```
┌─────────────────────────────────┬──────────────────┬─────────────┐
│ Course                          │ Grade            │ Type        │
├─────────────────────────────────┼──────────────────┼─────────────┤
│ Algebra I [SBG]                 │ 2.57 (Developing)│ Standards   │
│ English 10                      │ 85.50%           │ Traditional │
│ Biology                         │ N/A              │ Traditional │
└─────────────────────────────────┴──────────────────┴─────────────┘
```

### CSS Classes

- Table: `ic-Table ic-Table--hover-row ic-Table--striped customized-grades-table`
- Header: `ic-Table-header`
- Row: `ic-Table-row`
- Cell: `ic-Table-cell`

## Performance Metrics

### Typical Performance (5 courses)

| Metric | API Approach | DOM Approach |
|--------|-------------|--------------|
| Initial API Call | ~200ms | 0ms |
| Course Processing | ~100ms/course | ~100ms/course |
| Total Time | ~700ms | ~500ms |
| Reliability | High | Medium |

**Note**: API approach is recommended despite slightly longer initial time due to better reliability and data completeness.

### Caching Impact

- **First Load**: Full detection for all courses (~700ms for 5 courses)
- **Subsequent Loads**: Cached results (~200ms for 5 courses)
- **Cache Duration**: Session (cleared on browser close)

## Error Handling

### Graceful Degradation

1. **API Failure**: Falls back to DOM parsing
2. **DOM Parsing Failure**: Logs error, leaves original table
3. **Individual Course Failure**: Skips course, continues with others
4. **Detection Failure**: Treats as traditional course

### Logging

All errors logged with context:
```javascript
logger.error('Failed to fetch course grades from API:', error);
logger.warn('Could not check assignments for course 538:', error.message);
```

## Testing

### Manual Testing

1. **Navigate to all-grades page**: `/grades`
2. **Verify table replacement**: Original table hidden, new table shown
3. **Check standards-based courses**: Green grades with letter grades
4. **Check traditional courses**: Percentage grades
5. **Verify course links**: Click course names to navigate

### Performance Testing

Run in browser console:
```javascript
// Test both data source approaches
await window.CG_testAllGradesDataSources();
```

**Output**:
- Comparison table with metrics
- Detailed course data from both approaches
- Recommendation based on performance

### Test Cases

| Test Case | Expected Result |
|-----------|----------------|
| Course name "Algebra [SBG]" | Detected as standards-based |
| Course with AVG Assignment | Detected as standards-based |
| Course "English 10" | Detected as traditional |
| Grade 64.25% in SBG course | Displays "2.57 (Developing)" |
| Grade 85.5% in traditional | Displays "85.50%" |
| No grade data | Displays "N/A" |

## Architecture

### Module Structure

```
src/student/
├── allGradesPageCustomizer.js      ← Main implementation
├── allGradesDataSourceTest.js      ← Testing/comparison tool
├── gradeExtractor.js               ← Shared utilities (scoreToGradeLevel)
└── studentGradeCustomization.js    ← Router (detects page type)
```

### Initialization Flow

```
customGradebookInit.js
  └─> initStudentGradeCustomization()
       └─> isAllGradesPage() ?
            └─> initAllGradesPageCustomizer()
                 └─> applyCustomizations()
                      ├─> fetchCourseGrades()
                      │    ├─> fetchCourseGradesFromAPI() [primary]
                      │    └─> fetchCourseGradesFromDOM() [fallback]
                      └─> replaceGradesTable()
```

## Future Enhancements

Potential improvements:

1. **Sorting**: Allow sorting by course name, grade, or type
2. **Filtering**: Filter by standards-based vs traditional
3. **Export**: Export grades to CSV/PDF
4. **Grade Trends**: Show grade changes over time
5. **GPA Calculation**: Calculate separate GPAs for each grading type
6. **Customizable Display**: User preferences for display format

## Troubleshooting

### Table Not Replacing

**Symptoms**: Original Canvas table still visible

**Solutions**:
1. Check console for errors
2. Verify user is student-like role
3. Check `ENABLE_STUDENT_GRADE_CUSTOMIZATION` config
4. Verify page URL matches `/grades`

### Incorrect Course Detection

**Symptoms**: Standards-based course shown as traditional (or vice versa)

**Solutions**:
1. Check course name patterns in config
2. Verify AVG Assignment exists in course
3. Clear sessionStorage cache: `sessionStorage.clear()`
4. Check console logs for detection details

### Performance Issues

**Symptoms**: Slow page load, delayed table display

**Solutions**:
1. Check network tab for slow API calls
2. Reduce number of detection methods
3. Increase cache usage
4. Consider DOM parsing approach if API is slow

## Related Documentation

- [Student Grade Customization](../src/student/README.md)
- [Configuration Guide](../README.md#configuration)
- [Dashboard Grade Display](./DASHBOARD_GRADE_DISPLAY.md)

