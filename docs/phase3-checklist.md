# Phase 3 Execution Checklist

## Pre-Flight Check
- [ ] Commit current work: `git add . && git commit -m "Phase 2 complete - State machine implementation"`
- [ ] Verify all tests pass: `npm test`
- [ ] Verify build works: `npm run build:dev`
- [ ] Create Phase 3 branch (optional): `git checkout -b phase3-api-layer`

---

## Step 1: Create Service Layer (3 files)

### 1.1 Create `src/services/canvasOutcomes.js`
- [ ] Create file
- [ ] Move `getRollup()` from updateFlow.js
- [ ] Move `getOutcomeObjectByName()` from updateFlow.js
- [ ] Move `createOutcome()` from updateFlow.js
- [ ] Add all necessary imports
- [ ] Export all functions
- [ ] Verify no syntax errors

### 1.2 Create `src/services/canvasAssignments.js`
- [ ] Create file
- [ ] Move `getAssignmentObjectFromOutcomeObj()` from updateFlow.js
- [ ] Move `createAssignment()` from updateFlow.js
- [ ] Add all necessary imports
- [ ] Export all functions
- [ ] Verify no syntax errors

### 1.3 Create `src/services/canvasRubrics.js`
- [ ] Create file
- [ ] Move `getRubricForAssignment()` from updateFlow.js
- [ ] Move `createRubric()` from updateFlow.js
- [ ] Add all necessary imports
- [ ] Export all functions
- [ ] Verify no syntax errors

---

## Step 2: Create UI Layer (2 files)

### 2.1 Create `src/gradebook/ui/buttonInjection.js`
- [ ] Create file
- [ ] Move `injectButtons()` from updateFlow.js
- [ ] Move `waitForGradebookAndToolbar()` from updateFlow.js
- [ ] Move `checkForResumableState()` from updateFlow.js
- [ ] Move `resetButtonToNormal()` from updateFlow.js
- [ ] Add all necessary imports
- [ ] Export `injectButtons` and `resetButtonToNormal`
- [ ] Verify no syntax errors

### 2.2 Create `src/gradebook/ui/debugPanel.js`
- [ ] Create file
- [ ] Move `updateDebugUI()` from updateFlow.js
- [ ] Move `removeDebugUI()` from updateFlow.js
- [ ] Add all necessary imports
- [ ] Export both functions
- [ ] Verify no syntax errors

---

## Step 3: Update Existing Files

### 3.1 Update `src/gradebook/stateHandlers.js`
- [ ] Update imports to use new service files
- [ ] Remove import from `./updateFlow.js`
- [ ] Add imports from `../services/canvasOutcomes.js`
- [ ] Add imports from `../services/canvasAssignments.js`
- [ ] Add imports from `../services/canvasRubrics.js`
- [ ] Verify no syntax errors

### 3.2 Rename and simplify `src/gradebook/updateFlow.js`
- [ ] Copy `startUpdateFlow()` function to clipboard
- [ ] Create new file `src/gradebook/updateFlowOrchestrator.js`
- [ ] Paste `startUpdateFlow()` into new file
- [ ] Add necessary imports (from new files)
- [ ] Export `startUpdateFlow`
- [ ] Delete old `src/gradebook/updateFlow.js`
- [ ] Verify no syntax errors

### 3.3 Update `src/main.js`
- [ ] Change import from `./gradebook/updateFlow.js`
- [ ] To import from `./gradebook/ui/buttonInjection.js`
- [ ] Verify no syntax errors

---

## Step 4: Testing

### 4.1 Unit Tests
- [ ] Run `npm test`
- [ ] Verify all 20 tests pass
- [ ] If failures, debug and fix

### 4.2 Build
- [ ] Run `npm run build:dev`
- [ ] Verify no build errors
- [ ] Check bundle size (should be similar to before)

### 4.3 Manual Testing in Canvas
- [ ] Load Canvas gradebook page
- [ ] Verify "Update Average" button appears
- [ ] Click button and verify update flow starts
- [ ] Verify state machine progresses correctly
- [ ] Test with `?debug=true` - verify debug panel appears in bottom-right
- [ ] Reload page mid-update - verify resume feature works
- [ ] Verify button resets to normal after completion
- [ ] Test zero-updates case
- [ ] Test error handling

---

## Step 5: Verification

### 5.1 Architecture Verification
- [ ] Verify `updateFlow.js` no longer exists
- [ ] Verify all new files created:
  - [ ] `src/services/canvasOutcomes.js`
  - [ ] `src/services/canvasAssignments.js`
  - [ ] `src/services/canvasRubrics.js`
  - [ ] `src/gradebook/ui/buttonInjection.js`
  - [ ] `src/gradebook/ui/debugPanel.js`
  - [ ] `src/gradebook/updateFlowOrchestrator.js`
- [ ] Verify all files under 250 lines
- [ ] Verify no circular dependencies

### 5.2 Code Quality
- [ ] All functions have JSDoc comments
- [ ] All imports are used
- [ ] No unused code
- [ ] Consistent code style

---

## Step 6: Commit

- [ ] Stage all changes: `git add .`
- [ ] Commit: `git commit -m "Phase 3 complete - 3-layer architecture refactoring"`
- [ ] (Optional) Merge to main: `git checkout main && git merge phase3-api-layer`

---

## Rollback (if needed)

If something goes wrong:
```bash
git reset --hard HEAD~1  # Undo last commit
# OR
git checkout main  # Switch back to main branch
```

---

## Success Metrics

✅ **All tests pass**  
✅ **Build succeeds**  
✅ **All functionality works in Canvas**  
✅ **Clean 3-layer architecture**  
✅ **No circular dependencies**  
✅ **All files < 250 lines**  
✅ **`updateFlow.js` eliminated**

---

## Estimated Time

- Step 1 (Service Layer): 30-45 minutes
- Step 2 (UI Layer): 30-45 minutes
- Step 3 (Update Files): 15-30 minutes
- Step 4 (Testing): 30-45 minutes
- Step 5 (Verification): 15 minutes
- **Total: 2-3 hours**

