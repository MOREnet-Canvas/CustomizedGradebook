# Phase 5: Unified Session-Based Course Snapshot System

**Goal**: Implement a unified, session-scoped caching system for course data shared across Dashboard and Student Grades pages with centralized population and page-aware refresh logic.

**Status**: Planning  
**Estimated Time**: 3-4 hours  
**Risk Level**: Medium-High  

---

## Core Principles

1. **Single Unified Cache Entry Per Course**
   - Key format: `cg_courseSnapshot_<courseId>`
   - All course data in one sessionStorage entry
   - No duplicate detection or grade computation in consumers

2. **Centralized Population Logic**
   - Single module owns all snapshot writes
   - Only place where course type detection occurs
   - Only place where grade computation occurs

3. **Single Source of Truth for Detection**
   - `isStandardsBasedCourse()` remains authoritative
   - No duplicate detection logic in page modules

4. **Page-Aware Grade Refresh**
   - Standards-based: Reuse from snapshot (no refresh)
   - Non-standards-based: Refresh on specific pages
   - Single function determines refresh requirements

5. **No TTL-Based Invalidation**
   - Session-scoped (persists until tab close)
   - Explicit refresh/clear only

---

## Unified Course Snapshot Contract

### Key Format
```
cg_courseSnapshot_<courseId>
```

### Stored Data Structure
```javascript
{
  courseId: string,
  courseName: string,
  isStandardsBased: boolean,
  score: number,
  letterGrade: string|null,
  gradeSource: 'assignment' | 'enrollment',
  timestamp: number  // For debugging, not for TTL
}
```

---

## Architecture Overview

### Current State (Phase 4)
```
gradeDataService.js
├── In-memory Map cache (gradeCache)
├── TTL-based expiration (5 minutes)
├── getCachedGrade() / cacheGrade()
└── Used by: dashboard, student modules

courseDetection.js
├── sessionStorage cache (standardsBased_<courseId>)
├── isStandardsBasedCourse() - detection logic
└── Used by: dashboard, student modules
```

**Issues**:
- Two separate caches (grade + detection)
- In-memory cache lost on refresh
- TTL-based expiration
- No unified snapshot
- Consumers can independently detect/compute

### Target State (Phase 5)
```
courseSnapshotService.js (NEW - Single Owner)
├── Unified sessionStorage snapshots (cg_courseSnapshot_<courseId>)
├── populateCourseSnapshot() - ONLY place to write
├── getCourseSnapshot() - Read-only for consumers
├── shouldRefreshGrade() - Page-aware refresh logic
├── refreshCourseSnapshot() - Explicit refresh
└── clearAllSnapshots() - Clear all cg_* keys

gradeDataService.js (REFACTORED)
├── Remove in-memory cache
├── Use courseSnapshotService for reads
└── Provide grade fetching utilities (no caching)

courseDetection.js (REFACTORED)
├── Keep isStandardsBasedCourse() as detection function
├── Remove sessionStorage writes (moved to snapshot service)
└── Detection results stored in unified snapshot

Dashboard & Student Modules (CONSUMERS)
├── Read from getCourseSnapshot() ONLY
├── Never detect course type independently
├── Never compute grades independently
└── Can trigger refresh via refreshCourseSnapshot()
```

---

## Implementation Tasks

### Task 5.1: Create Course Snapshot Service (60 minutes)
**File**: `src/services/courseSnapshotService.js`

**Functions to Implement**:

1. **`getCourseSnapshot(courseId)`** - Read-only access
   - Returns snapshot from sessionStorage
   - Returns null if not found
   - Logging: cache hit/miss

2. **`populateCourseSnapshot(courseId, courseName, apiClient)`** - Single owner
   - Detects course type via `isStandardsBasedCourse()`
   - Fetches grade via `getCourseGrade()`
   - Writes unified snapshot to sessionStorage
   - Returns snapshot object
   - Logging: population source, detection result, grade source

