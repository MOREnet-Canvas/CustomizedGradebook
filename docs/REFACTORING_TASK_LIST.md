# CustomizedGradebook Refactoring - Task List

**Status**: Phase 1 In Progress  
**Last Updated**: 2026-01-16

---

## Phase 1: Quick Wins (Priority 1)
**Estimated Time**: 1.5 hours | **Risk**: Low | **Impact**: High

### ✅ Task 1.1: Consolidate Grade Formatting Functions
**Time**: 15 minutes | **Risk**: Low | **Lines Saved**: ~18

**Subtasks**:
- [ ] 1.1.1 Create `src/utils/gradeFormatting.js` with `formatGradeDisplay()` function
- [ ] 1.1.2 Update `src/student/gradePageCustomizer.js` to import and use shared function (remove lines 98-103)
- [ ] 1.1.3 Update `src/student/allGradesPageCustomizer.js` to import and use shared function (remove lines 75-82)
- [ ] 1.1.4 Update `src/student/gradeNormalizer.js` to import and use shared function (remove lines 158-164)
- [ ] 1.1.5 Test grade display on single course page
- [ ] 1.1.6 Test grade display on all-grades page

**Files Modified**: 4 (1 new, 3 modified)  
**Dependencies**: None

---

### ✅ Task 1.2: Consolidate Percentage-to-Points Conversion
**Time**: 10 minutes | **Risk**: Low | **Lines Saved**: ~6

**Subtasks**:
- [ ] 1.2.1 Add `percentageToPoints()` function to `src/utils/gradeFormatting.js`
- [ ] 1.2.2 Update `src/dashboard/cardRenderer.js` to import and use shared function (remove lines 141-144)
- [ ] 1.2.3 Update `src/student/allGradesPageCustomizer.js` to import and use shared function (remove lines 65-68)
- [ ] 1.2.4 Test dashboard grade display for percentage-based courses
- [ ] 1.2.5 Test all-grades page for percentage-based courses

**Files Modified**: 3 (1 modified from 1.1, 2 modified)  
**Dependencies**: Task 1.1 (same file)

---

### ✅ Task 1.3: Consolidate Page Detection Functions
**Time**: 30 minutes | **Risk**: Low | **Lines Saved**: ~30

**Subtasks**:
- [ ] 1.3.1 Create `src/utils/pageDetection.js` with all page detection functions
  - [ ] `isDashboardPage()` - from utils/canvas.js
  - [ ] `isAllGradesPage()` - from studentGradeCustomization.js
  - [ ] `isSingleCourseGradesPage()` - from studentGradeCustomization.js
  - [ ] `isCoursePageNeedingCleanup()` - from cleanupObserver.js
- [ ] 1.3.2 Update `src/student/studentGradeCustomization.js` to import from pageDetection (remove lines 24-39)
- [ ] 1.3.3 Update `src/student/cleanupObserver.js` to import from pageDetection (remove lines 35-45, 102-105)
- [ ] 1.3.4 Update `src/dashboard/gradeDisplay.js` to import from pageDetection (remove lines 33-36)
- [ ] 1.3.5 Update `src/utils/canvas.js` to remove `isDashboardPage()` (remove lines 83-86)
- [ ] 1.3.6 Test page detection on dashboard
- [ ] 1.3.7 Test page detection on all-grades page
- [ ] 1.3.8 Test page detection on single course page
- [ ] 1.3.9 Test cleanup observer behavior

**Files Modified**: 5 (1 new, 4 modified)  
**Dependencies**: None

---

### ✅ Task 1.4: Consolidate Debounce Function
**Time**: 5 minutes | **Risk**: Low | **Lines Saved**: ~7

**Subtasks**:
- [ ] 1.4.1 Update `src/student/cleanupObserver.js` to import `debounce` from `src/utils/dom.js`
- [ ] 1.4.2 Remove local `debounce()` function from cleanupObserver.js (remove lines 23-29)
- [ ] 1.4.3 Test cleanup observer debouncing behavior

**Files Modified**: 1  
**Dependencies**: None

---

