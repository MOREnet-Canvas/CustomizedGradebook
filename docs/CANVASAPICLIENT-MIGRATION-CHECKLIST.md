# CanvasApiClient Migration Checklist

## Overview
This document provides a comprehensive checklist for migrating all Canvas API calls to use the new `CanvasApiClient` class. The migration eliminates redundant CSRF token fetching and centralizes API communication.

---

## Migration Pattern

### Before (Current Pattern)
```javascript
export async function createAssignment(courseId) {
    const csrfToken = getTokenCookie('_csrf_token'); // ❌ Fetch every time
    
    const res = await safeFetch(
        `/api/v1/courses/${courseId}/assignments`,
        {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken
            },
            body: JSON.stringify({
                authenticity_token: csrfToken,
                assignment: { /* ... */ }
            })
        },
        "createAssignment"
    );
    
    return await safeJsonParse(res, "createAssignment");
}
```

### After (CanvasApiClient Pattern)
```javascript
export async function createAssignment(courseId, apiClient) {
    // ✅ Token already cached in apiClient
    const assignmentId = await apiClient.post(
        `/api/v1/courses/${courseId}/assignments`,
        {
            assignment: { /* ... */ }
        },
        {},
        "createAssignment"
    );
    
    return assignmentId.id;
}
```

---

## File-by-File Migration Checklist

### ✅ File 1: `src/services/outcomeService.js`

**Functions to migrate:**
- [x] `getRollup(courseId)` → `getRollup(courseId, apiClient)`
  - **Current:** Uses `safeFetch` directly (GET request, no CSRF token needed)
  - **Migration:** Change to `apiClient.get()`
  - **Lines:** 25-34

- [x] `createOutcome(courseId)` → `createOutcome(courseId, apiClient)`
  - **Current:** Calls `getTokenCookie('_csrf_token')` on line 65
  - **Migration:** Replace with `apiClient.post()` for CSV import
  - **Special case:** Uses `Content-Type: text/csv` header
  - **Lines:** 64-133

**Import changes:**
- Remove: `import { getTokenCookie } from "../utils/canvas.js";`
- Keep: `import { safeFetch, safeJsonParse, TimeoutError } from "../utils/errorHandler.js";` (for polling)

---

### ✅ File 2: `src/services/assignmentService.js`

**Functions to migrate:**
- [x] `getAssignmentObjectFromOutcomeObj(courseId, outcomeObject)` → Add `apiClient` parameter
  - **Current:** Uses raw `fetch()` on line 28 (no CSRF token)
  - **Migration:** Change to `apiClient.get()`
  - **Lines:** 21-41

- [x] `createAssignment(courseId)` → `createAssignment(courseId, apiClient)`
  - **Current:** Calls `getTokenCookie('_csrf_token')` on line 49
  - **Migration:** Replace with `apiClient.post()`
  - **Lines:** 48-82

**Import changes:**
- Remove: `import { getTokenCookie } from "../utils/canvas.js";`

---

### ✅ File 3: `src/services/rubricService.js`

**Functions to migrate:**
- [x] `getRubricForAssignment(courseId, assignmentId)` → Add `apiClient` parameter
  - **Current:** Uses raw `fetch()` on line 28 (no CSRF token)
  - **Migration:** Change to `apiClient.get()`
  - **Lines:** 27-47

- [x] `createRubric(courseId, assignmentId, outcomeId)` → Add `apiClient` parameter
  - **Current:** Calls `getTokenCookie('_csrf_token')` on line 57
  - **Migration:** Replace with `apiClient.post()`
  - **Lines:** 56-108

**Import changes:**
- Remove: `import { getTokenCookie } from "../utils/canvas.js";`

---

### ✅ File 4: `src/services/gradeSubmission.js`

**Functions to migrate:**
- [x] `submitRubricScore(courseId, assignmentId, userId, rubricCriterionId, score)` → Add `apiClient` parameter
  - **Current:** Calls `getTokenCookie('_csrf_token')` on line 40
  - **Migration:** Replace with `apiClient.put()`
  - **Lines:** 39-77

- [x] `beginBulkUpdate(courseId, assignmentId, rubricCriterionId, averages)` → Add `apiClient` parameter
  - **Current:** Calls `getTokenCookie('_csrf_token')` on line 90
  - **Migration:** Replace with `apiClient.post()`
  - **Lines:** 89-142

- [x] `waitForBulkGrading(box, timeout, interval)` → Add `apiClient` parameter
  - **Current:** Uses `safeFetch` directly on line 164 (GET request, no CSRF token)
  - **Migration:** Change to `apiClient.get()`
  - **Lines:** 156-205

**Import changes:**
- Remove: `import { getTokenCookie } from "../utils/canvas.js";` (keep `getCourseId`)
- Update: `import { getCourseId } from "../utils/canvas.js";`

---

### ✅ File 5: `src/services/gradeOverride.js`

