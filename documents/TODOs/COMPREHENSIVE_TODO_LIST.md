# Comprehensive TODO List - CustomizedGradebook

**Last Updated:** 2026-03-06

---

## 📋 Recently Completed

- ✅ **#3: Fix SpeedGrader Unnecessary API Calls** - Caching implemented
- ✅ **#8: Eliminate updateFlow.js** - Refactored into layered architecture

---

## 🔴 PHASE 1: Critical Issues (Immediate Priority)

### 1. Fix Observer Grades Page
**Priority:** HIGH  
**Status:** Open  
**Impact:** Page errors on certain views

**Issue:**
- Course ID not found error on certain pages
- Need role and page check before course ID extraction

**Action Items:**
- [ ] Add role validation before course ID extraction
- [ ] Add page type detection
- [ ] Test on all grade-related pages

---

### 2. Fix Grade Display Consistency Issue
**Priority:** HIGH  
**Status:** Open  
**Impact:** Inconsistent student/teacher grade display

**Issue:**
- Student page: Shows `1.79 (1.79)` or just `1.79`
- Teacher page: Shows `1.79 (Beginning)`
- Root cause: Canvas returns numeric letter grades, handled differently

**Files Involved:**
- `src/utils/gradeFormatting.js`
- `src/teacher/teacherStudentGradeCustomizer.js`
- `src/services/courseSnapshotService.js`
- `src/student/gradeExtractor.js`

**Action Items:**
- [ ] Modify `calculateDisplayValue()` to calculate letter grades from scores consistently
- [ ] Test with courses that have/don't have grading schemes
- [ ] Verify consistency across student page, teacher page, dashboard, all-grades page

**Reference:** `documents/TODOs/todo - Grade Display Consistency Issue.md`

---

### 3. Fix All-Grades Page Double Processing
**Priority:** MEDIUM-HIGH  
**Status:** Open (Identified 2026-03-06)  
**Impact:** Duplicate processing, confusing logs, CPU/memory waste

**Issue:**
- All-grades page customizer executes twice
- Race condition between immediate call and observer-triggered call
- `processed` flag checked before it's set

**Files Involved:**
- `src/student/allGradesPageCustomizer.js` (lines 388-408)

**Recommended Solution:**
Move `processed = true` to very beginning of `applyCustomizations()` before any async work (Option A)

**Action Items:**
- [ ] Implement Option A: Set flag before async work
- [ ] Test with DevTools closed (multiple refreshes)
- [ ] Test with DevTools console open
- [ ] Test with slow network (throttle to "Slow 3G")
- [ ] Verify no regressions on lazy-loaded content

**Reference:** `documents/TODOs/ALLGRADES_DOUBLE_PROCESSING.md`

---

## 🟠 PHASE 2: Performance & Optimization

### 4. Dashboard Performance Optimization
**Priority:** MEDIUM  
**Status:** Open  
**Target:** <1 second for 10 courses (currently 1-3 seconds)

**Quick Wins:**
- [ ] Run performance benchmark: `await window.CG.testConcurrentPerformance()`
- [ ] Document current metrics (courses, total time, avg per course)
- [ ] Test with different user accounts

**Easy Optimizations:**
- [ ] Increase `CONCURRENT_WORKERS` from 3 to 5-8 in `src/dashboard/gradeDisplay.js:48`
- [ ] Test each level and measure performance
- [ ] Monitor Canvas API rate limits (3000 requests/hour)
- [ ] Document optimal concurrency level

**Medium Effort:**
- [ ] Implement progressive/lazy rendering (render badges as processed)
- [ ] Add loading indicators to dashboard cards
- [ ] Prioritize visible cards first (viewport detection)
- [ ] Use `requestAnimationFrame` for smoother rendering
- [ ] Batch DOM updates using `DocumentFragment`
- [ ] Cache hero color calculations
- [ ] Reduce DOM queries in `cardRenderer.js`

**Advanced:**
- [ ] Investigate bulk data fetching in `populateCourseSnapshot()`
- [ ] Review course snapshot cache effectiveness
- [ ] Consider Intersection Observer for lazy badge loading

**Reference:** `documents/TODOs/todo-dashboard-performance.md`

---

### 5. Audit Pagination Issues
**Priority:** MEDIUM  
**Status:** Partially complete (CanvasApiClient.getAllPages() implemented)

