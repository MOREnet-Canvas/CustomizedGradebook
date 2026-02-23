# TODO: Refactor accountSettingsPanel.js

## Overview
`src/admin/accountSettingsPanel.js` is currently 1,901 lines and contains two distinct features that should be separated. Additionally, the grading schemes functionality has several components that can be further modularized.

## Current Structure
- **Total lines:** 1,901
- **Feature 1:** Final Grade Override Panel (~70 lines)
- **Feature 2:** Grading Schemes Panel (~1,400 lines)

## Refactoring Plan

### Phase 1: Separate the Two Main Features

#### 1.1 Extract Grading Schemes Panel
- **New file:** `src/admin/gradingSchemesPanel.js`
- **Lines to move:** ~1,400 lines (lines 37-1901)
- **Functions to extract:**
  - Core state management (lines 37-179):
    - `selectGradingScheme()`
    - `deselectGradingScheme()`
    - `setGradingType()`
    - `updateSelectedDisplay()`
    - `refreshGradingSchemesGrid()`
  - Canvas API integration (lines 192-341):
    - `createGradingStandard()`
    - `parseLinkHeader()`
    - `fetchGradingSchemes()`
  - HTML generators (lines 444-663, 1156-1532):
    - `openGradingSchemesInNewTab()`
    - `generateGradingSchemesHTML()`
    - `openGradingSchemeExamplesInNewTab()`
    - `generateGradingSchemeExamplesHTML()`
  - Modal editor (lines 671-1151):
    - `openGradingSchemeEditor()`
  - Main panel rendering (lines 1540-1901):
    - `renderGradingSchemesPanel()`
    - `renderGradingSchemeCard()`
    - `refreshGradingSchemesGridExternal()`
  - Global state variables (lines 22-28)

#### 1.2 Keep in accountSettingsPanel.js
- **Remaining lines:** ~300 lines
- **Functions to keep:**
  - `renderAccountSettingsPanel()` (line 348)
  - `renderFeatureFlagPanel()` (line 369)
  - `fetchFinalGradeOverrideStatus()` (line 256)

#### 1.3 Shared Utilities Decision
- **`fetchGradingSchemes()`** (line 302) - Move to grading schemes panel (it's only used there)
- **`parseLinkHeader()`** (line 239) - Consider moving to `src/utils/paginationHelpers.js` if used elsewhere, or keep in grading schemes panel

### Phase 2: Further Modularize Grading Schemes Panel

#### 2.1 Extract HTML Template Generators
- **New file:** `src/admin/templates/gradingSchemeTemplates.js`
- **Size:** ~400 lines (after deduplication)
- **Functions:**
  - `generateGradingSchemesHTML()` (~220 lines)
  - `generateGradingSchemeExamplesHTML()` (~360 lines)
- **Deduplication opportunity:** Both functions share ~40% of CSS/structure - extract common template function

#### 2.2 Extract Modal Editor Component
- **New file:** `src/admin/components/gradingSchemeEditor.js`
- **Size:** ~480 lines
- **Functions:**
  - `openGradingSchemeEditor()` (lines 671-1151)
- **Benefits:** Self-contained UI component with clear inputs/outputs

#### 2.3 Refactor Canvas API Functions
- **Decision needed:** Should these use `CanvasApiClient` instead of raw `fetch()`?
- **Functions to refactor:**
  - `fetchGradingSchemes()` - Currently uses raw `fetch()` with manual pagination
  - `fetchFinalGradeOverrideStatus()` - Currently uses raw `fetch()`
  - `createGradingStandard()` - Already uses `CanvasApiClient` ✅

### Phase 3: Fix Pagination Issues (CRITICAL)

#### 3.1 Add Pagination Support to CanvasApiClient
- **Problem:** `CanvasApiClient.get()` only returns first page (parsed JSON, no access to Link headers)
- **Impact:** Multiple modules broken for >100 items
- **Solution options:**
  1. Add `getAllPages()` method to `CanvasApiClient` that follows Link headers
  2. Return both data and headers from `get()` method
  3. Add optional `paginate: true` parameter to `get()` method

#### 3.2 Fix Broken Pagination in gradeOverride.js
- **File:** `src/services/gradeOverride.js`
- **Function:** `getAllEnrollmentIds()` (lines 75-93)
- **Current bug:** Pagination loop exists but is disabled (`url = null` on line 88)
- **Impact:** Grade override only works for first 100 students in a course
- **TODO comment:** Line 87 explicitly states "TODO: Implement proper pagination support in CanvasApiClient if needed"

#### 3.3 Refactor fetchGradingSchemes() to Use CanvasApiClient
- **Current:** Uses raw `fetch()` with manual pagination (lines 302-341)
- **After fix:** Use `CanvasApiClient` with new pagination support
- **Benefits:** Consistent error handling, CSRF token management, logging

#### 3.4 Audit Other Endpoints for Pagination Issues
- **Check:** `outcomeService.js` - `getRollup()` (may need pagination for >100 students)
- **Check:** Any other endpoints that fetch lists of items

## File Structure After Refactoring

```
src/admin/
├── accountSettingsPanel.js (~300 lines - Final Grade Override only)
├── gradingSchemesPanel.js (~400 lines - Core panel logic)
├── components/
│   └── gradingSchemeEditor.js (~480 lines - Modal editor)
└── templates/
    └── gradingSchemeTemplates.js (~400 lines - HTML generators, deduplicated)

src/utils/
├── canvasApiClient.js (add pagination support)
└── paginationHelpers.js (optional - if parseLinkHeader used elsewhere)

src/services/
└── gradeOverride.js (fix pagination bug)
```

## Dependencies to Update

After extracting grading schemes panel:
- `src/admin/loaderGeneratorPanel.js` - Update import from `accountSettingsPanel.js` to `gradingSchemesPanel.js`
- Any other files that import grading schemes functions

## Testing Checklist

- [ ] Final Grade Override panel still renders correctly
- [ ] Grading Schemes panel still renders correctly in Loader Generator panel
- [ ] Grading scheme selection works
- [ ] Grading scheme creation works
- [ ] "View All" opens new tab with schemes
- [ ] "Browse Examples" opens new tab with examples
- [ ] Modal editor opens and creates schemes
- [ ] Pagination works for >100 grading schemes
- [ ] Grade override works for courses with >100 students
- [ ] All imports updated correctly

## Priority

**HIGH PRIORITY:** Phase 3 (Fix Pagination Issues) - This is a critical bug affecting courses with >100 students

**MEDIUM PRIORITY:** Phase 1 (Separate Features) - Improves maintainability

**LOW PRIORITY:** Phase 2 (Further Modularization) - Nice to have, but not blocking

## Notes

- The grading schemes panel is only rendered from `loaderGeneratorPanel.js`, not from `accountSettingsPanel.js` itself (see comment on line 351)
- `parseLinkHeader()` is duplicated in `accountFilterPanel.js` (lines 48-49 use a regex-based approach) - consider consolidating
- Consider whether `fetchHelpers.js` and `canvasApiClient.js` patterns can be unified (they serve different purposes but both handle fetching)