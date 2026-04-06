# Task List Corrections - April 6, 2026

**Applied before Phase 1 implementation begins.**

---

## 1. ✅ Designer Role Removed from Permissions

**Task Updated:** `Implement canAccessOutcomesDashboard()` (UUID: 3dS3fw84SXTrjw5C5neU2X)

**Change:** Removed "designer" from permitted roles.

**Permitted Roles (Final):**
- `teacher`
- `ta`
- `admin`
- `AccountAdmin`

**Implementation Note:** Check `ENV.current_user_roles` array for these exact strings only.

---

## 2. ✅ Schema Version Check Added

**New Tasks Created:**

1. **Add SCHEMA_VERSION constant** (UUID: d6zRdcifh1K4tpM59RBxsK)
   - Define `const SCHEMA_VERSION = '1.0';` at top of `outcomesCacheService.js`
   - Used in both write and read operations

2. **Implement schema version check** (UUID: bLnbPUkJ1tjitV8bP2owRR)
   - After parsing JSON from Canvas Files
   - Compare `cache.meta.schemaVersion` against `SCHEMA_VERSION`
   - If mismatch: log warning, return `null`
   - Dashboard treats `null` as "no cache" → prompts refresh
   - **DO NOT** attempt to migrate old schemas

**Task Updated:** `Implement writeOutcomesCache()` (UUID: m1YVc6nuktPGoEhfk7BtY8)
- Now writes `cache.metadata.schemaVersion = SCHEMA_VERSION` before upload

**Purpose:** Automatic stale cache detection when schema evolves in future versions.

---

## 3. ✅ Progress Callback Added to Data Fetch

**Task Updated:** `Implement fetchOutcomeRollups()` (UUID: 4vwPRWEwtPZzM7582ZGdpX)

**Change:** Function must now accept `onProgress(message)` callback parameter.

**Implementation:**
```javascript
async function fetchOutcomeRollups(courseId, apiClient, onProgress) {
    // Fire callback between API pages
    onProgress('Fetching outcome results... page 1');
    // ... fetch page 1
    onProgress('Fetching outcome results... page 2');
    // ... fetch page 2
}
```

**Purpose:** Large courses may require many paginated API calls. Without progress updates, UI appears frozen during slow fetch.

**UI Integration:** Refresh button shows progress messages to user.

---

## 4. ✅ Renderer/View Ownership Boundary Clarified

**Tasks Updated:**

### outcomesRenderer.js (UUID: 4tkuwHb1DbYjYt6U3TKpjq)
**Responsibility:** Owns all component builder functions
- Builds and returns DOM elements
- **Does NOT append them anywhere**
- Pure component factory pattern

### outcomesDashboardView.js (UUID: 48P85KdGHGuAvui41u514A)
**Responsibility:** Owns layout and orchestration
- Calls renderer functions
- Appends output into shell/container
- Wires up event handlers
- **NO rendering logic directly in view** - always delegate to renderer

**All View subtasks updated** to clarify: Call renderer, append result, wire handlers.

---

## 5. ✅ Error State UI Tasks Added

**New Tasks Created under outcomesRenderer.js:**

### 5a. renderErrorState() (UUID: bmeuRppHhyJr73Uf6nyoq3)
**Trigger:** Canvas Files API fails on read or write
**Display:**
- Clear error message
- Specific failure reason (if available from API response)
- **Retry button** that re-triggers the same operation
**Important:** No fallback to localStorage - error and stop

### 5b. renderEmptyOutcome() (UUID: 5NKY7S16rDuSwtKQTXik6A)
**Trigger:** Individual outcome has ZERO attempts across all students
**Distinction:** Different from "NE" (which means <MIN_SCORES attempts)
**Display:**
- Outcome name
- "No attempts recorded" indicator

### 5c. renderNoCacheState() (UUID: 2VnAaYtjXfd93sKfkucp9e)
**Trigger:** `readOutcomesCache()` returns `null` AND `fetchOutcomeNames()` also fails
**Distinction:** Different from default state (which shows outcome names)
**Display:**
- Minimal message
- "Dashboard could not load course data"
- "Check connection or contact support"

**All error state renderers:** Follow renderer pattern (build + return, no append).

---

## 6. ✅ Schema Version Constant Added to Cache Structure

**Updated:** `DATA_STRUCTURES.md` - Section 7: Complete Outcomes Cache

**New Field:**
```javascript
{
  metadata: {
    schemaVersion: "1.0",  // ← NEW: SCHEMA_VERSION constant
    courseId: "566",
    generatedAt: "2026-04-06T15:30:00Z",
    minScoresThreshold: 3,
    studentCount: 25,
    outcomeCount: 6
  },
  // ... rest of structure
}
```

**Write Operation:** `writeOutcomesCache()` sets this from `SCHEMA_VERSION` constant
**Read Operation:** `readOutcomesCache()` validates against `SCHEMA_VERSION` constant
**Mismatch Behavior:** Return `null`, log warning, force fresh data fetch

---

## Summary of Changes

| Area | Change Type | Impact |
|------|-------------|--------|
| Permissions | Removed role | Designer role excluded |
| Cache | Schema versioning | Auto-detect stale cache |
| Data Fetch | Progress callback | UI responsiveness on large courses |
| Architecture | Ownership boundary | Cleaner separation renderer/view |
| Error Handling | 3 new error states | Better UX on failures |

**Total New Tasks:** 5
**Total Updated Tasks:** 8
**Phase Structure:** Unchanged
**Task Sequence:** Unchanged

**Ready to begin Phase 1 implementation with all corrections applied.**