**Action Items:**
- [ ] Review `outcomeService.js` - `getRollup()` for >100 students
- [ ] Check other endpoints that fetch lists for pagination bugs
- [ ] Ensure all use `CanvasApiClient.getAllPages()` where needed
- [ ] Document any endpoints that need pagination fixes

**Reference:** `documents/TODOs/TODO-refactor-accountSettingsPanel.md` (Phase 3.4)

---

## 🟡 PHASE 3: Code Refactoring & Architecture

### 6. Refactor Loader Generator Panel
**Priority:** MEDIUM  
**Status:** Open  
**Current:** 1700+ lines, renders 4 panels from single function

**Goal:** Split into 4 separate modules

**Action Items:**
- [ ] Extract `createVersionSelector()` → `versionSelectorPanel.js`
  - Export `renderVersionSelectorPanel(container)`
  - Return `{ versionDropdown }` for use by generator
- [ ] Extract `createConfigurationPanel()` → `configurationSettingsPanel.js`
  - Export `renderConfigurationSettingsPanel(container)`
  - Return `{ controls }` for use by generator
- [ ] Update `gradingSchemesPanel.js` to be called directly from `dashboardShell.js`
- [ ] Refactor `loaderGeneratorPanel.js` to focus only on loader generation
  - Accept `versionDropdown` and `controls` as parameters
  - Remove version selector and configuration panel code
- [ ] Update `dashboardShell.js` to call each panel separately
- [ ] Test all panels maintain current behavior
- [ ] Verify sticky action panel and change notification still work
- [ ] Verify auto-load functionality preserved

**Benefits:**
- Each panel independent and reorderable
- Smaller, focused modules
- Visual panel order matches code structure
- Easier to test individual panels

**Reference:** `documents/TODOs/TODO-refactor-loaderGeneratorPanel.md`

---

### 7. Further Modularize Grading Schemes Panel (Optional)
**Priority:** LOW
**Status:** Phase 1 Complete (93% reduction from 1,901 to 133 lines)
**Phase 2:** Optional code organization

**Current State:**
- ✅ accountSettingsPanel.js: 133 lines (Final Grade Override only)
- ✅ gradingSchemesPanel.js: 1,594 lines (All grading schemes functionality)
- ✅ Critical pagination bugs fixed

**Optional Phase 2 Actions:**
- [ ] Extract HTML templates to `gradingSchemeTemplates.js` (~400 lines)
  - `generateGradingSchemesHTML()` (~220 lines)
  - `generateGradingSchemeExamplesHTML()` (~360 lines)
  - Deduplicate ~40% shared CSS/structure
- [ ] Extract modal editor to `gradingSchemeEditor.js` (~480 lines)
  - `openGradingSchemeEditor()` as standalone component
- [ ] Refactor `fetchGradingSchemes()` to use `CanvasApiClient.getAllPages()` (currently uses manual pagination)
- [ ] Consolidate `parseLinkHeader()` duplicates across files

**Reference:** `documents/TODOs/TODO-refactor-accountSettingsPanel.md`

---

## 🟢 PHASE 4: Features & Enhancements

### 8. CBE Course Button Visibility
**Priority:** LOW
**Status:** Open

**Action Items:**
- [ ] Make button appear for CBE courses on both gradebook pages
- [ ] Test on CBE course types
- [ ] Verify button functionality

---

### 9. Assignment Checks & Validation
**Priority:** LOW
**Status:** Open

**Action Items:**
- [ ] Check if mastery refresh has been done
- [ ] Check if points possible set to 0
- [ ] Check what grading scheme assignments are using
- [ ] Verify all assignments use same grading scheme
- [ ] Add choices for current assignment configuration with suggestions
- [ ] Create dedicated assignment group for current score assignment
- [ ] Push current score assignment to bottom of assignment list

---

### 10. Investigate Remote CSS Strategy
**Priority:** LOW
**Status:** Open
**Goal:** Reduce uploaded `css_loader.css` file size

**Phase 1: Assess Current State**
- [ ] Confirm current size of `css_loader.css`
- [ ] Identify styles strictly required locally
- [ ] Identify dashboard-only styles safe to move remote
- [ ] Confirm no critical Canvas overrides depend on local-only loading

