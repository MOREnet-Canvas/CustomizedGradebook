# Phase 0 - API Validation Tests

This folder contains console test scripts to validate Canvas API endpoints before implementing the Outcomes Dashboard module.

## Purpose

These tests discover API response formats and verify that the necessary Canvas APIs are available and working in your Canvas instance.

## Prerequisites

- Navigate to any Canvas course page as a **teacher or admin**
- Open browser Developer Tools console (`F12` → Console tab)
- Have a course with:
  - At least 1 student enrollment
  - At least 1 learning outcome created
  - At least 1 assignment with rubric aligned to an outcome
  - At least 1 student with a score on that assignment

## Test Sequence

Run tests in this order:

1. **Test 1: Unpublished Page Access** (`01_testUnpublishedPageAccess.md`)
   - Manual test in Canvas UI
   - Verifies teachers can access unpublished pages

2. **Test 2: Outcomes API** (`02_testOutcomesAPI.console.js`)
   - Console script
   - Tests: Outcome Groups, Outcome Rollups, Linked Data

3. **Test 3: Outcome Results API** (`03_testOutcomeResultsAPI.console.js`)
   - Console script
   - Tests: Outcome Results with submission details

4. **Test 4: Outcome Groups API** (`04_testOutcomeGroupsAPI.console.js`)
   - Console script (optional but recommended)
   - Tests: Fetching outcome names and metadata

## Success Criteria

All tests should:
- ✅ Return 200 OK responses
- ✅ Show properly formatted JSON data
- ✅ Include expected fields (documented in each test)
- ✅ No 401/403/404 errors

## Results

Document any issues or unexpected response formats in the main Outcomes Dashboard README.
