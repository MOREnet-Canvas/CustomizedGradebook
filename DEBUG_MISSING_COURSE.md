# Debugging Missing Course Snapshot

## Quick Check: Which Course is Missing?

Run this in browser console on dashboard or all-grades page:

```javascript
// 1. Get all snapshots
const snapshots = Object.keys(sessionStorage)
    .filter(k => k.startsWith('cg_courseSnapshot_'))
    .map(k => {
        const data = JSON.parse(sessionStorage.getItem(k));
        return { courseId: data.courseId, courseName: data.courseName, model: data.model };
    });

console.table(snapshots);
console.log(`Total snapshots: ${snapshots.length}`);

// 2. Get all enrollments
const enrollments = await fetch('/api/v1/users/self/enrollments?type[]=StudentEnrollment&state[]=active&include[]=total_scores')
    .then(r => r.json());

console.log(`Total enrollments: ${enrollments.length}`);

// 3. Find missing courses
const snapshotCourseIds = new Set(snapshots.map(s => s.courseId));
const missingCourses = enrollments.filter(e => !snapshotCourseIds.has(String(e.course_id)));

console.log('Missing courses:');
missingCourses.forEach(e => {
    const hasGrade = e.grades?.current_score !== null && e.grades?.current_score !== undefined;
    console.log(`- Course ${e.course_id}: "${e.course.name}"`);
    console.log(`  Has grade: ${hasGrade}`);
    if (hasGrade) {
        console.log(`  Score: ${e.grades.current_score}%`);
        console.log(`  Letter: ${e.grades.current_grade || 'none'}`);
    } else {
        console.log(`  Reason: No grade data (current_score is null/undefined)`);
    }
});
```

---

## Why Snapshots Are Not Created

A snapshot will NOT be created if any of these conditions are true:

### 1. No Grade Data (Most Common)
**Condition:** `getCourseGrade()` returns `null`

**Happens when:**
- No AVG assignment exists, AND
- No enrollment score exists (`grades.current_score` is null/undefined)

**Common scenarios:**
- New course with no assignments
- Course with no published assignments
- Course where student hasn't submitted any work
- Course with all assignments ungraded

**Check:**
```javascript
const courseId = '547'; // Replace with your course ID
const enrollment = await fetch(`/api/v1/courses/${courseId}/enrollments?user_id=self&include[]=total_scores`)
    .then(r => r.json())
    .then(data => data[0]);

console.log('Enrollment data:', enrollment);
console.log('Has grade:', enrollment?.grades?.current_score !== null);
```

### 2. User Not Student-Like
**Condition:** `getUserRoleGroup() !== 'student_like'`

**Happens when:**
- User is a teacher
- User is an admin
- User is a TA

**Check:**
```javascript
console.log('User role group:', window.ENV?.current_user_roles);
```

### 3. Unauthorized Page
**Condition:** Not on dashboard, all-grades, or course-grades page

**Authorized pages:**
- Dashboard: `/`, `/dashboard`, `/dashboard/*`
- All grades: `/grades`
- Course grades: `/courses/*/grades`

**Check:**
```javascript
console.log('Current path:', window.location.pathname);
```

### 4. User Ownership Validation Failed
**Condition:** `ENV.current_user_id` not available or changed

**Happens when:**
- Canvas ENV object not loaded
- User switched accounts

**Check:**
```javascript
console.log('Current user ID:', window.ENV?.current_user_id);
console.log('Cached user ID:', sessionStorage.getItem('cg_userId'));
```

### 5. API Error
**Condition:** Exception thrown during grade fetch or classification

**Check browser console for errors:**
- Look for `[Snapshot] Failed to populate snapshot for course...`
- Look for API errors from CanvasApiClient

---

## Expected Behavior

### Courses WITH Snapshots
- Have grade data (AVG assignment OR enrollment score)
- User is student-like
- Accessed from authorized page
- No API errors

### Courses WITHOUT Snapshots
- **No grade data** (most common)
- User is not student-like (shouldn't happen for students)
- Never accessed from authorized page
- API errors during fetch

---

## Force Populate Snapshot (Debugging)

If you want to force populate a snapshot for debugging:

```javascript
// Import required modules
const { populateCourseSnapshot } = await import('./src/services/courseSnapshotService.js');
const { CanvasApiClient } = await import('./src/utils/canvasApiClient.js');

// Force populate
const apiClient = new CanvasApiClient();
const snapshot = await populateCourseSnapshot('547', 'Points Scheme', apiClient);

if (snapshot) {
    console.log('Snapshot created:', snapshot);
} else {
    console.log('Snapshot creation failed - check console for reason');
}
```

---

## Verify Fix for Issue 1

Check that traditional courses are NOT modified:

```javascript
// On course 547 grades page (/courses/547/grades)

// 1. Check snapshot
const snapshot = JSON.parse(sessionStorage.getItem('cg_courseSnapshot_547'));
console.log('Course 547 snapshot:', snapshot);
console.log('Model:', snapshot.model); // Should be "traditional"
console.log('Reason:', snapshot.modelReason); // Should be "no-match"

// 2. Check if Assignments tab exists
const assignmentsTab = document.querySelector('#section-tabs a[href*="assignments"]');
console.log('Assignments tab exists:', !!assignmentsTab); // Should be true

// 3. Check if sidebar was replaced
const sidebar = document.querySelector('.student-grades-right-content');
console.log('Sidebar exists:', !!sidebar); // Should be true (standard Canvas sidebar)

// 4. Check console logs
// Should see: "Skipping grade page customization - course is traditional (reason: no-match)"
```