**Phase 2: Prepare Remote Hosting**
- [ ] Choose hosting location (GitHub Pages/Render/S3)
- [ ] Upload full dashboard CSS as `cg-admin-dashboard.css`
- [ ] Verify HTTPS and correct MIME type
- [ ] Add versioned file naming strategy (e.g., `cg-admin-dashboard.v1.2.0.css`)

**Phase 3: Verify Canvas CSP Compatibility**
- [ ] Check Account Settings → Security → CSP allowed domains
- [ ] Add remote domain if necessary
- [ ] Confirm no CSP violations in browser console
- [ ] Test in root account, sub-account, gradebook, theme editor preview

**Phase 4: Implement Remote Loader**
- [ ] Replace uploaded CSS with `@import url("https://yourdomain.com/cg-admin-dashboard.v1.2.0.css");`
- [ ] Confirm dashboard styles load correctly
- [ ] Test sticky panel, header styles
- [ ] Test in incognito and slow network

**Phase 5: Stability & Fallback**
- [ ] Decide on minimal local fallback style block
- [ ] Determine rollback strategy if remote CSS fails
- [ ] Document process for admins
- [ ] Document hosting update procedure

**Reference:** `documents/TODOs/TODO – Investigate Remote CSS Strategy for CG Dashboard.md`

---

### 11. Mobile Mastery Dashboard Functionality
**Priority:** LOW
**Status:** Placeholder
**Scope:** Broad, details to be determined

**Action Items:**
- [ ] Define feature requirements
- [ ] Design mobile-responsive UI
- [ ] Implement mobile mastery dashboard features
- [ ] Test on various mobile devices

---

## 🔵 PHASE 5: Infrastructure & Admin

### 12. Move Admin Dashboard to External Location
**Priority:** MEDIUM
**Status:** Planning phase
**Goal:** Migrate admin dashboard to external authenticated platform

**Action Items:**
- [ ] Evaluate external platforms (Google Workspace, etc.)
- [ ] Design authentication flow for admin users
- [ ] Implement remote settings management
- [ ] Create loader file download mechanism
- [ ] Migrate existing admin dashboard functionality
- [ ] Test admin login and settings changes
- [ ] Document admin access procedures

---

### 13. Remote Settings Configuration
**Priority:** MEDIUM
**Status:** Planning phase
**Goal:** Host settings as public JSONs on GitHub

**Action Items:**
- [ ] Design settings JSON schema
- [ ] Create GitHub repository/folder structure for settings
- [ ] Implement settings fetch mechanism in loader
- [ ] Add versioning strategy for settings
- [ ] Add fallback for settings fetch failures
- [ ] Update loader to use remote settings
- [ ] Document settings update workflow
- [ ] Test settings propagation to all users

---

## 📝 PHASE 6: Documentation & Cleanup

### 14. Documentation Improvements
**Priority:** LOW
**Status:** Open

**Action Items:**
- [ ] Write deployment how-tos and explanations
- [ ] Document `localStorage.cg_logLevel` usage
- [ ] Document other localStorage settings
- [ ] Create admin guide updates
- [ ] Document performance tuning guide

**Reference:** `documents/TODOs/documentation_wants.md`

---

### 15. Logging Strategy & Cleanup
**Priority:** LOW
**Status:** Open

**Action Items:**
- [ ] Write out "production" logging strategy
- [ ] Add session key for debug mode
- [ ] Review log levels in production builds
- [ ] Consider default log level to INFO or WARN
- [ ] Remove trace/debug logs from hot paths
- [ ] General debugging cleanup

---

### 16. Remove Legacy Code
**Priority:** LOW
**Status:** Ongoing

**Completed:**
- ✅ canvasHelpers.js removed
- ✅ Current score references cleaned up

**Action Items:**
- [ ] Audit codebase for outdated code
- [ ] Remove unused functions and modules
- [ ] Clean up commented-out code
- [ ] Update imports and dependencies

---

## ⚠️ KNOWN ISSUES (Documented, Not Urgent)

### 17. Points-Based Traditional Courses Display
**Priority:** LOW (Leave as-is)
**Status:** Documented, accepted behavior
**Decision:** Leave as-is for now (works for current use case)

