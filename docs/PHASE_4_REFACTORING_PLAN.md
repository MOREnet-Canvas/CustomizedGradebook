# Phase 4: Grade Data Service Consolidation - Refactoring Plan

**Status**: 🔵 **PLANNED**
**Estimated Time**: 2.5 hours
**Risk Level**: Medium
**Impact**: High
**Lines to Remove**: ~105 lines
**Dependencies**: Phase 1, 2, 3 complete

---

## Executive Summary

This phase consolidates grade data fetching logic across dashboard and student modules by:
1. Creating a shared enrollment API service (`src/services/enrollmentService.js`)
2. Moving `gradeDataService.js` from `src/dashboard/` to `src/services/` (shared location)
3. Refactoring both modules to use the shared enrollment service
4. Eliminating ~105 lines of duplicate enrollment fetching and parsing code

---

## Problem Statement

### Current State: Code Duplication

**Dashboard Module** (`src/dashboard/gradeDataService.js`):
- `fetchEnrollmentScore()` (lines 218-310) - Fetches enrollment for single course
- `preCacheEnrollmentGrades()` (lines 90-145) - Parses enrollment data inline
- Enrollment parsing logic duplicated in two places (lines 108-132, 261-291)

**Student Module** (`src/student/allGradesPageCustomizer.js`):
- `fetchGradeDataFromAPI()` (lines 88-131) - Fetches all enrollments
- Different implementation but same API endpoint and similar parsing logic

### Issues

1. **Duplication**: Both modules fetch from `/api/v1/users/self/enrollments` with similar patterns
2. **Inconsistency**: Different parsing logic for the same enrollment data structure
3. **Maintainability**: Changes to enrollment handling require updates in multiple places
4. **Location**: `gradeDataService.js` in `src/dashboard/` but needed by student module too

### Proposed Solution

Create a unified enrollment service that:
- Provides consistent enrollment fetching across all modules
- Centralizes enrollment data parsing logic
- Handles both single-course and multi-course scenarios
- Maintains backward compatibility with existing caching

---

## Architecture Changes

### Before

```
src/dashboard/
├── gradeDataService.js
│   ├── fetchEnrollmentScore() - fetches single enrollment
│   ├── preCacheEnrollmentGrades() - parses enrollment data
│   └── [duplicate parsing logic in 2 places]
└── gradeDisplay.js → imports from ./gradeDataService.js

src/student/
└── allGradesPageCustomizer.js
    └── fetchGradeDataFromAPI() - fetches all enrollments
```

### After

```
src/services/
├── enrollmentService.js (NEW)
│   ├── parseEnrollmentGrade() - shared parsing logic
│   ├── fetchSingleEnrollment() - fetch for one course
│   ├── fetchAllEnrollments() - fetch for all courses
│   └── extractEnrollmentData() - convert to Map
└── gradeDataService.js (MOVED from dashboard/)
    ├── Uses enrollmentService for all enrollment operations
    └── Focuses on grade source hierarchy and caching

src/dashboard/
└── gradeDisplay.js → imports from ../services/gradeDataService.js

src/student/
└── allGradesPageCustomizer.js → imports from ../services/enrollmentService.js
```

---

## Task Breakdown

### Task 4.1: Create Shared Enrollment API Utilities
**Time**: 45 minutes | **Risk**: Medium | **Lines Saved**: ~60

Create `src/services/enrollmentService.js` with:

#### Functions to Implement

1. **`parseEnrollmentGrade(enrollmentData)`**
   - Extracts score and letter grade from enrollment object
   - Handles both nested `grades` object and top-level fields
   - Returns `{score, letterGrade}` or `null`
   - Consolidates parsing logic from 2 locations

2. **`fetchAllEnrollments(apiClient, options)`**
   - Fetches all student enrollments from `/api/v1/users/self/enrollments`
   - Options: `{ state: 'active', includeTotalScores: true }`
   - Returns array of enrollment objects
   - Used by all-grades page

