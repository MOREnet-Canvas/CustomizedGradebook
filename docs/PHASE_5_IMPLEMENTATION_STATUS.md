# Phase 5: Unified Session-Based Course Snapshot - Implementation Status

**Date**: 2026-01-19  
**Status**: In Progress (Task 5.1 Complete)  

---

## ✅ Completed: Task 5.1 - Course Snapshot Service

### File Created
`src/services/courseSnapshotService.js` (322 lines)

### Functions Implemented

#### 1. `getCourseSnapshot(courseId)` ✅
**Purpose**: Read-only access to course snapshots for consumers

**Features**:
- Reads from sessionStorage with `cg_courseSnapshot_<courseId>` key
- Returns parsed snapshot object or null
- Logging: cache hit/miss
- Error handling: invalid JSON

**Usage**:
```javascript
const snapshot = getCourseSnapshot('12345');
if (snapshot) {
  console.log(`Course: ${snapshot.courseName}`);
  console.log(`Standards-based: ${snapshot.isStandardsBased}`);
  console.log(`Grade: ${snapshot.score} (${snapshot.letterGrade})`);
}
```

---

#### 2. `populateCourseSnapshot(courseId, courseName, apiClient)` ✅
**Purpose**: SINGLE OWNER - only function that writes snapshots

**Features**:
- Detects course type via `isStandardsBasedCourse()`
- Fetches grade via `getCourseGrade()`
- Creates unified snapshot with all course data
- Writes to sessionStorage
- Returns snapshot object or null
- Comprehensive logging at each step

**Snapshot Structure**:
```javascript
{
  courseId: string,
  courseName: string,
  isStandardsBased: boolean,
  score: number,
  letterGrade: string|null,
  gradeSource: 'assignment' | 'enrollment',
  timestamp: number
}
```

**Usage**:
```javascript
const snapshot = await populateCourseSnapshot('12345', 'Math 101', apiClient);
if (snapshot) {
  console.log(`Populated snapshot for ${snapshot.courseName}`);
}
```

---

#### 3. `shouldRefreshGrade(courseId, pageContext)` ✅
**Purpose**: SINGLE FUNCTION for page-aware refresh logic

**Refresh Rules**:
| Course Type | Page Context | Refresh? | Reason |
|-------------|--------------|----------|--------|
| Standards-based | Dashboard | ❌ No | Scores stable |
| Standards-based | All-grades | ❌ No | Scores stable |
| Standards-based | Course grades | ❌ No | Scores stable |
| Non-standards-based | Dashboard | ❌ No | Performance |
| Non-standards-based | All-grades | ✅ Yes | Current grade |
| Non-standards-based | Course grades | ✅ Yes | Current grade |

**Usage**:
```javascript
import { PAGE_CONTEXT } from './courseSnapshotService.js';

// On dashboard
if (shouldRefreshGrade('12345', PAGE_CONTEXT.DASHBOARD)) {
  // Will be false for all courses
}

// On all-grades page
if (shouldRefreshGrade('12345', PAGE_CONTEXT.ALL_GRADES)) {
  // Will be true for non-standards-based courses
}
```

---

#### 4. `refreshCourseSnapshot(courseId, courseName, apiClient, pageContext, force)` ✅
**Purpose**: Explicit refresh with page-aware logic

**Features**:
- Checks `shouldRefreshGrade()` unless force=true
- Calls `populateCourseSnapshot()` if refresh needed
- Returns updated or existing snapshot
- Logging: refresh decision, force flag

**Usage**:
```javascript
// Refresh with page-aware logic
const snapshot = await refreshCourseSnapshot(
  '12345', 
  'Math 101', 
  apiClient, 
  PAGE_CONTEXT.ALL_GRADES
);

// Force refresh (debugging)
const snapshot = await refreshCourseSnapshot(
  '12345', 
  'Math 101', 
  apiClient, 
  PAGE_CONTEXT.DASHBOARD, 
  true  // force
);
```

---

#### 5. `clearAllSnapshots()` ✅
**Purpose**: Clear all course snapshots from sessionStorage

**Features**:
- Removes all keys with `cg_` prefix
- Returns count of entries removed
- Logging: count of entries

**Usage**:
```javascript
const count = clearAllSnapshots();
console.log(`Cleared ${count} snapshots`);
```

---

#### 6. `debugSnapshots()` ✅
**Purpose**: Debug function to show all cached snapshots

**Features**:
- Returns map of courseId -> snapshot
- Logs all snapshots
- Calculates statistics:
  - Total snapshots
  - Standards-based vs traditional
  - Assignment source vs enrollment source

**Usage**:
```javascript
const snapshots = debugSnapshots();
console.log('All snapshots:', snapshots);
```

---

## 📋 Remaining Tasks

### Task 5.2: Refactor gradeDataService (45 minutes)
**Status**: Not Started

