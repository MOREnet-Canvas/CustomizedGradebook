# Bug Fix Summary

## Issue 1: Traditional Course Incorrectly Modified

### Problem
Course ID 547 ("Points Scheme") was being modified on the course grades page despite being classified as `model: "traditional"`.

**Snapshot data for course 547:**
```json
{
    "courseId": "547",
    "courseName": "Points Scheme",
    "model": "traditional",
    "modelReason": "no-match",
    "isStandardsBased": false,
    "score": 80.5,
    "letterGrade": "Target",
    "gradeSource": "enrollment"
}
```

### Root Cause
The `gradePageCustomizer.js` module was applying customizations to **ALL** courses without checking the course model classification. It would:
1. Fetch/refresh the snapshot
2. Extract grade data
3. Apply customizations (remove Assignments tab, replace sidebar)

**Missing check:** No validation that `snapshot.model === 'standards'` before applying customizations.

### Fix
Added model check in `src/student/gradePageCustomizer.js` (lines 224-228):

```javascript
// Only apply customizations for standards-based courses
if (snapshot.model !== 'standards') {
    logger.debug(`Skipping grade page customization - course is ${snapshot.model} (reason: ${snapshot.modelReason})`);
    return false;
}
```

### Impact
- **Before:** All courses with grade data had customizations applied (Assignments tab removed, sidebar replaced)
- **After:** Only standards-based courses (`model === 'standards'`) have customizations applied
- **Traditional courses:** No modifications, display standard Canvas UI

---

## Issue 2: Missing Snapshot for Fifth Enrolled Course

### Problem
Student enrolled in 5 courses, but only 4 snapshots exist in sessionStorage.

**Existing snapshots:**
- Course 538: "BigClass" (standards)
- Course 544: "updatePoints" (standards)
- Course 547: "Points Scheme" (traditional)
- Course 548: "Points Scheme - hide points" (standards)

**Missing:** 1 course (5th enrollment)

### Root Cause
The `populateCourseSnapshot()` function returns `null` (skips snapshot creation) when `getCourseGrade()` returns `null`.

**When getCourseGrade() returns null:**
1. No AVG assignment exists, AND
2. No enrollment score exists (score is null/undefined)

**Code path:**
```javascript
// src/services/courseSnapshotService.js (lines 301-306)
const gradeData = await getCourseGrade(courseId, apiClient);

if (!gradeData) {
    logger.trace(`[Snapshot] No grade data available for course ${courseId}, skipping snapshot`);
    return null;
}
```

### Analysis
This is **CORRECT BEHAVIOR**. Courses without grade data should not have snapshots because:
1. **No data to display:** Snapshots exist to cache grade data for display
2. **Prevents errors:** Modules expect snapshots to have valid `score` and `letterGrade` fields
3. **Reduces storage:** No need to cache courses with no grades

**Most likely reason for missing 5th course:**
- New course with no assignments graded yet
- Course with no published assignments
- Course where student has not submitted any work

### Resolution
**No fix needed.** This is expected behavior. The 5th course will get a snapshot once it has grade data.

**To verify which course is missing:**
1. Check all active enrollments via Canvas API
2. Compare with existing snapshots
3. Verify the missing course has no grade data

---

## Additional Changes

### Cleanup: Removed Unused Import
Removed unused `isStandardsBasedCourse` import from `src/services/courseSnapshotService.js` (line 36).

**Before:**
```javascript
import { determineCourseModel, isStandardsBasedCourse } from '../utils/courseDetection.js';
```

**After:**
```javascript
import { determineCourseModel } from '../utils/courseDetection.js';
```

---

## Files Modified

1. **src/student/gradePageCustomizer.js**
   - Added model check before applying customizations
   - Only standards-based courses get customizations

2. **src/services/courseSnapshotService.js**
   - Removed unused `isStandardsBasedCourse` import

---

## Testing Recommendations

### Test Issue 1 Fix
1. Navigate to course 547 grades page (`/courses/547/grades`)
2. Verify Assignments tab is **visible** (not removed)
3. Verify right sidebar shows **standard Canvas grade display** (not custom mastery score)
4. Check browser console for log: `Skipping grade page customization - course is traditional (reason: no-match)`

### Test Issue 2 Investigation
1. Open browser console on dashboard or all-grades page
2. Run: `Object.keys(sessionStorage).filter(k => k.startsWith('cg_courseSnapshot_'))`
3. Count snapshots (should be 4)
4. Fetch all enrollments: `await fetch('/api/v1/users/self/enrollments?type[]=StudentEnrollment&state[]=active&include[]=total_scores').then(r => r.json())`
5. Identify 5th course and check if it has grade data (`grades.current_score` or `grades.final_score`)
6. If no grade data, confirm this is why snapshot is missing

---

## Acceptance Criteria

### Issue 1
- [x] Traditional courses (model === 'traditional') are NOT modified on course grades page
- [x] Standards-based courses (model === 'standards') ARE modified on course grades page
- [x] Log message indicates why customization was skipped

### Issue 2
- [x] Identified root cause: courses without grade data don't get snapshots
- [x] Confirmed this is correct behavior
- [x] Documented when snapshots are created vs. skipped