3. **`fetchSingleEnrollment(courseId, apiClient)`**
   - Fetches enrollment for specific course
   - Endpoint: `/api/v1/courses/${courseId}/enrollments?user_id=self`
   - Returns enrollment object or null
   - Used by dashboard (fallback when not pre-cached)

4. **`extractEnrollmentData(enrollments)`**
   - Converts array of enrollments to `Map<courseId, {score, letterGrade}>`
   - Uses `parseEnrollmentGrade()` internally
   - Returns Map for easy lookup
   - Used by all-grades page

#### Subtasks
- [ ] 4.1.1: Design enrollmentService API
- [ ] 4.1.2: Implement parseEnrollmentGrade()
- [ ] 4.1.3: Implement fetchAllEnrollments()
- [ ] 4.1.4: Implement fetchSingleEnrollment()
- [ ] 4.1.5: Implement extractEnrollmentData()
- [ ] 4.1.6: Add comprehensive JSDoc documentation

**Files Created**: 1 (enrollmentService.js)

---

### Task 4.2: Move gradeDataService to Shared Location
**Time**: 20 minutes | **Risk**: Low | **Files Modified**: 3

Move `src/dashboard/gradeDataService.js` → `src/services/gradeDataService.js`

#### Rationale
- Makes service available to both dashboard and student modules
- Aligns with existing `src/services/` architecture
- Follows separation of concerns (services vs UI modules)

#### Subtasks
- [ ] 4.2.1: Create src/services/gradeDataService.js (copy from dashboard/)
- [ ] 4.2.2: Update dashboard/gradeDisplay.js imports
- [ ] 4.2.3: Update dashboard/cardRenderer.js imports
- [ ] 4.2.4: Remove old dashboard/gradeDataService.js

### Task 4.4: Update Student Module to Use Shared Services
**Time**: 25 minutes | **Risk**: Medium | **Lines Removed**: ~45

Update `src/student/allGradesPageCustomizer.js` to use shared enrollment service.

#### Changes

**Before** (fetchGradeDataFromAPI):
```javascript
async function fetchGradeDataFromAPI(apiClient) {
    const gradeMap = new Map();

    const enrollments = await apiClient.get(
        '/api/v1/users/self/enrollments',
        {
            'type[]': 'StudentEnrollment',
            'state[]': 'active',
            'include[]': 'total_scores'
        },
        'fetchAllGrades'
    );

    for (const enrollment of enrollments) {
        const courseId = enrollment.course_id?.toString();
        if (!courseId) continue;

        const grades = enrollment.grades || {};
        const percentage = grades.current_score ?? grades.final_score ?? null;
        const rawLetterGrade = grades.current_grade ?? grades.final_grade ?? null;
        const letterGrade = rawLetterGrade ? rawLetterGrade.trim() : null;

        gradeMap.set(courseId, { percentage, letterGrade });
    }

    return gradeMap;
}
```

**After**:
```javascript
import { fetchAllEnrollments, extractEnrollmentData } from '../services/enrollmentService.js';

async function fetchGradeDataFromAPI(apiClient) {
    const enrollments = await fetchAllEnrollments(apiClient, {
        state: 'active',
        includeTotalScores: true
    });

    return extractEnrollmentData(enrollments);
}
```

#### Subtasks
- [ ] 4.4.1: Import enrollmentService utilities
- [ ] 4.4.2: Replace fetchGradeDataFromAPI()
- [ ] 4.4.3: Update fetchCourseGrades() function
- [ ] 4.4.4: Remove duplicate enrollment fetching code
- [ ] 4.4.5: Update logging prefixes

**Lines Removed**: ~45 (duplicate fetching and parsing)

---

### Task 4.5: Testing and Validation
**Time**: 30 minutes | **Risk**: Low

Comprehensive testing of refactored grade data fetching.

#### Test Scenarios

1. **Dashboard Grade Display**
   - Standards-based courses show correct grades
   - Traditional courses show correct grades
   - Letter grades display properly
   - Cache pre-population works

2. **All-Grades Page**
   - Table renders correctly
   - Grade conversion works (percentage → points)
   - Letter grades appear correctly
   - Both course types handled properly

