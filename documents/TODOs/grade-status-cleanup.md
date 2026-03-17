# TODO: Grade Status & Update Flow Cleanup

Created: 2026-03-17
Relates to: `src/gradebook/stateHandlers.js`, `src/services/unifiedGraphQLGrading.js`, `src/config.js`

---

## Background

A quick fix was added to `handleUpdatingGrades` to clear custom grade statuses when
`ENABLE_GRADE_CUSTOM_STATUS=false`. This works but embeds cleanup logic inside the wrong
state and reveals deeper coupling issues between several features that currently share flags
and code paths. This document tracks the proper refactor.

---

## Items

### 1. Move status clearing to its own state
**Current:** Status clearing is embedded at the top of `UPDATING_GRADES`.
**Problem:** `UPDATING_GRADES` is responsible for score updates, not status management. Mixing
them makes both harder to test and reason about.
**Fix:** Add a dedicated `CLEARING_STATUSES` state to the state machine with proper transitions:
- `CHECKING_SETUP` → `CLEARING_STATUSES` (when `!ENABLE_GRADE_CUSTOM_STATUS` and statuses exist)
- `CLEARING_STATUSES` → `CALCULATING`
This makes the flow explicit and observable in state history.

---

### 2. Decouple IE zero detection from custom status application
**Current:** `calculateStudentAveragesWithIE` determines both the zero-count IE action AND
whether custom status should be applied. Both behaviors activate on the same flag
(`ENABLE_GRADE_CUSTOM_STATUS` → `USE_UNIFIED_GRAPHQL_ONLY` → IE-aware calculation).
**Problem:** A course may want zero-score IE detection (show "Insufficient Evidence" display)
without using Canvas custom grade statuses, or vice versa. There is no way to configure this
independently today.
**Fix:** Separate into independent flags:
- `ENABLE_IE_ZERO_DETECTION` — controls whether zero scores trigger IE calculation path
- `ENABLE_CUSTOM_STATUS_APPLICATION` — controls whether Canvas custom status ID is written
- `ENABLE_GRADE_CUSTOM_STATUS` remains as a convenience that sets both to true

---

### 3. `USE_UNIFIED_GRAPHQL_ONLY` hidden coupling
**Current:** `USE_UNIFIED_GRAPHQL_ONLY` defaults to `ENABLE_GRADE_CUSTOM_STATUS ?? false`,
meaning turning off grade status silently switches the entire update pipeline back to REST bulk.
**Problem:** The REST bulk path ignores status entirely, so turning off the status flag does
NOT clear existing statuses — it just stops applying new ones. This was patched by the quick
fix but the underlying coupling remains.
**Fix:** Make `USE_UNIFIED_GRAPHQL_ONLY` a fully independent flag with its own default.
Consider defaulting it to `true` after validating the GraphQL path is stable across all
course types (see item 5 below).

---

### 4. Add `CLEAR_CUSTOM_STATUS_ON_DISABLE` as a first-class config option
**Current:** Status clearing is a side effect of `ENABLE_GRADE_CUSTOM_STATUS=false` combined
with the quick-fix block.
**Fix:** Explicit flag `CLEAR_CUSTOM_STATUS_ON_DISABLE: true` that controls whether the
clearing block runs. This makes the behavior intentional and discoverable rather than implicit.

---

### 5. Validate GraphQL path stability before making it the default
Before defaulting `USE_UNIFIED_GRAPHQL_ONLY=true` for all courses:
- Verify `calculateStudentAveragesWithIE` produces identical results to `calculateStudentAverages`
  for courses with no zero scores
- Verify performance is acceptable for large courses (>100 students) — GraphQL is per-student
  sequential vs REST bulk being a single API call
- Verify `ENABLE_GRADE_OVERRIDE=true` courses are handled correctly in the IE-aware path
  (override grade drift check differs between the two calculation functions)

---

### 6. REST bulk path status coverage — RESOLVED by quick fix
~~REST bulk path users had no status cleanup when `ENABLE_GRADE_CUSTOM_STATUS=false`.~~
**Fixed:** The quick-fix block in `handleUpdatingGrades` runs before the GraphQL/bulk branch,
so both paths now clear statuses. Remaining work is moving this to a proper state (item 1).

---

## Related Files
- `src/gradebook/stateHandlers.js` — quick fix lives here (search `QUICK FIX`)
- `src/gradebook/stateMachine.js` — add `CLEARING_STATUSES` state and transitions
- `src/services/unifiedGraphQLGrading.js` — `submitUnifiedGrade`, status ID logic
- `src/services/gradeCalculator.js` — `calculateStudentAveragesWithIE` vs `calculateStudentAverages`
- `src/config.js` — all feature flags

