# Dashboard Grade Display Module

## Overview

This module displays student grades on Canvas dashboard course cards. It implements a simple, robust fallback hierarchy to ensure grades are shown whenever possible.

## Grade Fallback Hierarchy

1. **Primary Source**: AVG_ASSIGNMENT_NAME assignment score (0-4 scale)
   - Fetched from `/api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/self`
   - Displayed as: "3.5" with label "Current Score"

2. **Fallback Source**: Total course score from enrollments (percentage)
   - Fetched from `/api/v1/courses/{courseId}/enrollments?include[]=total_scores`
   - Displayed as: "85.5%" with label "Grade"

## Architecture

### Module Structure

```
src/dashboard/
├── gradeDisplay.js         # Main orchestrator
├── gradeDataService.js     # API calls for fetching grades
├── cardRenderer.js         # DOM manipulation for displaying grades
└── README.md              # This file
```

### Key Features

- **Always Active**: No configuration flag needed - feature is always enabled
- **Graceful Degradation**: Fails silently per course if grade unavailable
- **Caching**: Session-based caching (5-minute TTL) to reduce API calls
- **SPA Support**: MutationObserver handles Canvas SPA navigation
- **Flexible Design**: Easy to extend for future grading approaches

## API Endpoints Used

### 1. Fetch Active Courses
```
GET /api/v1/courses?enrollment_state=active&include[]=total_scores
```

### 2. Search for AVG Assignment
```
GET /api/v1/courses/{courseId}/assignments?search_term={AVG_ASSIGNMENT_NAME}
```

### 3. Fetch Assignment Submission
```
GET /api/v1/courses/{courseId}/assignments/{assignmentId}/submissions/self
```

### 4. Fetch Enrollment Scores
```
GET /api/v1/courses/{courseId}/enrollments?user_id=self&type[]=StudentEnrollment&include[]=total_scores
```

## Usage

The module is automatically initialized when a student visits the dashboard page. No manual setup required.

### Initialization Flow

1. `main.js` detects dashboard page
2. Calls `initDashboardGradeDisplay()`
3. Waits for dashboard cards to load (max 5 seconds)
4. Fetches active courses
5. For each course:
   - Tries to fetch AVG assignment score
   - Falls back to enrollment score if needed
   - Renders grade badge on card
6. Sets up MutationObserver for SPA navigation

## Configuration

The module uses the existing `AVG_ASSIGNMENT_NAME` configuration from `src/config.js`:

```javascript
export const AVG_ASSIGNMENT_NAME = window.CG_CONFIG?.AVG_ASSIGNMENT_NAME ?? "Current Score Assignment";
```

## Styling

Grade badges are styled with inline CSS to ensure consistency across Canvas themes:

- **Background**: Uses Canvas brand primary color (`--ic-brand-primary`)
- **Text**: White text for contrast
- **Layout**: Flexbox column with value and label
- **Position**: Appended to card header subtitle area

## Error Handling

- **Per-Course Failures**: If one course fails, others continue
- **Silent Failures**: No user alerts - only console logging
- **Graceful Degradation**: Missing grades simply don't display

## Future Extensibility

The design supports future changes in grading approaches:

### Adding New Grade Sources

To add a new grade source (e.g., grade overrides):

1. Add fetch function in `gradeDataService.js`
2. Update `getCourseGrade()` fallback hierarchy
3. Update `cardRenderer.js` to handle new source type

### Example: Adding Grade Override Support

```javascript
// In gradeDataService.js
async function fetchGradeOverride(courseId, apiClient) {
    // Fetch override from new endpoint
    // Return percentage or null
}

// Update getCourseGrade()
export async function getCourseGrade(courseId, apiClient) {
    // Try override first
    const override = await fetchGradeOverride(courseId, apiClient);
    if (override !== null) {
        return { value: override, source: 'override' };
    }
    
    // Then AVG assignment
    const avgScore = await fetchAvgAssignmentScore(courseId, apiClient);
    if (avgScore !== null) {
        return { value: avgScore, source: 'assignment' };
    }
    
    // Finally enrollment
    const enrollmentScore = await fetchEnrollmentScore(courseId, apiClient);
    if (enrollmentScore !== null) {
        return { value: enrollmentScore, source: 'enrollment' };
    }
    
    return null;
}
```

## Testing

### Manual Testing Checklist

- [ ] Dashboard loads with grade badges on all course cards
- [ ] Courses with AVG assignment show 0-4 scale score
- [ ] Courses without AVG assignment show percentage
- [ ] Courses with no grades show no badge
- [ ] Navigating away and back to dashboard re-displays grades
- [ ] No console errors for courses without grades
- [ ] Grades update after Canvas SPA navigation

### Browser Console Testing

```javascript
// Check if module is loaded
console.log(window.CG);

// Manually trigger grade display
// (Only works if on dashboard page)
```

## Logging

The module uses the standard logger with appropriate levels:

- **INFO**: Initialization and completion messages
- **DEBUG**: Detailed operation info (course counts, grade values)
- **TRACE**: Very detailed info (cache hits, card lookups)
- **WARN**: Non-critical failures (missing grades, API errors)
- **ERROR**: Critical failures (initialization errors)

Enable debug logging with URL parameter: `?debug=true`
Enable trace logging with: `?debug=trace`

