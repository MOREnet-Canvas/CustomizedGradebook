# Course Model Classification

## Overview

This document describes the shared function for course model classification implemented across the CustomizedGradebook project.

## Shared Function

### Function: `determineCourseModel(course, sessionData, options)`

**Location:** `src/utils/courseDetection.js`

**Purpose:** Single shared function for classifying courses as "standards" or "traditional"

**Parameters:**
- `course` - Object with `courseId` and `courseName`
- `sessionData` - Session data (unused, for future compatibility)
- `options` - Object with `apiClient` (CanvasApiClient instance)

**Returns:** `Promise<{model: "standards"|"traditional", reason: string}>`

**Classification Rules (ONLY these two tests):**

1. **Name pattern test** (first, short-circuit):
   - If course name matches `STANDARDS_BASED_COURSE_PATTERNS` → `"standards"` (reason: `"name-pattern"`)
   - Skip all other checks

2. **Assignment presence test** (only if name does NOT match):
   - If course contains assignment with exact name `AVG_ASSIGNMENT_NAME` → `"standards"` (reason: `"avg-assignment"`)
   - Otherwise → `"traditional"` (reason: `"no-match"`)

**Example:**
```javascript
import { determineCourseModel } from './utils/courseDetection.js';
import { CanvasApiClient } from './utils/canvasApiClient.js';

const apiClient = new CanvasApiClient();
const result = await determineCourseModel(
  { courseId: '12345', courseName: 'Math 101' },
  null,
  { apiClient }
);

console.log(result.model);  // "standards" or "traditional"
console.log(result.reason); // "name-pattern" or "avg-assignment" or "no-match"
```

## Session Data Structure

**Key:** `cg_courseSnapshot_<courseId>`

**Storage:** `sessionStorage`

**Structure:**
```javascript
{
  courseId: string,
  courseName: string,
  model: "standards" | "traditional",  // NEW: Course model classification
  modelReason: string,                 // NEW: Classification reason (for debugging)
  isStandardsBased: boolean,           // DEPRECATED: Use model === "standards"
  score: number,
  letterGrade: string|null,
  gradeSource: 'assignment' | 'enrollment',
  timestamp: number,
  userId: string,
  expiresAt: number
}
```

## Performance Characteristics

### Caching Strategy
- Each course is classified **once per session**
- Results stored in `sessionStorage` with 10-minute TTL
- Shared cache across tabs (same session)

### API Call Optimization
- **Name pattern match:** 0 API calls (instant)
- **Assignment check:** 1 API call per course (only if name doesn't match pattern)
- **Cached result:** 0 API calls (reads from sessionStorage)

### Example Performance
For a user with 10 courses:
- 3 courses match name pattern → 0 API calls
- 7 courses need assignment check → 7 API calls
- **Total:** 7 API calls (first visit), 0 API calls (subsequent visits within 10 minutes)

## Integration Points

### 1. Course Snapshot Service
**File:** `src/services/courseSnapshotService.js`

**Integration:** Calls `determineCourseModel()` during snapshot population

**Code:**
```javascript
const classification = await determineCourseModel(
  { courseId, courseName },
  null,
  { apiClient }
);

const snapshot = {
  courseId,
  courseName,
  model: classification.model,
  modelReason: classification.reason,
  isStandardsBased: classification.model === 'standards', // backward compat
  // ... other fields
};
```

### 2. Cleanup Observer
**File:** `src/student/cleanupObserver.js`

**Integration:** Reads `snapshot.model` to determine if cleanup should run

**Code:**
```javascript
const snapshot = getCourseSnapshot(courseId);
if (snapshot && snapshot.model === 'standards') {
  startCleanupObservers();
}
```

### 3. All-Grades Page Customizer
**File:** `src/student/allGradesPageCustomizer.js`

**Integration:** Uses `snapshot.isStandardsBased` (backward compatibility field)

**Code:**
```javascript
const snapshot = getCourseSnapshot(courseId);
if (snapshot) {
  isStandardsBased = snapshot.isStandardsBased; // model === 'standards'
}
```

## Backward Compatibility

### Deprecated Functions
- `isStandardsBasedCourse()` - Still available, wraps `determineCourseModel()`
- `courseHasAvgAssignment()` - Still available, but use snapshot instead

### Deprecated Fields
- `snapshot.isStandardsBased` - Use `snapshot.model === 'standards'` instead

### Migration Path
All existing code continues to work. New code should use:
- `determineCourseModel()` for classification
- `snapshot.model` for reading classification results

## Scope

### Applies to ALL enrollments
- Student-like users
- Teacher-like users
- Admin users
- Masquerade sessions

### Applies to ALL pages
- Dashboard (`/`)
- All-grades page (`/grades`)
- Single course grades page (`/courses/{id}/grades`)
- Course pages (`/courses/{id}`)

## Configuration

### Name Patterns
**Config:** `STANDARDS_BASED_COURSE_PATTERNS` in `src/config.js`

**Default:**
```javascript
[
  "Standards Based",
  "SBG",
  "Mastery",
  /\[SBG\]/i,
  /^SBG[-\s]/i
]
```

### Assignment Name
**Config:** `AVG_ASSIGNMENT_NAME` in `src/config.js`

**Default:** `"Current Score Assignment"`

## Files Modified

1. `src/utils/courseDetection.js` - Added `determineCourseModel()` shared function
2. `src/services/courseSnapshotService.js` - Integrated shared function, added `model` and `modelReason` fields
3. `src/student/cleanupObserver.js` - Updated to use snapshot instead of `courseHasAvgAssignment()`
4. `src/student/allGradesDataSourceTest.js` - Updated test to use shared function