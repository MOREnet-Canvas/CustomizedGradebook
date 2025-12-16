# Phase 3: Separate API Layer + 3-Layer Refactoring

## Overview
Eliminate `updateFlow.js` by splitting it into clean layers: UI, Orchestration, and Services.

## Goals
- ✅ Clean 3-layer architecture
- ✅ No circular dependencies
- ✅ Single responsibility per file
- ✅ All files under 250 lines
- ✅ Eliminate `updateFlow.js` completely

## Constraints
- ❌ Do NOT change business logic
- ✅ Preserve all existing functionality
- ✅ Keep all tests passing
- ✅ Maintain backward compatibility (unless it muddies logic)

---

## Task Breakdown

### **Task 1: Create Service Layer Files**

#### 1.1 Create `src/services/canvasOutcomes.js`
**Functions to move from `updateFlow.js`:**
- `getRollup(courseId)` - Fetches outcome rollup data
- `getOutcomeObjectByName(data)` - Finds outcome by name in rollup data
- `createOutcome(courseId)` - Creates new outcome via Canvas API

**Dependencies:**
- `safeFetch`, `safeJsonParse` from `utils/errorHandler.js`
- `getTokenCookie` from `utils/canvas.js`
- `AVG_OUTCOME_NAME`, `DEFAULT_MAX_POINTS`, `DEFAULT_MASTERY_THRESHOLD`, `OUTCOME_AND_RUBRIC_RATINGS` from `config.js`
- `logger` from `utils/logger.js`

**Estimated lines:** ~120

---

#### 1.2 Create `src/services/canvasAssignments.js`
**Functions to move from `updateFlow.js`:**
- `getAssignmentObjectFromOutcomeObj(courseId, outcomeObject)` - Finds assignment from outcome alignments
- `createAssignment(courseId)` - Creates new assignment via Canvas API

**Dependencies:**
- `safeFetch`, `safeJsonParse` from `utils/errorHandler.js`
- `getTokenCookie` from `utils/canvas.js`
- `AVG_ASSIGNMENT_NAME`, `DEFAULT_MAX_POINTS` from `config.js`
- `logger` from `utils/logger.js`

**Estimated lines:** ~80

---

#### 1.3 Create `src/services/canvasRubrics.js`
**Functions to move from `updateFlow.js`:**
- `getRubricForAssignment(courseId, assignmentId)` - Fetches rubric for assignment
- `createRubric(courseId, assignmentId, outcomeId)` - Creates new rubric via Canvas API

**Dependencies:**
- `safeFetch`, `safeJsonParse` from `utils/errorHandler.js`
- `getTokenCookie` from `utils/canvas.js`
- `AVG_RUBRIC_NAME`, `OUTCOME_AND_RUBRIC_RATINGS` from `config.js`
- `logger` from `utils/logger.js`

**Estimated lines:** ~100

---

### **Task 2: Create UI Layer Files**

#### 2.1 Create `src/gradebook/ui/buttonInjection.js`
**Functions to move from `updateFlow.js`:**
- `injectButtons()` - Main entry point for UI injection
- `waitForGradebookAndToolbar(callback)` - Waits for Canvas DOM
- `checkForResumableState(courseId, button)` - Checks localStorage and updates button
- `resetButtonToNormal(button)` - Resets button appearance

**Dependencies:**
- `makeButton`, `createButtonColumnContainer` from `ui/buttons.js`
- `showFloatingBanner` from `ui/banner.js`
- `getCourseId`, `getTokenCookie` from `utils/canvas.js`
- `UPDATE_AVG_BUTTON_LABEL` from `config.js`
- `logger` from `utils/logger.js`
- `startUpdateFlow` from `gradebook/updateFlowOrchestrator.js` (new file)
- `UpdateFlowStateMachine`, `STATES` from `gradebook/stateMachine.js`

**Estimated lines:** ~150

---

