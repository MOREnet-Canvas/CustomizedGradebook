# AI Context - Outcomes Dashboard

**Quick reference for AI assistants working on the Outcomes Dashboard module.**

---

## Critical Understanding

### What This Module Does

**Outcomes Dashboard** = Teacher-facing analytics dashboard that uses **Power Law regression** to predict student mastery for each learning outcome.

**NOT** calculating a single "Current Score" - calculating predictions for **each individual outcome** (Outcome 1, Outcome 2, etc.).

---

## Key Documents (Read These First)

1. **`API_REFERENCE.md`** - Canvas API patterns and endpoints
2. **`DATA_STRUCTURES.md`** - Data formats throughout the pipeline
3. **`IMPLEMENTATION_SUMMARY.md`** - Architecture overview and file plan
4. **`README.md`** - User-facing documentation

---

## Critical Patterns (Reuse from Existing Code)

### 1. Assignment-Outcome Alignment

**Pattern Source:** `masteryDashboard/masteryDashboardViewer.js` lines 303-670

**API Call:**
```javascript
// Get alignment metadata
const rollupData = await apiClient.get(
    `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=outcomes.alignments`
);

// Get individual attempts
const resultsData = await apiClient.get(
    `/api/v1/courses/${courseId}/outcome_results?include[]=outcomes.alignments`
);
```

**Key Insight:** Rollups give you metadata and alignments, but **NOT** chronological history. Use `/outcome_results` for that.

---

### 2. Chronological Sorting

**Always sort by `submitted_or_assessed_at` ascending (oldest first)** for Power Law regression.

```javascript
sortedResults.sort((a, b) =>
    new Date(a.submitted_or_assessed_at || 0) - new Date(b.submitted_or_assessed_at || 0)
);
```

---

### 3. Minimum Attempts Threshold

**Location:** `src/outcomesDashboard/powerLaw.js`

```javascript
const MIN_SCORES = 3;  // Minimum attempts required for Power Law prediction
```

**Usage:**
```javascript
if (scores.length < MIN_SCORES) {
    status = 'NE';  // Not Enough data
    prediction = null;
} else {
    prediction = powerLawPredict(scores);
}
```

**⚠️ IMPORTANT:** This value is configurable - may change to 4 later.

---

### 4. Power Law Functions (Already Implemented)

**Location:** `src/outcomesDashboard/powerLaw.js`

**Use `computeStudentOutcome(scores)`** - Single entry point that calculates all metrics:

```javascript
import { computeStudentOutcome } from './powerLaw.js';

const scores = [2, 3.5, 4];  // Chronological (oldest first)
const stats = computeStudentOutcome(scores);

// Returns:
{
  status: 'ok',
  plPrediction: 4.2,
  slope: 0.35,
  mean: 3.17,
  mostRecent: 4,
  decayingAvg: 3.8,
  attemptCount: 3
}
```

**Don't reinvent Power Law calculation** - just call this function!

---

## Data Flow Summary

```
1. Fetch outcome metadata
   ↓
2. Fetch ALL outcome_results (no filters)
   ↓
3. Group by studentId_outcomeId
   ↓
4. Sort chronologically (oldest first)
   ↓
5. Extract score arrays
   ↓
6. For each array:
   if (scores.length >= MIN_SCORES)
       → computeStudentOutcome(scores)
   else
       → status: 'NE'
   ↓
7. Aggregate class stats per outcome
   ↓
8. Cache to Canvas Files API
   ↓
9. Render in UI
```

---

## Common Pitfalls (Avoid These!)

### ❌ DON'T use `/outcome_rollups` for chronological data
- It only shows aggregated/latest scores
- No timestamp information
- Use `/outcome_results` instead

### ❌ DON'T sort descending (newest first)
- Power Law expects chronological (oldest first)
- masteryDashboard sorts descending for display only

### ❌ DON'T create new Power Law functions
- Already implemented in `powerLaw.js`
- Use `computeStudentOutcome(scores)`

### ❌ DON'T hardcode MIN_SCORES = 3
- Import from `powerLaw.js`
- It's a configurable constant

### ❌ DON'T forget the composite key
- Group by `studentId_outcomeId` (e.g., `"642_598"`)
- Not just by studentId or outcomeId alone

---

## Reusable Services (Use Instead of Creating New)

| Need | Service | Location |
|------|---------|----------|
| Canvas API calls | `CanvasApiClient` | `src/utils/canvasApiClient.js` |
| Get student roster | `fetchCourseStudents()` | `src/services/enrollmentService.js` |
| Get course ID | `getCourseId()` | `src/utils/canvas.js` |
| **Check user role** | **`getUserRoleGroup()`** | **`src/utils/canvas.js`** |
| Create/update pages | `pageService` | `src/services/pageService.js` |
| Themed buttons | `makeButton()` | `src/ui/buttons.js` |
| Power Law math | `computeStudentOutcome()` | `src/outcomesDashboard/powerLaw.js` |
| Logging | `logger` | `src/utils/logger.js` |

**Rule:** Search codebase first before creating new utilities!

**See also:** `docs/AI_SERVICES_REFERENCE.md` for complete service list

---

## Testing Strategy

### Phase 0 (✅ Complete)
- Canvas APIs validated
- Data formats documented

### Phase 1 (Next)
- Build services with console tests
- Test each module independently

### Phase 2
- Data pipeline console test
- Verify MIN_SCORES threshold works
- Check Power Law predictions calculate correctly

### Phase 5
- Manual testing in beta environment
- Full end-to-end workflow

**No unit tests** - manual + console testing only.

---

## Quick Task Reference

**Current Status:** Phase 0 Complete ✅

**Next Task:** Phase 1 - Build `outcomesCacheService.js`

**View Full Tasks:** Run `view_tasklist` tool

---

## When In Doubt

1. Check `API_REFERENCE.md` for Canvas API patterns
2. Check `DATA_STRUCTURES.md` for data formats
3. Look at `masteryDashboard/masteryDashboardViewer.js` for similar patterns
4. Check if service already exists in codebase before creating new
5. Ask user for clarification if requirements unclear

---

## Summary for AI

**You are building a teacher dashboard that:**
- Fetches ALL outcome assessment attempts via `/outcome_results`
- Groups by student + outcome
- Sorts chronologically (oldest first)
- Applies Power Law regression (using existing `powerLaw.js` functions)
- Shows "NE" if < MIN_SCORES attempts
- Caches results in Canvas Files
- Displays with threshold-based intervention filtering

**Reuse existing patterns from masteryDashboard wherever possible!**