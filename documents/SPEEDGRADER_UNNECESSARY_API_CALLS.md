# SpeedGrader Unnecessary API Calls Issue

**Date**: 2026-02-11  
**Status**: Identified, Not Fixed  
**Severity**: Low (performance/efficiency issue, not functional)

## Problem Summary

When loading the SpeedGrader page, the script is making unnecessary API calls to determine the course type (standards-based vs traditional), even though this information should already be cached in sessionStorage from previous page loads.

## Observed API Calls

On SpeedGrader page load (`/courses/{courseId}/gradebook/speed_grader`), the following API calls are being made:

1. **Assignment Search** (200 OK):
   ```
   GET /api/v1/courses/38297/assignments?search_term=Current%20Score%20Assignment&per_page=100
   ```

2. **Submission Fetch** (404 Not Found):
   ```
   GET /api/v1/courses/38297/assignments/561827/submissions/10000?per_page=100
   ```

## Root Cause Analysis

### Call Chain

1. **SpeedGrader Score Sync** module initializes (`src/speedgrader/speedgraderScoreSync.js:887-937`)
2. Checks for course snapshot in cache (`line 914`)
3. If no snapshot exists, calls `populateCourseSnapshot()` (`line 921`)
4. `populateCourseSnapshot()` (`src/services/courseSnapshotService.js:277-330`):
   - Skips grade fetching for `teacher_like` users (correct behavior, lines 304-315)
   - **BUT** always calls `determineCourseModel()` (lines 320-325)
5. `determineCourseModel()` (`src/utils/courseDetection.js:142-178`):
   - Checks course name pattern first (no API call)
   - If name doesn't match pattern, calls `hasAvgAssignment()` (line 168)
6. `hasAvgAssignment()` (`src/utils/courseDetection.js:74-110`):
   - Makes API call to search for "Current Score Assignment"
   - This triggers the first observed API call

### Why This Shouldn't Happen

1. **Snapshot should already exist**: The course snapshot should have been populated when the user loaded the dashboard or gradebook page earlier in the session
2. **Course type is already determined**: The snapshot contains `model` and `modelReason` fields that indicate whether the course is standards-based
3. **sessionStorage should persist**: The snapshot is stored in sessionStorage with a 10-minute TTL, so it should survive page navigations within the same session

## Why Snapshot Might Not Exist

Possible reasons the snapshot doesn't exist when SpeedGrader loads:

1. **Direct navigation**: User navigated directly to SpeedGrader URL (first page load in session)
2. **Snapshot expired**: More than 10 minutes elapsed since last snapshot population
3. **Snapshot cleared**: User ownership validation failed or snapshot was manually cleared
4. **Different course**: User is viewing a different course than previously loaded

## Current Behavior

**File**: `src/speedgrader/speedgraderScoreSync.js` (lines 914-923)

```javascript
let snapshot = getCourseSnapshot(courseId);
logger.trace(`[ScoreSync] Course snapshot from cache: ${snapshot ? 'FOUND' : 'NOT FOUND'}`);

if (!snapshot) {
    logger.trace('[ScoreSync] Populating course snapshot...');
    const courseName = document.title.split(':')[0]?.trim() || 'Unknown Course';
    logger.trace(`[ScoreSync] Course name from title: "${courseName}"`);
    snapshot = await populateCourseSnapshot(courseId, courseName, apiClient);
    logger.trace(`[ScoreSync] Snapshot population result: ${snapshot ? 'SUCCESS' : 'FAILED'}`);
}
```

**File**: `src/services/courseSnapshotService.js` (lines 320-325)

```javascript
// Step 2: Classify course model (SINGLE SOURCE OF TRUTH)
// This is ALWAYS performed regardless of grade data availability
logger.trace(`[Snapshot] Step 2: Classifying course model for ${courseId}...`);
const classification = await determineCourseModel(
    { courseId, courseName },
    null,
    { apiClient }
);
```

**File**: `src/utils/courseDetection.js` (lines 167-169)

```javascript
logger.trace(`[CourseModel] Rule 2 - Checking AVG Assignment presence...`);
const hasAvg = await hasAvgAssignment(courseId, apiClient);
logger.trace(`[CourseModel] Rule 2 - AVG Assignment: ${hasAvg ? 'FOUND' : 'NOT FOUND'}`);
```

## Potential Solutions

### Option A: SpeedGrader Should Only Read Snapshots
- Modify SpeedGrader Score Sync to fail gracefully if no snapshot exists
- Assume snapshots are always populated by dashboard/gradebook first
- Log a warning if snapshot is missing

### Option B: Add Caching to `determineCourseModel()`
- Check sessionStorage for existing snapshot before making API calls
- If snapshot exists and contains `model` field, return cached value
- Only make API calls if no cached data exists

### Option C: Add Caching to `hasAvgAssignment()`
- Similar to the legacy `courseHasAvgAssignment()` function in `src/utils/canvas.js:108-132`
- Cache the result in sessionStorage with key `hasAvgAssignment_{courseId}`
- Check cache before making API call

### Option D: Optimize `populateCourseSnapshot()` for Teachers
- For `teacher_like` users on SpeedGrader, skip course model detection entirely
- Assume course model is already known or will be determined on-demand
- Only populate minimal snapshot data needed for SpeedGrader

## Impact

- **Performance**: Minor - adds ~100-200ms to SpeedGrader page load
- **API Load**: Minor - 1-2 extra API calls per SpeedGrader page load
- **Functionality**: None - the API calls work correctly, they're just redundant
- **User Experience**: Negligible - not noticeable to users

## Recommendation

**Preferred Solution**: Option B - Add caching to `determineCourseModel()`

This would:
- Fix the issue at the source (course detection logic)
- Benefit all modules that use `determineCourseModel()`
- Maintain backward compatibility
- Respect the existing snapshot cache architecture

**Implementation**:
1. Modify `determineCourseModel()` to check for existing snapshot first
2. If snapshot exists and contains `model` field, return `{ model: snapshot.model, reason: snapshot.modelReason }`
3. Only perform detection logic (including API calls) if no cached data exists

## Related Files

- `src/speedgrader/speedgraderScoreSync.js` - SpeedGrader Score Sync module
- `src/services/courseSnapshotService.js` - Course snapshot caching service
- `src/utils/courseDetection.js` - Course model detection logic
- `src/services/gradeDataService.js` - Grade fetching logic (contains `fetchAvgAssignmentScore()`)
- `src/utils/canvasApiClient.js` - API client (automatically adds `per_page=100`)

## Notes

- The 404 error on the submission fetch is expected if the student doesn't have a submission for that assignment
- The `per_page=100` parameter is automatically added by `CanvasApiClient.get()` to avoid pagination limits
- SpeedGrader is already restricted to teachers by Canvas, so the role check was redundant (fixed separately)