**Functions to migrate:**
- [x] `setOverrideScoreGQL(enrollmentId, overrideScore)` → `setOverrideScoreGQL(enrollmentId, overrideScore, apiClient)`
  - **Current:** Calls `getTokenCookie('_csrf_token')` on line 33
  - **Migration:** Replace with `apiClient.graphql()`
  - **Lines:** 32-76

- [x] `getEnrollmentIdForUser(courseId, userId)` → Add `apiClient` parameter
  - **Current:** Uses `safeFetch` directly on line 101 (GET request, no CSRF token)
  - **Migration:** Change to `apiClient.get()`
  - **Lines:** 86-114

**Import changes:**
- Remove: `import { getTokenCookie } from "../utils/canvas.js";`

---

### ✅ File 6: `src/services/verification.js`

**Functions to migrate:**
- [x] `verifyUIScores(courseId, averages, outcomeId, box, waitTimeMs, maxRetries)` → Add `apiClient` parameter
  - **Current:** Uses raw `fetch()` on line 45 (GET request, no CSRF token)
  - **Migration:** Change to `apiClient.get()`
  - **Lines:** 36-90

**Import changes:**
- Add: `import { CanvasApiClient } from "../utils/canvasApiClient.js";` (if needed)

---

### ✅ File 7: `src/gradebook/stateHandlers.js`

**Changes needed:**
- [x] Create `CanvasApiClient` instance at the start of each state handler
- [x] Pass `apiClient` to all service function calls

**Functions to update:**
- `handleCheckingSetup()` - Pass apiClient to `getRollup()`
- `handleCreatingOutcome()` - Pass apiClient to `createOutcome()`
- `handleCreatingAssignment()` - Pass apiClient to `createAssignment()`
- `handleCreatingRubric()` - Pass apiClient to `createRubric()`
- `handleCalculating()` - No API calls
- `handleUpdatingGrades()` - Pass apiClient to `beginBulkUpdate()` or `postPerStudentGrades()`
- `handlePollingProgress()` - Pass apiClient to `waitForBulkGrading()`
- `handleVerifying()` - Pass apiClient to `verifyUIScores()`

**Import changes:**
- Add: `import { CanvasApiClient } from "../utils/canvasApiClient.js";`

---

## Migration Steps (Recommended Order)

### Phase 1: Simple Migrations (No Dependencies)
1. ✅ Migrate `outcomeService.js`
2. ✅ Migrate `assignmentService.js`
3. ✅ Migrate `rubricService.js`

### Phase 2: Complex Migrations (Has Dependencies)
4. ✅ Migrate `gradeOverride.js`
5. ✅ Migrate `gradeSubmission.js` (depends on gradeOverride.js)
6. ✅ Migrate `verification.js`

### Phase 3: Orchestration Layer
7. ✅ Update `stateHandlers.js` to create apiClient and pass to all service calls

---

## Testing Checklist

After each migration:
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript/ESLint errors
- [ ] Function signatures match expected usage
- [ ] All `getTokenCookie('_csrf_token')` calls removed
- [ ] All raw `fetch()` calls replaced with `apiClient` methods

After all migrations:
- [ ] Search codebase for `getTokenCookie('_csrf_token')` - should return 0 results
- [ ] Test full update flow in Canvas
- [ ] Test outcome creation
- [ ] Test assignment creation
- [ ] Test rubric creation
- [ ] Test per-student grade submission
- [ ] Test bulk grade submission
- [ ] Test grade override (if enabled)
- [ ] Test verification

---

## Common Patterns

### Pattern 1: GET Request (No CSRF Token)
**Before:**
```javascript
const res = await fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
const data = await res.json();
```

**After:**
```javascript
const data = await apiClient.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}`);
```

### Pattern 2: POST/PUT with CSRF Token
**Before:**
```javascript
const csrfToken = getTokenCookie('_csrf_token');
const res = await safeFetch(url, {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ authenticity_token: csrfToken, ...data })
});
```

**After:**
```javascript
const result = await apiClient.post(url, data);
```

### Pattern 3: GraphQL Request
**Before:**
```javascript
const csrfToken = getTokenCookie('_csrf_token');
const res = await safeFetch("/api/graphql", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ query, variables })
});
```

**After:**
```javascript
const result = await apiClient.graphql(query, variables);
```

---

## Notes

- ✅ CanvasApiClient automatically adds CSRF token to headers AND body
- ✅ CanvasApiClient automatically parses JSON responses
- ✅ CanvasApiClient integrates with existing `safeFetch` error handling
- ✅ No retry logic needed (proven safe via testing)
- ✅ Token cached once per instance (performance improvement)

---

## Completion Criteria

Migration is complete when:
1. ✅ All 7 files migrated
2. ✅ All functions accept `apiClient` parameter
3. ✅ Zero `getTokenCookie('_csrf_token')` calls remain
4. ✅ All tests pass
5. ✅ Full update flow works in Canvas