3. **`shouldRefreshGrade(courseId, pageContext)`** - Page-aware logic
   - Input: courseId, pageContext ('dashboard' | 'allGrades' | 'courseGrades')
   - Logic:
     - Standards-based courses: NEVER refresh (return false)
     - Non-standards-based courses:
       - Dashboard: NEVER refresh (return false)
       - All-grades page: REFRESH (return true)
       - Course grades page: REFRESH (return true)
   - Returns: boolean
   - Logging: decision reasoning

4. **`refreshCourseSnapshot(courseId, courseName, apiClient, force=false)`**
   - Checks `shouldRefreshGrade()` unless force=true
   - Calls `populateCourseSnapshot()` if refresh needed
   - Returns updated snapshot or existing snapshot
   - Logging: refresh decision, force flag

5. **`clearAllSnapshots()`**
   - Removes all `cg_*` keys from sessionStorage
   - Logging: count of entries removed

6. **`debugSnapshots()`**
   - Returns all course snapshots for debugging
   - Logs snapshot summary

**Dependencies**:
- `isStandardsBasedCourse()` from courseDetection.js
- `getCourseGrade()` from gradeDataService.js (refactored to not cache)
- `logger` from utils/logger.js

---

### Task 5.2: Refactor gradeDataService (45 minutes)

**Changes**:
1. Remove in-memory `gradeCache` Map
2. Remove `getCachedGrade()`, `cacheGrade()`, `clearGradeCache()`
3. Remove TTL logic (CACHE_TTL_MS)
4. Keep `getCourseGrade()` as pure fetching function (no caching)
5. Remove `preCacheEnrollmentGrades()` (replaced by snapshot population)
6. Update JSDoc to reflect no caching

**New Behavior**:
- `getCourseGrade()` always fetches fresh data
- No internal caching
- Used by courseSnapshotService for population

---

### Task 5.3: Refactor courseDetection.js (30 minutes)

**Changes**:
1. Remove sessionStorage writes from `isStandardsBasedCourse()`
2. Keep detection logic intact
3. Remove `clearDetectionCache()` (replaced by clearAllSnapshots)
4. Update JSDoc to note detection results stored in unified snapshot

**New Behavior**:
- `isStandardsBasedCourse()` returns detection result
- No caching within courseDetection.js
- Caching handled by courseSnapshotService

---

### Task 5.4: Update Dashboard Module (45 minutes)

**Files**: `src/dashboard/gradeDisplay.js`, `src/dashboard/cardRenderer.js`

**Changes**:
1. Import `courseSnapshotService` functions
2. Replace `preCacheEnrollmentGrades()` with `populateCourseSnapshot()` loop
3. Replace `getCourseGrade()` with `getCourseSnapshot()`
4. Add page context: `'dashboard'`
5. Use `shouldRefreshGrade()` before fetching
6. Remove direct gradeDataService caching calls

**Flow**:
```javascript
// On dashboard load
for (const course of courses) {
  // Populate snapshot (centralized)
  await populateCourseSnapshot(course.id, course.name, apiClient);
  
  // Read snapshot (consumer)
  const snapshot = getCourseSnapshot(course.id);
  
  // Render using snapshot data
  renderGradeOnCard(cardElement, snapshot);
}
```

---

### Task 5.5: Update Student Module (45 minutes)

**Files**: `src/student/allGradesPageCustomizer.js`

**Changes**:
1. Import `courseSnapshotService` functions
2. Replace grade fetching with snapshot reads
3. Add page context: `'allGrades'`
4. Use `shouldRefreshGrade()` to determine if refresh needed
5. Call `refreshCourseSnapshot()` for non-standards-based courses
6. Remove duplicate detection logic

