# CustomizedGradebook - Refactoring Analysis
## Dashboard & Student Modules Code Review

**Date**: 2026-01-16  
**Scope**: `src/dashboard/` and `src/student/` modules  
**Focus**: Code duplication, organization, maintainability, shared utility opportunities

---

## Executive Summary

The codebase is generally well-organized with clear module boundaries. However, there are several opportunities to reduce duplication, improve consistency, and enhance maintainability through strategic refactoring.

**Key Findings**:
- ✅ Good separation of concerns between modules
- ⚠️ Significant code duplication in utility functions (formatting, conversion, page detection)
- ⚠️ Inconsistent patterns for similar operations (debounce, grade formatting, percentage conversion)
- ⚠️ Some functions in suboptimal locations (deprecated wrapper functions)
- ✅ Good use of shared utilities in `src/utils/`

---

## Prioritized Refactoring Opportunities

### **Priority 1: High Value, Low Risk**

#### 1. Consolidate Grade Formatting Functions

**Description**: Three separate files have nearly identical `formatGradeDisplay()` functions that format a score with an optional letter grade.

**Current State**:
- `src/student/gradePageCustomizer.js` (lines 98-103)
- `src/student/allGradesPageCustomizer.js` (lines 75-82)
- `src/student/gradeNormalizer.js` (lines 158-164)

All three implement the same logic:
```javascript
function formatGradeDisplay(score, letterGrade) {
    if (letterGrade) {
        return `${score} (${letterGrade})`;
    }
    return score;
}
```

**Proposed Solution**: Create shared utility in `src/utils/gradeFormatting.js`

**Files Affected**:
- NEW: `src/utils/gradeFormatting.js`
- MODIFY: `src/student/gradePageCustomizer.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`
- MODIFY: `src/student/gradeNormalizer.js`

**Benefits**:
- Single source of truth for grade formatting
- Easier to modify format in future (e.g., add styling, change separator)
- Reduces code duplication by ~18 lines
- Improves testability (one function to test instead of three)

**Risk Level**: **Low** - Pure function with no side effects, simple replacement

**Effort Estimate**: **Small** - 15 minutes

---

#### 2. Consolidate Percentage-to-Points Conversion

**Description**: Two files have identical `percentageToPoints()` functions that convert percentage scores to point values.

**Current State**:
- `src/dashboard/cardRenderer.js` (lines 141-144)
- `src/student/allGradesPageCustomizer.js` (lines 65-68)

Both implement:
```javascript
function percentageToPoints(percentage) {
    return (percentage / 100) * DEFAULT_MAX_POINTS;
}
```