**Issue:**
- Script displays some traditional courses in points instead of percentage
- Works correctly for 4-point scales by coincidence
- Would fail for 5, 10, or 100-point scales
- Script doesn't read Canvas's actual grading scheme settings

**Potential Solutions (if needed later):**
- Option 1: Keep as-is (current decision)
- Option 2: Only customize standards-based courses
- Option 3: Read actual grading scheme settings from Canvas API

**Reference:** `documents/TODOs/KNOWN_ISSUE_POINTS_BASED_DISPLAY.MD`

---

### 18. Mastery Refresh Behavior
**Priority:** LOW
**Status:** Documented behavior

**Issue:**
- Mastery refresh doesn't update rubric scores
- Outcome results unchanged
- May need to stay this way

**Action Items:**
- [ ] Investigate if this is expected Canvas behavior
- [ ] Document findings

---

## 🔍 PHASE 7: Investigation Needed

### 19. Rubric Criteria Ignore for Scoring
**Priority:** LOW
**Status:** Needs investigation

**Issue:**
- Python script can set `ignore_for_scoring` and points to zero
- Still submits score successfully
- Unclear why this script can't add grade to assignment but can to outcome
- Rubric assessment exists but looks blank in UI

**Action Items:**
- [ ] Investigate Canvas API behavior for `ignore_for_scoring`
- [ ] Test rubric assessment submission edge cases
- [ ] Document findings and limitations

---

### 20. Non-AVG Assignment Course Grade Page
**Priority:** LOW
**Status:** Needs investigation

**Issue:**
- When no avg_assignment exists, course grade page doesn't remove "/4"
- Incorrect display format

**Action Items:**
- [ ] Investigate grade display logic for non-AVG courses
- [ ] Fix display format
- [ ] Test with various course configurations

---

### 21. Points Classes Default Behavior
**Priority:** LOW
**Status:** Consideration

**Action Items:**
- [ ] Evaluate making points classes default to standards-based
- [ ] Assess impact on existing courses
- [ ] Implement if beneficial

---

## 💡 PHASE 8: Admin Dashboard Improvements

### 22. Admin Dashboard Feature Completions
**Priority:** LOW
**Status:** Open

**Action Items:**
- [ ] Determine rubric ratings (not yet implemented)
- [ ] Add cg_ indicator
- [ ] Add options for determining standards-based courses:
  - [ ] Name patterns
  - [ ] AVG assignment detection
  - [ ] Grading scheme detection
  - [ ] Outcomes usage detection

---

### 23. Admin Dashboard Quality Improvements
**Priority:** LOW
**Status:** Open

**Action Items:**
- [ ] Ensure no unnecessary code reproduction
- [ ] Use theme colors instead of hard-coded colors
- [ ] Create better JSON editor
- [ ] Add CSS downloader/alert functionality
- [ ] Add option to manually type in version with validation

---

## 📊 Summary by Phase

| Phase | Focus Area | Priority | Item Count |
|-------|-----------|----------|------------|
| Phase 1 | Critical Issues | HIGH | 3 items |
| Phase 2 | Performance & Optimization | MEDIUM | 2 items |
| Phase 3 | Code Refactoring | MEDIUM-LOW | 2 items |
| Phase 4 | Features & Enhancements | LOW | 4 items |
| Phase 5 | Infrastructure & Admin | MEDIUM | 2 items |
| Phase 6 | Documentation & Cleanup | LOW | 3 items |
| Phase 7 | Investigation Needed | LOW | 3 items |
| Phase 8 | Admin Dashboard | LOW | 2 items |

**Total Active Items:** 21
**Recently Completed:** 2
**Known Issues (Accepted):** 2

---

## 🎯 Recommended Execution Order

1. **Immediate (This Week):**
   - Fix Observer Grades Page (#1)
   - Fix Grade Display Consistency (#2)
   - Fix All-Grades Double Processing (#3)

2. **Short-term (This Month):**
   - Dashboard Performance Optimization (#4)
   - Audit Pagination Issues (#5)

3. **Medium-term (Next Quarter):**
   - Refactor Loader Generator Panel (#6)
   - Move Admin Dashboard to External Location (#12)
   - Remote Settings Configuration (#13)

4. **Long-term (As Needed):**
   - All Phase 4, 6, 7, 8 items
   - Optional refactoring items

---

**End of Comprehensive TODO List**