### ✅ Task 1.5: Remove Deprecated Wrapper Function
**Time**: 10 minutes | **Risk**: Low | **Lines Saved**: ~17

**Subtasks**:
- [ ] 1.5.1 Find all usages of `isValidLetterGrade()` in `src/dashboard/cardRenderer.js`
- [ ] 1.5.2 Replace with direct calls to `validateLetterGrade()` from courseDetection
- [ ] 1.5.3 Remove deprecated `isValidLetterGrade()` function (remove lines 118-134)
- [ ] 1.5.4 Test dashboard grade display with letter grades

**Files Modified**: 1  
**Dependencies**: None

---

### Phase 1 Testing Checklist
- [ ] Dashboard displays grades correctly for standards-based courses
- [ ] Dashboard displays grades correctly for traditional courses
- [ ] All-grades page shows hybrid view correctly
- [ ] Single course grades page displays correctly
- [ ] Cleanup observer removes grades on navigation
- [ ] No console errors
- [ ] SessionStorage caching still works

**Phase 1 Total**: ~60 lines removed, 2 new utility files created

---

## Phase 2: Medium Improvements (Priority 2)
**Estimated Time**: 2 hours | **Risk**: Low-Medium | **Impact**: Medium

### Task 2.1: Extract Dashboard Card Selector Logic
**Time**: 25 minutes | **Risk**: Low | **Lines Saved**: ~15

**Subtasks**:
- [ ] 2.1.1 Create `src/dashboard/cardSelectors.js` module
- [ ] 2.1.2 Export `CARD_SELECTORS` constant
- [ ] 2.1.3 Export `getDashboardCardSelectors()` function
- [ ] 2.1.4 Export `findCourseCard()` function
- [ ] 2.1.5 Update `src/dashboard/gradeDisplay.js` to import from cardSelectors
- [ ] 2.1.6 Update `src/dashboard/cardRenderer.js` to import from cardSelectors
- [ ] 2.1.7 Test dashboard card finding logic

**Files Modified**: 3 (1 new, 2 modified)  
**Dependencies**: Phase 1 complete

---

### Task 2.2: Consolidate Course ID Extraction Logic
**Time**: 15 minutes | **Risk**: Low | **Lines Saved**: ~12

**Subtasks**:
- [ ] 2.2.1 Move `extractCourseIdFromHref()` from gradeExtractor.js to `src/utils/canvas.js`
- [ ] 2.2.2 Update `src/student/gradeExtractor.js` to import from utils/canvas
- [ ] 2.2.3 Update `src/student/allGradesPageCustomizer.js` to use shared function (line 112)
- [ ] 2.2.4 Update `src/dashboard/cardRenderer.js` to use shared function (line 64)
- [ ] 2.2.5 Update inline extraction in `src/utils/canvas.js` getCourseId() to use shared function
- [ ] 2.2.6 Test course ID extraction across all pages

**Files Modified**: 4  
**Dependencies**: Phase 1 complete

---

### Task 2.3: Create Shared Grade Data Service Interface
**Time**: 40 minutes | **Risk**: Medium | **Lines Saved**: ~40

**Subtasks**:
- [ ] 2.3.1 Create `src/utils/enrollmentApi.js` module
- [ ] 2.3.2 Implement `fetchEnrollmentData()` function with caching
- [ ] 2.3.3 Implement `parseEnrollmentGrade()` function
- [ ] 2.3.4 Update `src/dashboard/gradeDataService.js` to use shared enrollment API
- [ ] 2.3.5 Update `src/student/allGradesPageCustomizer.js` to use shared enrollment API
- [ ] 2.3.6 Test enrollment data fetching on dashboard
- [ ] 2.3.7 Test enrollment data fetching on all-grades page
- [ ] 2.3.8 Verify caching behavior

**Files Modified**: 3 (1 new, 2 modified)  
**Dependencies**: Phase 1 complete, Task 2.2 (course ID extraction)

---

**Phase 2 Total**: ~67 lines removed, 3 new utility modules created

---