#### 2.2 Create `src/gradebook/ui/debugPanel.js`
**Functions to move from `updateFlow.js`:**
- `updateDebugUI(stateMachine)` - Creates/updates debug panel
- `removeDebugUI()` - Removes debug panel

**Dependencies:**
- `logger` from `utils/logger.js`

**Estimated lines:** ~80

---

### **Task 3: Simplify Orchestration Layer**

#### 3.1 Rename and simplify `updateFlow.js`
**Actions:**
1. Rename `src/gradebook/updateFlow.js` → `src/gradebook/updateFlowOrchestrator.js`
2. Remove all functions except `startUpdateFlow(button)`
3. Update imports to use new service files
4. Export `startUpdateFlow` as the only export

**Dependencies:**
- `UpdateFlowStateMachine`, `STATES` from `./stateMachine.js`
- `STATE_HANDLERS` from `./stateHandlers.js`
- `showFloatingBanner` from `../ui/banner.js`
- `updateDebugUI`, `removeDebugUI` from `./ui/debugPanel.js`
- `resetButtonToNormal` from `./ui/buttonInjection.js`
- `handleError` from `../utils/errorHandler.js`
- `logger` from `../utils/logger.js`

**Estimated lines:** ~120

---

### **Task 4: Update Imports in Existing Files**

#### 4.1 Update `src/gradebook/stateHandlers.js`
**Change imports from:**
```javascript
import {
    getRollup,
    getOutcomeObjectByName,
    getAssignmentObjectFromOutcomeObj,
    createOutcome,
    createAssignment,
    createRubric,
    getRubricForAssignment
} from "./updateFlow.js";
```

**To:**
```javascript
import { getRollup, getOutcomeObjectByName, createOutcome } from "../services/canvasOutcomes.js";
import { getAssignmentObjectFromOutcomeObj, createAssignment } from "../services/canvasAssignments.js";
import { getRubricForAssignment, createRubric } from "../services/canvasRubrics.js";
```

---

#### 4.2 Update `src/main.js`
**Change import from:**
```javascript
import { injectButtons } from "./gradebook/updateFlow.js";
```

**To:**
```javascript
import { injectButtons } from "./gradebook/ui/buttonInjection.js";
```

---

### **Task 5: Testing & Validation**

#### 5.1 Run unit tests
```bash
npm test
```
**Expected:** All 20 tests pass

#### 5.2 Build and test in Canvas
```bash
npm run build:dev
```

**Manual testing checklist:**
- [ ] Button appears in gradebook toolbar
- [ ] Click "Update Average" starts update flow
- [ ] State machine progresses through states correctly
- [ ] Debug panel appears in bottom-right (with `?debug=true`)
- [ ] Debug panel updates as states change
- [ ] Resume feature works after page reload
- [ ] Button resets to normal after completion
- [ ] Zero-updates case works correctly
- [ ] Error handling works correctly

---

## Execution Order

1. ✅ Create service layer files (Tasks 1.1, 1.2, 1.3)
2. ✅ Create UI layer files (Tasks 2.1, 2.2)
3. ✅ Update stateHandlers.js imports (Task 4.1)
4. ✅ Rename and simplify updateFlow.js → updateFlowOrchestrator.js (Task 3.1)
5. ✅ Update main.js import (Task 4.2)
6. ✅ Run tests (Task 5.1)
7. ✅ Build and manual test (Task 5.2)

---

## Success Criteria

- ✅ All unit tests pass
- ✅ Build completes without errors
- ✅ All functionality works in Canvas
- ✅ No circular dependencies
- ✅ Each file has single responsibility
- ✅ All files under 250 lines
- ✅ `updateFlow.js` no longer exists
- ✅ Clean 3-layer architecture achieved

---

## Rollback Plan

If something goes wrong:
1. Git checkout to previous commit
2. Identify the issue
3. Fix incrementally
4. Re-test

**Note:** Make a git commit before starting Phase 3!

