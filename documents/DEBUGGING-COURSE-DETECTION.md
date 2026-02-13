# Debugging Course Detection Issues

## Problem: Courses with AVG Assignment Being Classified as "Traditional"

If courses that contain the AVG Assignment (configured as `AVG_ASSIGNMENT_NAME` in config.js) are being incorrectly classified as "traditional" instead of "standards", follow these debugging steps.

## Quick Diagnosis

### Step 1: Enable Trace Logging

Open the browser console and run:
```javascript
localStorage.setItem('cg_logLevel', 'trace');
```

Then reload the page. You should see detailed logs about the course detection process.

### Step 2: Check What AVG_ASSIGNMENT_NAME Is Set To

In the browser console:
```javascript
console.log(window.CG_CONFIG?.AVG_ASSIGNMENT_NAME ?? "Current Score Assignment");
```

This will show you the exact assignment name being searched for.

### Step 3: Run the Debug Helper

In the browser console, run the debug helper for a specific course:
```javascript
// Replace '12345' with your actual course ID
const courseId = '12345';

// Import and run the debug function
import('./utils/courseDetection.js').then(module => {
    module.debugAssignmentDetection(courseId).then(result => {
        console.log('Debug Results:', result);
    });
});
```

This will:
1. Search for assignments using the `search_term` parameter
2. Fetch all assignments in the course
3. Compare the results
4. Show you exactly what's happening

### Step 4: Check Session Storage

View the cached course snapshot:
```javascript
const courseId = '12345'; // Replace with your course ID
const snapshot = JSON.parse(sessionStorage.getItem(`cg_courseSnapshot_${courseId}`));
console.log('Cached Snapshot:', snapshot);
console.log('Model:', snapshot?.model);
console.log('Reason:', snapshot?.modelReason);
```

## Common Issues and Solutions

### Issue 1: Assignment Name Mismatch

**Symptom**: Debug helper shows assignments but none match exactly.

**Cause**: The assignment name in Canvas doesn't exactly match `AVG_ASSIGNMENT_NAME`.

**Solution**: 
- Check the exact name in Canvas (including spaces, capitalization)
- Update `AVG_ASSIGNMENT_NAME` in your config to match exactly

### Issue 2: Search Term Not Working

**Symptom**: `search_term` returns 0 results, but fetching all assignments shows the AVG Assignment exists.

**Cause**: Canvas `search_term` parameter only does prefix matching, not substring matching.

**Solution**: This is a known Canvas API limitation. The code already handles this by doing an exact match check after the search. If this is happening, there may be a bug in the search logic.

### Issue 3: Assignment Not Published

**Symptom**: Assignment exists but is not returned by the API.

**Cause**: Unpublished assignments may not be visible to students.

**Solution**: Ensure the AVG Assignment is published in Canvas.

### Issue 4: Permission Issues

**Symptom**: API returns empty array or error.

**Cause**: User doesn't have permission to view assignments.

**Solution**: Check user role and permissions in Canvas.

### Issue 5: API Client Not Passed

**Symptom**: Logs show "No apiClient provided for course X, defaulting to traditional"

**Cause**: The `determineCourseModel()` function is being called without an `apiClient` instance.

**Solution**: Check that `populateCourseSnapshot()` is being called with a valid `apiClient`.

## Viewing Detection Logs

With trace logging enabled, look for these log patterns:

```
[CourseModel] Classifying course 12345 "Math 101"
[CourseModel] Rule 1 - Pattern match: NO
[CourseModel] Rule 2 - Checking AVG Assignment presence...
[hasAvgAssignment] Searching for assignment "Current Score Assignment" in course 12345
[hasAvgAssignment] API returned 1 assignments
[hasAvgAssignment] Found assignments: Current Score Assignment
[hasAvgAssignment] Exact match for "Current Score Assignment": YES
[CourseModel] Rule 2 - AVG Assignment: FOUND
[CourseModel] ✅ Course "Math 101" → standards (avg-assignment)
```

If you see `NOT FOUND` instead of `FOUND`, the issue is in the assignment detection.

## Manual API Test

You can manually test the Canvas API endpoint:

```javascript
// Replace with your course ID
const courseId = '12345';
const assignmentName = 'Current Score Assignment'; // Or your configured name

fetch(`/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(assignmentName)}&per_page=100`)
    .then(r => r.json())
    .then(assignments => {
        console.log('API Response:', assignments);
        console.log('Count:', assignments.length);
        assignments.forEach(a => console.log(`- ${a.name} (ID: ${a.id})`));
    });
```

## Clearing Cache

If you've made changes and want to force a re-detection:

```javascript
// Clear all course snapshots
sessionStorage.clear();

// Or clear a specific course
const courseId = '12345';
sessionStorage.removeItem(`cg_courseSnapshot_${courseId}`);
```

Then reload the page.