## Phase 3: Structural Improvements (Priority 3)
**Estimated Time**: 2 hours | **Risk**: Medium | **Impact**: High

### Task 3.1: Standardize Grade Display Value Calculation
**Time**: 60 minutes | **Risk**: Medium | **Lines Saved**: ~60

**Subtasks**:
- [ ] 3.1.1 Design `calculateDisplayValues()` function signature
- [ ] 3.1.2 Implement in `src/utils/gradeFormatting.js`
- [ ] 3.1.3 Add comprehensive JSDoc documentation
- [ ] 3.1.4 Update `src/dashboard/cardRenderer.js` display logic (lines 146-175)
- [ ] 3.1.5 Update `src/student/allGradesPageCustomizer.js` display logic (lines 244-266)
- [ ] 3.1.6 Update `src/student/gradePageCustomizer.js` display logic (lines 105-125)
- [ ] 3.1.7 Test all display scenarios (standards-based, traditional, with/without letter grades)
- [ ] 3.1.8 Visual regression testing

**Files Modified**: 4 (1 modified from Phase 1, 3 modified)
**Dependencies**: Phase 1 & 2 complete

---

### Task 3.2: Consolidate DOM Extraction Patterns
**Time**: 50 minutes | **Risk**: Medium | **Lines Saved**: ~50

**Subtasks**:
- [ ] 3.2.1 Create `src/utils/domExtractors.js` module
- [ ] 3.2.2 Implement `extractCourseLinks()` function
- [ ] 3.2.3 Implement `findGradeElement()` function
- [ ] 3.2.4 Implement `extractCourseData()` function
- [ ] 3.2.5 Update `src/student/allGradesPageCustomizer.js` extractCoursesFromDOM() (lines 90-144)
- [ ] 3.2.6 Update `src/dashboard/cardRenderer.js` findCourseCard() to use shared extractors
- [ ] 3.2.7 Test DOM extraction on all-grades page
- [ ] 3.2.8 Test DOM extraction on dashboard

**Files Modified**: 3 (1 new, 2 modified)
**Dependencies**: Phase 1 & 2 complete

---

**Phase 3 Total**: ~110 lines removed, consistent display logic across all modules

---

## Phase 4: Polish (Priority 4)
**Estimated Time**: 2.5 hours | **Risk**: Low | **Impact**: Medium

### Task 4.1: Extract CSS Injection Logic
**Time**: 20 minutes | **Risk**: Low | **Lines Saved**: ~25

**Subtasks**:
- [ ] 4.1.1 Add `injectStyles()` function to `src/utils/dom.js`
- [ ] 4.1.2 Support style ID parameter for duplicate prevention
- [ ] 4.1.3 Update `src/student/gradePageCustomizer.js` injectCSS() (lines 41-62)
- [ ] 4.1.4 Update `src/student/allGradesPageCustomizer.js` injectHideTableCSS() (lines 37-59)
- [ ] 4.1.5 Test CSS injection on single course page
- [ ] 4.1.6 Test CSS injection on all-grades page
- [ ] 4.1.7 Verify no duplicate style tags

**Files Modified**: 3 (1 modified from Phase 1, 2 modified)
**Dependencies**: Phase 1 complete

---

### Task 4.2: Consolidate Table Creation Logic
**Time**: 45 minutes | **Risk**: Medium | **Lines Saved**: ~80

**Subtasks**:
- [ ] 4.2.1 Create `src/student/tableBuilder.js` module
- [ ] 4.2.2 Implement `createCanvasStyledTable()` function
- [ ] 4.2.3 Implement `createTableRow()` helper
- [ ] 4.2.4 Implement `createTableCell()` helper
- [ ] 4.2.5 Update `src/student/gradePageCustomizer.js` createGradesTable() (lines 131-195)
- [ ] 4.2.6 Update `src/student/allGradesPageCustomizer.js` createGradesTable() (lines 356-429)
- [ ] 4.2.7 Test table rendering on single course page
- [ ] 4.2.8 Test table rendering on all-grades page
- [ ] 4.2.9 Visual regression testing for table styling