**Flow**:
```javascript
// On all-grades page load
for (const course of courses) {
  // Check if refresh needed (page-aware)
  const needsRefresh = shouldRefreshGrade(course.id, 'allGrades');
  
  if (needsRefresh) {
    // Refresh snapshot
    await refreshCourseSnapshot(course.id, course.name, apiClient);
  } else {
    // Populate if not exists
    if (!getCourseSnapshot(course.id)) {
      await populateCourseSnapshot(course.id, course.name, apiClient);
    }
  }
  
  // Read snapshot (consumer)
  const snapshot = getCourseSnapshot(course.id);
  
  // Render using snapshot data
  renderCourseRow(snapshot);
}
```

---

## Page-Aware Refresh Logic

### Decision Matrix

| Course Type | Page Context | Refresh? | Reason |
|-------------|--------------|----------|--------|
| Standards-based | Dashboard | ❌ No | Scores stable, reuse snapshot |
| Standards-based | All-grades | ❌ No | Scores stable, reuse snapshot |
| Standards-based | Course grades | ❌ No | Scores stable, reuse snapshot |
| Non-standards-based | Dashboard | ❌ No | Performance optimization |
| Non-standards-based | All-grades | ✅ Yes | User expects current grade |
| Non-standards-based | Course grades | ✅ Yes | User expects current grade |

### Implementation

```javascript
export function shouldRefreshGrade(courseId, pageContext) {
  const snapshot = getCourseSnapshot(courseId);
  if (!snapshot) return true; // No snapshot, need to populate
  
  // Standards-based courses: NEVER refresh
  if (snapshot.isStandardsBased) {
    logger.trace(`[Refresh] Course ${courseId}: Standards-based, no refresh needed`);
    return false;
  }
  
  // Non-standards-based courses: Refresh on specific pages
  const refreshPages = ['allGrades', 'courseGrades'];
  const shouldRefresh = refreshPages.includes(pageContext);
  
  logger.trace(`[Refresh] Course ${courseId}: Non-standards-based, page=${pageContext}, refresh=${shouldRefresh}`);
  return shouldRefresh;
}
```

---

## Migration Strategy

### Phase 5.1: Create New Service (No Breaking Changes)
- Create courseSnapshotService.js
- Add tests/debugging functions
- No changes to existing code

### Phase 5.2: Refactor Services (Internal Changes)
- Update gradeDataService.js (remove caching)
- Update courseDetection.js (remove caching)
- Existing consumers still work

### Phase 5.3: Update Consumers (Dashboard)
- Update dashboard to use snapshots
- Test thoroughly
- Verify no regressions

### Phase 5.4: Update Consumers (Student)
- Update student module to use snapshots
- Test thoroughly
- Verify no regressions

### Phase 5.5: Cleanup
- Remove old cache code
- Update documentation
- Add debugging tools

---

## Testing Checklist

- [ ] Dashboard loads and displays grades correctly
- [ ] All-grades page displays grades correctly
- [ ] Standards-based courses reuse snapshots (no API calls)
- [ ] Non-standards-based courses refresh on all-grades page
- [ ] Non-standards-based courses don't refresh on dashboard
- [ ] sessionStorage contains correct snapshot structure
- [ ] clearAllSnapshots() removes all cg_* keys
- [ ] Page navigation preserves snapshots
- [ ] Tab close clears snapshots
- [ ] Logging shows cache hits/misses and refresh decisions

---

## Success Criteria

✅ Each course has exactly one unified session snapshot  
✅ All grade-related pages consume the same cached data  
✅ Course type detection is centralized and consistent  
✅ Page-aware grade refresh logic is explicit and easy to reason about  
✅ Session storage can be fully cleared by removing cg_* keys  
✅ No TTL-based invalidation  
✅ No duplicate detection or grade computation in consumers  

---

## Next Steps

1. Review this plan with stakeholders
2. Create courseSnapshotService.js (Task 5.1)
3. Refactor gradeDataService.js (Task 5.2)
4. Refactor courseDetection.js (Task 5.3)
5. Update dashboard module (Task 5.4)
6. Update student module (Task 5.5)
7. Test and validate
8. Document and deploy