**Proposed Solution**: Move to `src/utils/gradeFormatting.js` (same file as #1)

**Files Affected**:
- MODIFY: `src/utils/gradeFormatting.js` (add function)
- MODIFY: `src/dashboard/cardRenderer.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`

**Benefits**:
- Consistent conversion logic across modules
- Single place to adjust conversion formula if needed
- Reduces duplication by ~6 lines
- Improves testability

**Risk Level**: **Low** - Pure function, simple math operation

**Effort Estimate**: **Small** - 10 minutes

---

#### 3. Consolidate Page Detection Functions

**Description**: Multiple files have duplicate or similar page detection logic for identifying all-grades page, dashboard page, and course pages.

**Current State**:
- `src/student/studentGradeCustomization.js` has `isAllGradesPage()` (lines 35-39)
- `src/student/cleanupObserver.js` has `isAllGradesPage()` (lines 102-105)
- `src/dashboard/gradeDisplay.js` has `isDashboardPage()` (lines 33-36)
- `src/utils/canvas.js` has `isDashboardPage()` (lines 83-86)
- `src/student/cleanupObserver.js` has `isDashboardPage()` imported from utils
- `src/student/studentGradeCustomization.js` has `isSingleCourseGradesPage()` (lines 24-29)
- `src/student/cleanupObserver.js` has `isCoursePageNeedingCleanup()` (lines 35-45)

**Proposed Solution**: Create comprehensive page detection utility in `src/utils/pageDetection.js`

**Files Affected**:
- NEW: `src/utils/pageDetection.js`
- MODIFY: `src/student/studentGradeCustomization.js`
- MODIFY: `src/student/cleanupObserver.js`
- MODIFY: `src/dashboard/gradeDisplay.js`
- MODIFY: `src/utils/canvas.js` (remove `isDashboardPage`, keep other functions)

**Benefits**:
- Single source of truth for all page detection logic
- Easier to maintain URL patterns
- Reduces duplication by ~30 lines
- More consistent naming and behavior
- Easier to add new page types in future

**Risk Level**: **Low** - Simple boolean functions, easy to verify

**Effort Estimate**: **Medium** - 30 minutes

---

#### 4. Consolidate Debounce Function

**Description**: Two separate implementations of debounce function exist.

**Current State**:
- `src/utils/dom.js` has `debounce()` (lines 14-20) - supports arguments
- `src/student/cleanupObserver.js` has `debounce()` (lines 23-29) - simpler version

**Proposed Solution**: Use the more robust version from `src/utils/dom.js` everywhere

**Files Affected**:
- MODIFY: `src/student/cleanupObserver.js` (import from utils/dom.js)

**Benefits**:
- Single implementation with better argument handling
- Reduces duplication by ~7 lines
- More consistent behavior across codebase

**Risk Level**: **Low** - Well-tested pattern, simple replacement

**Effort Estimate**: **Small** - 5 minutes

---

### **Priority 2: Medium Value, Low Risk**

#### 5. Remove Deprecated Wrapper Function

**Description**: `cardRenderer.js` has a deprecated `isValidLetterGrade()` wrapper that just delegates to the shared utility.

**Current State**:
- `src/dashboard/cardRenderer.js` (lines 118-134) - Deprecated wrapper with @deprecated tag
- Already delegates to `validateLetterGrade` from `src/utils/courseDetection.js`

**Proposed Solution**: Remove wrapper and use shared utility directly

**Files Affected**:
- MODIFY: `src/dashboard/cardRenderer.js`

**Benefits**:
- Removes unnecessary indirection
- Reduces code by ~17 lines
- Cleaner call stack
- Follows the deprecation notice already in the code

**Risk Level**: **Low** - Already marked as deprecated, simple find-replace

**Effort Estimate**: **Small** - 10 minutes

---

#### 6. Extract Dashboard Card Selector Logic

**Description**: Dashboard card finding logic is split between `gradeDisplay.js` and `cardRenderer.js` with some duplication.

**Current State**:
- `src/dashboard/gradeDisplay.js` has `getDashboardCardSelectors()` (lines 242-252)
- `src/dashboard/gradeDisplay.js` has `findDashboardCards()` (lines 258-289)
- `src/dashboard/cardRenderer.js` has `CARD_SELECTORS` constant (lines 23-29)
- `src/dashboard/cardRenderer.js` has `findCourseCard()` (lines 50-110)

**Proposed Solution**: Create shared `src/dashboard/cardSelectors.js` module

**Files Affected**:
- NEW: `src/dashboard/cardSelectors.js`
- MODIFY: `src/dashboard/gradeDisplay.js`
- MODIFY: `src/dashboard/cardRenderer.js`

**Benefits**:
- Single source of truth for card selectors
- Easier to update when Canvas changes UI
- Reduces duplication of selector arrays
- Better organization

**Risk Level**: **Low** - Pure extraction, no logic changes

**Effort Estimate**: **Medium** - 25 minutes

---

#### 7. Consolidate Course ID Extraction Logic

**Description**: Course ID extraction from URLs/hrefs is duplicated across files.

**Current State**:
- `src/student/gradeExtractor.js` has `extractCourseIdFromHref()` (lines 138-141)
- `src/student/allGradesPageCustomizer.js` has inline extraction (line 112): `href.match(/\/courses\/(\d+)/)`
- `src/dashboard/cardRenderer.js` has inline extraction (line 64): `href.match(/\/courses\/(\d+)/)`
- `src/utils/canvas.js` has inline extraction (line 7): `pathname.match(/courses\/(\d+)/)`

**Proposed Solution**: Move `extractCourseIdFromHref()` to `src/utils/canvas.js` and use everywhere

**Files Affected**:
- MODIFY: `src/utils/canvas.js` (add function)
- MODIFY: `src/student/gradeExtractor.js` (remove function, import from utils)
- MODIFY: `src/student/allGradesPageCustomizer.js`
- MODIFY: `src/dashboard/cardRenderer.js`

**Benefits**:
- Consistent regex pattern across codebase
- Single place to update if URL structure changes
- Reduces duplication
- Better testability

**Risk Level**: **Low** - Simple regex extraction, easy to verify

**Effort Estimate**: **Small** - 15 minutes

---

#### 8. Create Shared Grade Data Service Interface

**Description**: Both dashboard and all-grades page fetch enrollment data with similar patterns but different implementations.

**Current State**:
- `src/dashboard/gradeDataService.js` has `fetchGradeFromEnrollment()` (lines 88-113)
- `src/student/allGradesPageCustomizer.js` has `fetchGradeDataFromAPI()` (lines 151-194)

Both fetch from `/api/v1/users/self/enrollments` with similar parameters but different processing.

**Proposed Solution**: Create shared enrollment fetching utility in `src/utils/enrollmentApi.js`

**Files Affected**:
- NEW: `src/utils/enrollmentApi.js`
- MODIFY: `src/dashboard/gradeDataService.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`

**Benefits**:
- Consistent API call patterns
- Shared caching strategy
- Easier to add error handling
- Reduces duplication of API parameters

**Risk Level**: **Medium** - Involves API calls and caching, needs careful testing

**Effort Estimate**: **Medium** - 40 minutes

---

### **Priority 3: Medium Value, Medium Risk**

#### 9. Standardize Grade Display Value Calculation

**Description**: Multiple files calculate display values (score, type, letter grade) with similar but slightly different logic.

**Current State**:
- `src/dashboard/cardRenderer.js` has display value calculation (lines 146-175)
- `src/student/allGradesPageCustomizer.js` has display value calculation (lines 244-266)
- `src/student/gradePageCustomizer.js` has simpler version (lines 105-125)

All follow similar pattern:
1. Check if standards-based
2. Convert percentage to points if needed
3. Determine display type
4. Get/calculate letter grade

**Proposed Solution**: Create shared `calculateDisplayValues()` function in `src/utils/gradeFormatting.js`

**Files Affected**:
- MODIFY: `src/utils/gradeFormatting.js`
- MODIFY: `src/dashboard/cardRenderer.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`
- MODIFY: `src/student/gradePageCustomizer.js`

**Benefits**:
- Consistent display logic across all pages
- Single place to adjust display rules
- Reduces duplication by ~60 lines
- Easier to add new display types

**Risk Level**: **Medium** - Core display logic, needs thorough testing

**Effort Estimate**: **Large** - 60 minutes

---

#### 10. Consolidate DOM Extraction Patterns

**Description**: Multiple files extract course data from DOM with similar patterns.

**Current State**:
- `src/student/allGradesPageCustomizer.js` has `extractCoursesFromDOM()` (lines 90-144)
- `src/dashboard/cardRenderer.js` has `findCourseCard()` (lines 50-110)
- Both search for course links, extract IDs, find grade elements

**Proposed Solution**: Create shared DOM extraction utilities in `src/utils/domExtractors.js`

**Files Affected**:
- NEW: `src/utils/domExtractors.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`
- MODIFY: `src/dashboard/cardRenderer.js`

**Benefits**:
- Consistent DOM querying patterns
- Easier to update when Canvas changes HTML structure
- Better error handling
- Reduces duplication

**Risk Level**: **Medium** - DOM manipulation, Canvas UI changes could break

**Effort Estimate**: **Large** - 50 minutes

---

### **Priority 4: Lower Priority Improvements**

#### 11. Extract CSS Injection Logic

**Description**: Multiple files inject CSS with similar patterns.

**Current State**:
- `src/student/gradePageCustomizer.js` has `injectCSS()` (lines 41-62)
- `src/student/allGradesPageCustomizer.js` has `injectHideTableCSS()` (lines 37-59)
- Both check for existing style tag, create new one, append to head

**Proposed Solution**: Create shared `injectStyles()` utility in `src/utils/dom.js`

**Files Affected**:
- MODIFY: `src/utils/dom.js`
- MODIFY: `src/student/gradePageCustomizer.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`

**Benefits**:
- Consistent CSS injection pattern
- Prevents duplicate style tags
- Easier to add CSP support in future

**Risk Level**: **Low** - Simple DOM manipulation

**Effort Estimate**: **Small** - 20 minutes

---

#### 12. Consolidate Table Creation Logic

**Description**: Both grade page customizers create similar table structures.

**Current State**:
- `src/student/gradePageCustomizer.js` has `createGradesTable()` (lines 131-195)
- `src/student/allGradesPageCustomizer.js` has `createGradesTable()` (lines 356-429)

Both create Canvas-styled tables with course names and grades.

**Proposed Solution**: Create shared table builder in `src/student/tableBuilder.js`

**Files Affected**:
- NEW: `src/student/tableBuilder.js`
- MODIFY: `src/student/gradePageCustomizer.js`
- MODIFY: `src/student/allGradesPageCustomizer.js`

**Benefits**:
- Consistent table styling
- Easier to update Canvas UI classes
- Reduces duplication by ~80 lines

**Risk Level**: **Medium** - UI rendering, needs visual verification

**Effort Estimate**: **Large** - 45 minutes

---

#### 13. Improve Logging Consistency

**Description**: Logging patterns vary across files - some use prefixes like `[Hybrid]`, `[Table]`, `[Detection]`, others don't.

**Current State**:
- `src/student/allGradesPageCustomizer.js` uses `[Hybrid]`, `[Table]` prefixes
- `src/dashboard/gradeDisplay.js` uses `[Dashboard]` prefix
- `src/student/gradePageCustomizer.js` uses `[GradePageCustomizer]` prefix
- Some files have no prefixes

**Proposed Solution**: Standardize logging with module-specific logger instances

**Files Affected**:
- MODIFY: `src/utils/logger.js` (add `createModuleLogger()` factory)
- MODIFY: All files in `src/dashboard/` and `src/student/`

**Benefits**:
- Consistent log format
- Easier to filter logs by module
- Better debugging experience

**Risk Level**: **Low** - Logging only, no functional changes

**Effort Estimate**: **Medium** - 35 minutes (many files to update)

---

#### 14. Extract Mutation Observer Patterns

**Description**: Multiple files set up MutationObservers with similar patterns.

**Current State**:
- `src/student/cleanupObserver.js` has observer setup (lines 73-84)
- `src/student/gradePageCustomizer.js` has observer setup (lines 218-232)
- `src/student/allGradesPageCustomizer.js` has observer setup (lines 514-531)
- `src/dashboard/gradeDisplay.js` has observer setup (lines 295-318)

All follow pattern:
1. Create observer with callback
2. Observe document.body
3. Set timeout to disconnect

**Proposed Solution**: Create `createAutoDisconnectObserver()` utility in `src/utils/dom.js`

**Files Affected**:
- MODIFY: `src/utils/dom.js`
- MODIFY: All files with MutationObserver setup

**Benefits**:
- Consistent observer configuration
- Automatic cleanup
- Reduces boilerplate by ~40 lines

**Risk Level**: **Low** - Well-tested pattern

**Effort Estimate**: **Medium** - 30 minutes

---

## Detailed Code Analysis

### Duplication Matrix

| Function/Pattern | Locations | Lines Duplicated | Priority |
|-----------------|-----------|------------------|----------|
| `formatGradeDisplay()` | 3 files | ~18 | P1 |
| `percentageToPoints()` | 2 files | ~6 | P1 |
| Page detection functions | 5 files | ~30 | P1 |
| `debounce()` | 2 files | ~7 | P1 |
| Course ID extraction | 4 files | ~12 | P2 |
| Grade display calculation | 3 files | ~60 | P3 |
| CSS injection | 2 files | ~25 | P4 |
| Table creation | 2 files | ~80 | P4 |
| MutationObserver setup | 4 files | ~40 | P4 |
| **TOTAL** | | **~278 lines** | |

### Module Dependency Analysis

```
src/utils/
├── logger.js (used by all modules)
├── canvas.js (used by dashboard, student)
├── courseDetection.js (used by dashboard, student)
├── dom.js (used by student)
└── gradeFormatting.js (PROPOSED - would be used by all)

src/dashboard/
├── gradeDisplay.js → uses utils/canvas, utils/courseDetection
├── cardRenderer.js → uses utils/courseDetection
└── gradeDataService.js → uses utils/canvas, utils/courseDetection

src/student/
├── studentGradeCustomization.js → uses gradeExtractor, gradePageCustomizer, allGradesPageCustomizer
├── gradeExtractor.js → uses utils/canvas
├── gradePageCustomizer.js → standalone (opportunity for more utils usage)
├── allGradesPageCustomizer.js → uses utils/canvas, utils/courseDetection
├── gradeNormalizer.js → standalone (opportunity for more utils usage)
└── cleanupObserver.js → uses utils/canvas
```

### Shared Utility Opportunities

**Currently Well-Shared**:
- ✅ `logger.js` - Used consistently across all modules
- ✅ `courseDetection.js` - Used by both dashboard and student modules
- ✅ `canvas.js` - Used for course ID and role detection

**Underutilized**:
- ⚠️ `dom.js` - Only used by one student file, could be used more widely
- ⚠️ `courseDetection.js` - Some files still have inline course detection logic

**Missing Utilities** (Proposed):
- ❌ `gradeFormatting.js` - Would consolidate formatting functions
- ❌ `pageDetection.js` - Would consolidate page detection
- ❌ `enrollmentApi.js` - Would consolidate API calls
- ❌ `domExtractors.js` - Would consolidate DOM extraction patterns

---

## Refactoring Strategy

### Phase 1: Quick Wins (Priority 1)
**Estimated Time**: 1.5 hours
**Risk**: Low
**Impact**: High

1. Consolidate grade formatting functions → `src/utils/gradeFormatting.js`
2. Consolidate percentage conversion → `src/utils/gradeFormatting.js`
3. Consolidate page detection → `src/utils/pageDetection.js`
4. Consolidate debounce → use `src/utils/dom.js`
5. Remove deprecated wrapper → `src/dashboard/cardRenderer.js`

**Expected Outcome**: ~60 lines removed, 5 new shared utilities

### Phase 2: Medium Improvements (Priority 2)
**Estimated Time**: 2 hours
**Risk**: Low-Medium
**Impact**: Medium

6. Extract dashboard card selectors → `src/dashboard/cardSelectors.js`
7. Consolidate course ID extraction → `src/utils/canvas.js`
8. Create shared enrollment API → `src/utils/enrollmentApi.js`

**Expected Outcome**: ~40 lines removed, better API consistency

### Phase 3: Structural Improvements (Priority 3)
**Estimated Time**: 2 hours
**Risk**: Medium
**Impact**: High

9. Standardize grade display calculation → `src/utils/gradeFormatting.js`
10. Consolidate DOM extraction → `src/utils/domExtractors.js`

**Expected Outcome**: ~110 lines removed, consistent display logic

### Phase 4: Polish (Priority 4)
**Estimated Time**: 2.5 hours
**Risk**: Low
**Impact**: Medium

11. Extract CSS injection → `src/utils/dom.js`
12. Consolidate table creation → `src/student/tableBuilder.js`
13. Improve logging consistency → `src/utils/logger.js`
14. Extract MutationObserver patterns → `src/utils/dom.js`

**Expected Outcome**: ~145 lines removed, better code organization

### Total Estimated Impact
- **Time**: ~8 hours
- **Lines Removed**: ~355 lines
- **New Shared Utilities**: 6-8 new functions/modules
- **Files Modified**: ~15 files
- **Risk Level**: Low-Medium (most changes are pure extractions)

---

## Testing Recommendations

After each refactoring phase:

1. **Manual Testing**:
   - Test dashboard grade display for standards-based and traditional courses
   - Test all-grades page for both course types
   - Test single course grades page
   - Verify cleanup observer behavior
   - Check console for errors

2. **Automated Testing** (if tests exist):
   - Run existing test suite
   - Add tests for new shared utilities
   - Add integration tests for grade display logic

3. **Visual Regression**:
   - Compare screenshots before/after
   - Verify table styling matches Canvas UI
   - Check grade formatting consistency

4. **Performance**:
   - Verify no increase in API calls
   - Check sessionStorage caching still works
   - Monitor MutationObserver performance

---

## Risk Mitigation

### Low-Risk Changes
- Pure function extractions (formatGradeDisplay, percentageToPoints, debounce)
- Page detection consolidation
- Removing deprecated code

**Mitigation**: Simple find-replace, easy to verify

### Medium-Risk Changes
- Grade display calculation consolidation
- Enrollment API consolidation
- DOM extraction patterns

**Mitigation**:
- Keep original functions temporarily with deprecation warnings
- Add comprehensive logging
- Test with multiple course types
- Gradual rollout (one module at a time)

### High-Risk Changes
- None identified in this analysis

---

## Code Quality Metrics

### Before Refactoring
- **Duplicated Code**: ~278 lines
- **Shared Utilities**: 4 files
- **Module Coupling**: Medium (some direct dependencies)
- **Maintainability**: Good (but could be better)

### After Refactoring (Projected)
- **Duplicated Code**: ~50 lines (82% reduction)
- **Shared Utilities**: 8-10 files
- **Module Coupling**: Low (more abstraction through utilities)
- **Maintainability**: Excellent

---

## Recommendations

### Immediate Actions (Do First)
1. ✅ **Start with Phase 1** - Quick wins with low risk
2. ✅ **Create `src/utils/gradeFormatting.js`** - Consolidate all formatting functions
3. ✅ **Create `src/utils/pageDetection.js`** - Consolidate all page detection
4. ✅ **Remove deprecated wrapper** in cardRenderer.js

### Short-term (Next Sprint)
5. ⏭️ **Phase 2 improvements** - Card selectors, course ID extraction, enrollment API
6. ⏭️ **Add unit tests** for new shared utilities
7. ⏭️ **Document** new utility functions with JSDoc

### Long-term (Future Sprints)
8. 🔮 **Phase 3 & 4** - Structural improvements and polish
9. 🔮 **Consider TypeScript** - Would catch many of these issues automatically
10. 🔮 **Add ESLint rules** - Detect code duplication automatically

---

## Appendix: File-by-File Analysis

### Dashboard Module

#### `src/dashboard/gradeDisplay.js` (323 lines)
- **Purpose**: Main orchestrator for dashboard grade display
- **Dependencies**: canvas.js, courseDetection.js, cardRenderer.js, gradeDataService.js
- **Duplication**: Page detection (lines 33-36)
- **Opportunities**: Use shared page detection utility

#### `src/dashboard/cardRenderer.js` (175 lines)
- **Purpose**: Renders grade information on dashboard cards
- **Dependencies**: courseDetection.js
- **Duplication**:
  - Percentage conversion (lines 141-144)
  - Course ID extraction (line 64)
  - Deprecated wrapper (lines 118-134)
- **Opportunities**: Use shared utilities, remove deprecated code

#### `src/dashboard/gradeDataService.js` (113 lines)
- **Purpose**: Fetches and caches grade data from Canvas API
- **Dependencies**: canvas.js, courseDetection.js
- **Duplication**: Enrollment API call pattern
- **Opportunities**: Use shared enrollment API utility

### Student Module

#### `src/student/studentGradeCustomization.js` (39 lines)
- **Purpose**: Entry point for student grade customizations
- **Dependencies**: gradeExtractor.js, gradePageCustomizer.js, allGradesPageCustomizer.js
- **Duplication**: Page detection (lines 24-39)
- **Opportunities**: Use shared page detection utility

#### `src/student/gradeExtractor.js` (141 lines)
- **Purpose**: Extracts grade data from DOM
- **Dependencies**: canvas.js
- **Duplication**: Course ID extraction (lines 138-141)
- **Opportunities**: Use shared course ID extraction

#### `src/student/gradePageCustomizer.js` (232 lines)
- **Purpose**: Customizes single course grades page
- **Dependencies**: None (standalone)
- **Duplication**:
  - Grade formatting (lines 98-103)
  - CSS injection (lines 41-62)
  - MutationObserver setup (lines 218-232)
- **Opportunities**: Use shared utilities for formatting, CSS, observers

#### `src/student/allGradesPageCustomizer.js` (531 lines)
- **Purpose**: Customizes all-grades page with hybrid view
- **Dependencies**: canvas.js, courseDetection.js
- **Duplication**:
  - Grade formatting (lines 75-82)
  - Percentage conversion (lines 65-68)
  - Course ID extraction (line 112)
  - CSS injection (lines 37-59)
  - Enrollment API call (lines 151-194)
  - MutationObserver setup (lines 514-531)
- **Opportunities**: Highest potential for consolidation

#### `src/student/gradeNormalizer.js` (164 lines)
- **Purpose**: Normalizes grade data from various sources
- **Dependencies**: None (standalone)
- **Duplication**: Grade formatting (lines 158-164)
- **Opportunities**: Use shared formatting utility

#### `src/student/cleanupObserver.js` (105 lines)
- **Purpose**: Cleans up grade displays on page navigation
- **Dependencies**: canvas.js (imports isDashboardPage)
- **Duplication**:
  - Page detection (lines 35-45, 102-105)
  - Debounce (lines 23-29)
  - MutationObserver setup (lines 73-84)
- **Opportunities**: Use shared utilities

---

## Conclusion

This codebase is well-structured with good separation of concerns. The main opportunities for improvement are:

1. **Reducing duplication** through shared utilities (~278 lines can be consolidated)
2. **Improving consistency** in patterns (formatting, API calls, DOM manipulation)
3. **Enhancing maintainability** by centralizing common logic

The proposed refactoring is **low-risk** and **high-value**, with most changes being simple extractions of pure functions. The phased approach allows for incremental improvements with testing at each stage.

**Recommended Next Step**: Start with Phase 1 (Priority 1 items) to achieve quick wins and build confidence before tackling larger structural changes.