**Files Modified**: 3 (1 new, 2 modified)
**Dependencies**: Phase 1 & 3 complete (display value calculation)

---

### Task 4.3: Improve Logging Consistency
**Time**: 35 minutes | **Risk**: Low | **Lines Saved**: ~0 (quality improvement)

**Subtasks**:
- [ ] 4.3.1 Add `createModuleLogger()` factory to `src/utils/logger.js`
- [ ] 4.3.2 Update `src/dashboard/gradeDisplay.js` to use module logger
- [ ] 4.3.3 Update `src/dashboard/cardRenderer.js` to use module logger
- [ ] 4.3.4 Update `src/dashboard/gradeDataService.js` to use module logger
- [ ] 4.3.5 Update `src/student/studentGradeCustomization.js` to use module logger
- [ ] 4.3.6 Update `src/student/gradePageCustomizer.js` to use module logger
- [ ] 4.3.7 Update `src/student/allGradesPageCustomizer.js` to use module logger
- [ ] 4.3.8 Update `src/student/gradeExtractor.js` to use module logger
- [ ] 4.3.9 Update `src/student/gradeNormalizer.js` to use module logger
- [ ] 4.3.10 Update `src/student/cleanupObserver.js` to use module logger
- [ ] 4.3.11 Test logging output format
- [ ] 4.3.12 Verify log filtering by module prefix

**Files Modified**: 11 (1 modified, 10 modified)
**Dependencies**: None (can be done anytime)

---

### Task 4.4: Extract MutationObserver Patterns
**Time**: 30 minutes | **Risk**: Low | **Lines Saved**: ~40

**Subtasks**:
- [ ] 4.4.1 Add `createAutoDisconnectObserver()` to `src/utils/dom.js`
- [ ] 4.4.2 Support custom timeout parameter
- [ ] 4.4.3 Support custom observer config
- [ ] 4.4.4 Update `src/student/cleanupObserver.js` observer setup (lines 73-84)
- [ ] 4.4.5 Update `src/student/gradePageCustomizer.js` observer setup (lines 218-232)
- [ ] 4.4.6 Update `src/student/allGradesPageCustomizer.js` observer setup (lines 514-531)
- [ ] 4.4.7 Update `src/dashboard/gradeDisplay.js` observer setup (lines 295-318)
- [ ] 4.4.8 Test observer auto-disconnect behavior
- [ ] 4.4.9 Verify no memory leaks

**Files Modified**: 5 (1 modified from Phase 1, 4 modified)
**Dependencies**: Phase 1 complete

---

**Phase 4 Total**: ~145 lines removed, improved code organization and consistency

---

## Phase 5: Future Improvements (Not Estimated)

### Task 5.1: TypeScript Migration
**Time**: TBD | **Risk**: High | **Impact**: Very High

**Subtasks**:
- [ ] 5.1.1 Research TypeScript setup for userscript environment
- [ ] 5.1.2 Add TypeScript configuration (tsconfig.json)
- [ ] 5.1.3 Add type definitions for Canvas ENV object
- [ ] 5.1.4 Add type definitions for Canvas API responses
- [ ] 5.1.5 Convert `src/utils/` modules to TypeScript
- [ ] 5.1.6 Convert `src/dashboard/` modules to TypeScript
- [ ] 5.1.7 Convert `src/student/` modules to TypeScript
- [ ] 5.1.8 Set up build pipeline for TypeScript compilation
- [ ] 5.1.9 Add type checking to CI/CD
- [ ] 5.1.10 Update documentation for TypeScript usage

**Files Modified**: All files + build configuration
**Dependencies**: All phases complete

**Benefits**:
- Catch type errors at compile time
- Better IDE autocomplete and refactoring
- Self-documenting code through types
- Easier to maintain as codebase grows

---

### Task 5.2: Add ESLint Rules for Code Quality
**Time**: TBD | **Risk**: Low | **Impact**: Medium