3. **API Calls**
   - Enrollment API called with correct parameters
   - Response handling works correctly
   - Error handling graceful

4. **Caching**
   - Cache hits/misses logged correctly
   - Cache expiration works (5 minute TTL)
   - Pre-caching reduces API calls

5. **Error Handling**
   - API failures handled gracefully
   - Missing enrollment data doesn't break UI
   - Invalid course IDs handled

6. **Performance**
   - No regression in load times
   - API call count same or reduced
   - Cache effectiveness maintained

#### Subtasks
- [ ] 4.5.1: Test dashboard grade display
- [ ] 4.5.2: Test all-grades page display
- [ ] 4.5.3: Verify enrollment API calls
- [ ] 4.5.4: Test caching behavior
- [ ] 4.5.5: Test error handling
- [ ] 4.5.6: Performance comparison

---

## Implementation Order

### Phase 1: Foundation (Task 4.1)
1. Design enrollmentService API
2. Implement parseEnrollmentGrade()
3. Implement fetchAllEnrollments()
4. Implement fetchSingleEnrollment()
5. Implement extractEnrollmentData()
6. Add documentation

**Checkpoint**: enrollmentService.js complete and documented

### Phase 2: Migration (Tasks 4.2 & 4.3)
1. Move gradeDataService to src/services/
2. Update all imports
3. Refactor gradeDataService to use enrollmentService
4. Remove duplicate parsing code

**Checkpoint**: Dashboard still works, no regressions

### Phase 3: Student Module (Task 4.4)
1. Update allGradesPageCustomizer imports
2. Replace fetchGradeDataFromAPI()
3. Remove duplicate code

**Checkpoint**: All-grades page still works

### Phase 4: Validation (Task 4.5)
1. Test all scenarios
2. Verify performance
3. Check error handling

**Checkpoint**: All tests pass, ready for production

---

## Files Modified Summary

### New Files (1)
- `src/services/enrollmentService.js` - Shared enrollment API utilities (173 lines)

### Modified Files (3)
- `src/services/gradeDataService.js` - Use shared enrollment service (-40 lines)
- `src/dashboard/gradeDisplay.js` - Update import path
- `src/dashboard/cardRenderer.js` - Update import path
- `src/student/allGradesPageCustomizer.js` - Use shared enrollment service (-45 lines)

### Deleted Files (1)
- `src/dashboard/gradeDataService.js` - Moved to services/

---

## Risk Assessment

### Medium Risks

1. **Breaking Changes**
   - **Risk**: Import path changes could break builds
   - **Mitigation**: Update all imports before deleting old file
   - **Verification**: Search codebase for old import paths

2. **API Response Variations**
   - **Risk**: Canvas API might return different structures
   - **Mitigation**: parseEnrollmentGrade() handles all known variations
   - **Verification**: Test with multiple Canvas instances

3. **Cache Behavior**
   - **Risk**: Refactoring might affect cache effectiveness
   - **Mitigation**: Maintain existing cache logic, only change data source
   - **Verification**: Monitor cache hit/miss rates

### Low Risks

1. **Performance Regression**
   - **Risk**: Additional function calls might slow down
   - **Mitigation**: Shared functions are lightweight, no extra API calls
   - **Verification**: Performance comparison before/after

2. **Error Handling**
   - **Risk**: New error paths might not be handled
   - **Mitigation**: Maintain existing try/catch patterns
   - **Verification**: Test error scenarios

---

## Benefits

### Code Quality
- ✅ Eliminates ~105 lines of duplicate code
- ✅ Single source of truth for enrollment data parsing
- ✅ Consistent API patterns across modules
- ✅ Better separation of concerns

### Maintainability
- ✅ Changes to enrollment handling in one place
- ✅ Easier to update when Canvas API changes
- ✅ Clear module boundaries (services vs UI)
- ✅ Improved testability

### Architecture
- ✅ gradeDataService accessible to all modules
- ✅ Follows existing services/ pattern
- ✅ Reduces coupling between dashboard and student modules
- ✅ Enables future enrollment-related features

---

## Success Criteria