**Changes Needed**:
1. Remove in-memory `gradeCache` Map
2. Remove `getCachedGrade()`, `cacheGrade()`, `clearGradeCache()`
3. Remove TTL logic (CACHE_TTL_MS)
4. Keep `getCourseGrade()` as pure fetching function (no caching)
5. Remove `preCacheEnrollmentGrades()` (replaced by snapshot population)
6. Update JSDoc to reflect no caching

**Impact**: gradeDataService becomes a pure fetching service with no caching

---

### Task 5.3: Refactor courseDetection.js (30 minutes)
**Status**: Not Started

**Changes Needed**:
1. Remove sessionStorage writes from `isStandardsBasedCourse()`
2. Keep detection logic intact
3. Remove `clearDetectionCache()` (replaced by clearAllSnapshots)
4. Update JSDoc to note detection results stored in unified snapshot

**Impact**: courseDetection becomes a pure detection service with no caching

---

### Task 5.4: Update Dashboard Module (45 minutes)
**Status**: Not Started

**Files to Modify**:
- `src/dashboard/gradeDisplay.js`
- `src/dashboard/cardRenderer.js`

**Changes Needed**:
1. Import courseSnapshotService functions
2. Replace `preCacheEnrollmentGrades()` with `populateCourseSnapshot()` loop
3. Replace `getCourseGrade()` with `getCourseSnapshot()`
4. Add page context: `PAGE_CONTEXT.DASHBOARD`
5. Use `shouldRefreshGrade()` before fetching
6. Remove direct gradeDataService caching calls

**Impact**: Dashboard becomes a consumer of snapshots (read-only)

---

### Task 5.5: Update Student Module (45 minutes)
**Status**: Not Started

**Files to Modify**:
- `src/student/allGradesPageCustomizer.js`

**Changes Needed**:
1. Import courseSnapshotService functions
2. Replace grade fetching with snapshot reads
3. Add page context: `PAGE_CONTEXT.ALL_GRADES`
4. Use `shouldRefreshGrade()` to determine if refresh needed
5. Call `refreshCourseSnapshot()` for non-standards-based courses
6. Remove duplicate detection logic

**Impact**: Student module becomes a consumer of snapshots (read-only)

---

## Testing Plan

### Unit Tests
- [ ] `getCourseSnapshot()` returns null for missing snapshot
- [ ] `getCourseSnapshot()` returns parsed snapshot for valid data
- [ ] `populateCourseSnapshot()` creates correct snapshot structure
- [ ] `shouldRefreshGrade()` returns correct values for all scenarios
- [ ] `refreshCourseSnapshot()` respects page-aware logic
- [ ] `clearAllSnapshots()` removes all cg_* keys

### Integration Tests
- [ ] Dashboard loads and displays grades correctly
- [ ] All-grades page displays grades correctly
- [ ] Standards-based courses reuse snapshots (no API calls)
- [ ] Non-standards-based courses refresh on all-grades page
- [ ] Non-standards-based courses don't refresh on dashboard
- [ ] sessionStorage contains correct snapshot structure
- [ ] Page navigation preserves snapshots
- [ ] Tab close clears snapshots

### Manual Testing
- [ ] Open dashboard, verify grades display
- [ ] Check sessionStorage for cg_courseSnapshot_* keys
- [ ] Navigate to all-grades page, verify grades display
- [ ] Check console logs for cache hits/misses
- [ ] Check console logs for refresh decisions
- [ ] Call `debugSnapshots()` in console, verify output
- [ ] Call `clearAllSnapshots()` in console, verify snapshots cleared

---

## Next Steps

1. **Complete Task 5.2**: Refactor gradeDataService.js
   - Remove in-memory cache
   - Make getCourseGrade() a pure fetching function

2. **Complete Task 5.3**: Refactor courseDetection.js
   - Remove sessionStorage writes
   - Keep detection logic intact

3. **Complete Task 5.4**: Update Dashboard Module
   - Use courseSnapshotService for all grade data
   - Test thoroughly

4. **Complete Task 5.5**: Update Student Module
   - Use courseSnapshotService for all grade data
   - Test thoroughly

5. **Testing and Validation**
   - Run all tests
   - Verify no regressions
   - Document any issues

6. **Documentation**
   - Update README with new caching strategy
   - Document debugging tools
   - Create migration guide

---

## Success Criteria

✅ Task 5.1 Complete: Course Snapshot Service created  
⬜ Task 5.2: gradeDataService refactored  
⬜ Task 5.3: courseDetection refactored  
⬜ Task 5.4: Dashboard module updated  
⬜ Task 5.5: Student module updated  
⬜ All tests passing  
⬜ No regressions in functionality  
⬜ Documentation updated  

---

## Estimated Completion

- **Completed**: Task 5.1 (60 minutes)
- **Remaining**: Tasks 5.2-5.5 (165 minutes = 2.75 hours)
- **Total**: 3.75 hours

**Current Progress**: 27% complete (1 of 5 tasks)