**Subtasks**:
- [ ] 5.2.1 Install ESLint and relevant plugins
- [ ] 5.2.2 Configure .eslintrc.js with rules
- [ ] 5.2.3 Add rule: no-duplicate-code (using eslint-plugin-sonarjs)
- [ ] 5.2.4 Add rule: max-lines-per-function
- [ ] 5.2.5 Add rule: complexity limits
- [ ] 5.2.6 Add rule: prefer-const
- [ ] 5.2.7 Add rule: no-var
- [ ] 5.2.8 Add custom rule: require-jsdoc for exported functions
- [ ] 5.2.9 Fix all existing violations
- [ ] 5.2.10 Add ESLint to pre-commit hooks
- [ ] 5.2.11 Add ESLint to CI/CD pipeline

**Files Modified**: Configuration files + all source files
**Dependencies**: None (can be done anytime)

**Benefits**:
- Automatically detect code duplication
- Enforce consistent code style
- Catch common mistakes
- Improve code quality over time

---

### Task 5.3: Add Unit Tests
**Time**: TBD | **Risk**: Low | **Impact**: High

**Subtasks**:
- [ ] 5.3.1 Choose testing framework (Jest, Vitest, etc.)
- [ ] 5.3.2 Set up test environment
- [ ] 5.3.3 Add tests for `src/utils/gradeFormatting.js`
- [ ] 5.3.4 Add tests for `src/utils/pageDetection.js`
- [ ] 5.3.5 Add tests for `src/utils/courseDetection.js`
- [ ] 5.3.6 Add tests for `src/utils/canvas.js`
- [ ] 5.3.7 Add tests for `src/utils/enrollmentApi.js`
- [ ] 5.3.8 Add tests for `src/dashboard/` modules
- [ ] 5.3.9 Add tests for `src/student/` modules
- [ ] 5.3.10 Set up code coverage reporting
- [ ] 5.3.11 Add tests to CI/CD pipeline
- [ ] 5.3.12 Aim for >80% code coverage

**Files Modified**: New test files + test configuration
**Dependencies**: All phases complete

**Benefits**:
- Catch regressions early
- Safe refactoring
- Documentation through tests
- Confidence in changes

---

### Task 5.4: Add Integration Tests
**Time**: TBD | **Risk**: Medium | **Impact**: High

**Subtasks**:
- [ ] 5.4.1 Set up Playwright or Puppeteer for browser testing
- [ ] 5.4.2 Create mock Canvas environment
- [ ] 5.4.3 Add test: Dashboard grade display
- [ ] 5.4.4 Add test: All-grades page hybrid view
- [ ] 5.4.5 Add test: Single course grades page
- [ ] 5.4.6 Add test: Cleanup observer behavior
- [ ] 5.4.7 Add test: Standards-based course detection
- [ ] 5.4.8 Add visual regression tests
- [ ] 5.4.9 Add performance tests
- [ ] 5.4.10 Add tests to CI/CD pipeline

**Files Modified**: New test files + test configuration
**Dependencies**: Task 5.3 complete

**Benefits**:
- Test real user workflows
- Catch UI regressions
- Verify Canvas integration
- Confidence in deployments

---

## Summary

### Total Impact (Phases 1-4)
- **Time**: ~8 hours
- **Lines Removed**: ~355 lines (82% reduction in duplication)
- **New Utilities**: 6-8 new shared modules
- **Files Modified**: ~15 files
- **Risk Level**: Low-Medium

### Completion Tracking
- [ ] **Phase 1**: Quick Wins (1.5 hours) - **IN PROGRESS**
- [ ] **Phase 2**: Medium Improvements (2 hours)
- [ ] **Phase 3**: Structural Improvements (2 hours)
- [ ] **Phase 4**: Polish (2.5 hours)
- [ ] **Phase 5**: Future Improvements (TBD)

### Testing Gates
- [ ] Phase 1 complete → Manual testing in Canvas before Phase 2
- [ ] Phase 2 complete → Manual testing in Canvas before Phase 3
- [ ] Phase 3 complete → Manual testing + visual regression before Phase 4
- [ ] Phase 4 complete → Full regression testing before deployment

---

**Next Action**: Begin Phase 1 implementation (Tasks 1.1 through 1.5)