1. ✅ All existing functionality works unchanged
2. ✅ ~105 lines of duplicate code removed
3. ✅ enrollmentService.js created with 4 functions
4. ✅ gradeDataService.js moved to services/
5. ✅ All imports updated correctly
6. ✅ Dashboard grade display works
7. ✅ All-grades page works
8. ✅ Caching behavior maintained
9. ✅ No performance regression
10. ✅ All tests pass

---

## Rollback Plan

If issues arise during implementation:

1. **After Task 4.1**: No rollback needed (new file only)
2. **After Task 4.2**: Revert import changes, restore dashboard/gradeDataService.js
3. **After Task 4.3**: Revert gradeDataService.js to use inline parsing
4. **After Task 4.4**: Revert allGradesPageCustomizer.js to use fetchGradeDataFromAPI()

**Git Strategy**: Create feature branch, commit after each task, merge when all tests pass

---

## Future Enhancements

After Phase 4 completion, consider:

1. **Session Storage Caching** (from possibleMemoryImprovements.md)
   - Migrate from in-memory Map to sessionStorage
   - Add user ID validation for multi-user scenarios
   - Persist cache across SPA navigation

2. **Enrollment Service Extensions**
   - Add `fetchEnrollmentWithAssignments()`
   - Add `fetchEnrollmentWithOutcomes()`
   - Support pagination for large course lists

3. **Performance Optimizations**
   - Implement request deduplication
   - Add batch enrollment fetching
   - Optimize cache TTL based on usage patterns

---

## References

- **Original Analysis**: `docs/REFACTORING_ANALYSIS.md` (lines 245-260)
- **Task List**: `docs/REFACTORING_TASK_LIST.md` (Task 2.3, lines 141-156)
- **Memory Improvements**: `docs/possibleMemoryImprovements.md` (lines 10-37)
- **Phase 1-3 Summaries**: `docs/PHASE_1_COMPLETION_SUMMARY.md`, `PHASE_2_COMPLETION_SUMMARY.md`, `PHASE_3_COMPLETION_SUMMARY.md`

---

## Conclusion

Phase 4 consolidates grade data fetching logic by creating a shared enrollment service and moving gradeDataService to a shared location. This refactoring eliminates ~105 lines of duplicate code while improving maintainability and setting the foundation for future enhancements like session storage caching.

**Estimated Total Time**: 2.5 hours
**Estimated Lines Removed**: ~105 lines
**Risk Level**: Medium (manageable with proper testing)
**Impact**: High (affects core grade fetching functionality)

**Recommendation**: Proceed with implementation following the phased approach outlined above. Test thoroughly after each phase before proceeding to the next.

### Task 4.3: Refactor gradeDataService to Use Shared Enrollment API
**Time**: 30 minutes | **Risk**: Medium | **Lines Removed**: ~40

Update `gradeDataService.js` to use shared enrollment utilities.

#### Changes

**Before** (fetchEnrollmentScore):
```javascript
// Lines 261-291: Inline enrollment parsing
let score = null;
let letterGrade = null;

if (studentEnrollment.grades) {
    score = studentEnrollment.grades.current_score
        ?? studentEnrollment.grades.final_score;
    letterGrade = (studentEnrollment.grades.current_grade
        ?? studentEnrollment.grades.final_grade
        ?? null)?.trim() ?? null;
}
// ... 30 more lines of fallback logic
```

**After**:
```javascript
import { parseEnrollmentGrade, fetchSingleEnrollment } from './enrollmentService.js';

// Use shared parsing
const gradeData = parseEnrollmentGrade(studentEnrollment);
if (!gradeData) return null;
return gradeData;
```

#### Subtasks
- [ ] 4.3.1: Import enrollmentService utilities
- [ ] 4.3.2: Refactor fetchEnrollmentScore()
- [ ] 4.3.3: Refactor preCacheEnrollmentGrades()
- [ ] 4.3.4: Remove duplicate enrollment parsing code
- [ ] 4.3.5: Update function documentation

**Lines Removed**: ~40 (duplicate parsing logic)

---