# Course Detection Debugging - Summary

## Problem Statement

Courses that contain the AVG Assignment (configured as `AVG_ASSIGNMENT_NAME` in config.js) are being incorrectly classified as "traditional" instead of "standards-based".

## Root Cause Analysis

The issue is in the `hasAvgAssignment()` function in `src/utils/courseDetection.js`. This function:

1. Makes an API call to `/api/v1/courses/${courseId}/assignments?search_term=${AVG_ASSIGNMENT_NAME}`
2. Expects an array of assignments in response
3. Checks if any assignment has an exact name match with `AVG_ASSIGNMENT_NAME`

**Potential failure points:**

1. **API returns empty array**: The Canvas API `search_term` parameter might not be finding the assignment
2. **API returns non-array**: Unexpected response format
3. **Silent error**: The catch block returns `false` without detailed logging
4. **Name mismatch**: The assignment name in Canvas doesn't exactly match the configured name
5. **Permission issues**: User doesn't have permission to view assignments

## Changes Made

### 1. Enhanced Logging in `hasAvgAssignment()` (src/utils/courseDetection.js)

Added detailed trace logging to track:
- What assignment name is being searched for
- How many results the API returns
- Whether the response is an array
- All assignment names found
- Whether an exact match was found
- Full error details when API calls fail

### 2. Added Debug Helper Function (src/utils/courseDetection.js)

Created `debugAssignmentDetection(courseId)` function that:
- Tests the API call with `search_term` parameter
- Fetches ALL assignments (without filter) for comparison
- Shows exactly what's in the course
- Runs the actual detection logic
- Returns comprehensive debug information

### 3. Exposed Debug Function to Console (src/customGradebookInit.js)

Added `window.CG_debugAssignmentDetection(courseId)` for easy browser console access.

### 4. Created Debugging Guide (docs/DEBUGGING-COURSE-DETECTION.md)

Comprehensive guide with:
- Step-by-step diagnosis instructions
- Common issues and solutions
- How to enable trace logging
- How to use the debug helper
- Manual API testing examples

## Next Steps for User

### Step 1: Enable Trace Logging

In the browser console:
```javascript
localStorage.setItem('cg_logLevel', 'trace');
```

Then reload the page.

### Step 2: Check Current Configuration

```javascript
console.log('AVG_ASSIGNMENT_NAME:', window.CG_CONFIG?.AVG_ASSIGNMENT_NAME ?? "Current Score Assignment");
```

### Step 3: Run Debug Helper

For a course that's being misclassified:
```javascript
// Replace '12345' with the actual course ID
window.CG_debugAssignmentDetection('12345');
```

This will output detailed information about:
- What the API search returns
- All assignments in the course
- Whether the AVG Assignment exists
- Why detection is failing

### Step 4: Review Logs

Look for these patterns in the console:

**Success pattern:**
```
[hasAvgAssignment] Searching for assignment "Current Score Assignment" in course 12345
[hasAvgAssignment] API returned 1 assignments
[hasAvgAssignment] Found assignments: Current Score Assignment
[hasAvgAssignment] Exact match for "Current Score Assignment": YES
```

**Failure pattern:**
```
[hasAvgAssignment] Searching for assignment "Current Score Assignment" in course 12345
[hasAvgAssignment] API returned 0 assignments
[hasAvgAssignment] No assignments found with search_term="Current Score Assignment"
```

### Step 5: Identify the Issue

Based on the debug output, determine:

1. **Does the assignment exist?** Check the "all assignments" list
2. **Is the name exact?** Compare the actual name with the configured name
3. **Is it published?** Check the `published` field
4. **Is search_term working?** Compare search results with all assignments

## Common Solutions

### If assignment name doesn't match exactly:

Update your config to match the exact name in Canvas (including spaces, capitalization).

### If assignment exists but search_term returns empty:

This is a Canvas API limitation. The code already handles this by doing exact match checking, but there may be a bug. File an issue with the debug output.

### If assignment is unpublished:

Publish the assignment in Canvas.

### If API returns an error:

Check user permissions and Canvas API status.

## Files Modified

1. `src/utils/courseDetection.js` - Enhanced logging and debug helper
2. `src/customGradebookInit.js` - Exposed debug function to console
3. `docs/DEBUGGING-COURSE-DETECTION.md` - User-facing debugging guide
4. `docs/COURSE-DETECTION-DEBUG-SUMMARY.md` - This file

## Technical Details

The detection logic follows this flow:

```
determineCourseModel()
  ├─ Rule 1: Check course name pattern
  │   └─ If matches → "standards"
  │
  └─ Rule 2: Check AVG Assignment presence
      ├─ hasAvgAssignment()
      │   ├─ API call with search_term
      │   ├─ Validate response is array
      │   ├─ Check for exact name match
      │   └─ Return true/false
      │
      ├─ If found → "standards"
      └─ If not found → "traditional"
```

The enhanced logging now tracks every step of this process.

