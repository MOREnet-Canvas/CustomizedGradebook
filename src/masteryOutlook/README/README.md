# Outcomes Dashboard Module

## Overview

The Outcomes Dashboard is a teacher/admin-facing Power Law analytics module for Canvas LMS that provides predictive insights into student mastery of learning outcomes. It calculates Marzano Power Law predictions for student outcomes at the course level, replacing Canvas's built-in scoring methods (decaying average, highest, latest) with a regression-based approach.

## Purpose

**What it does:**
- Pulls raw rubric criteria scores from Canvas outcome results and submissions endpoints
- Sorts scores chronologically per student per outcome
- Runs Power Law regression (y = a · x^b) to predict where each student would score if assessed today
- Caches results as JSON in a hidden Canvas course Files folder
- Visualizes class-level trends, intervention needs, and re-teach priorities

**What it replaces:**
- Canvas's built-in scoring methods (not used for this dashboard)
- Manual tracking of student growth trajectories
- Ad-hoc identification of students needing intervention

---

## Key Architectural Decisions

### 1. Data Storage: Canvas Files API

**Decision:** Cache data as `_mastery_cache/outcomes_cache.json` using Canvas Files API (3-step upload process).

**Rationale:**
- Persistent across sessions and users
- Accessible to all teachers in the course
- No dependency on external databases
- Hidden from students (`hidden: true` folder flag)

**Alternative Considered:** localStorage - rejected because:
- Per-user, per-browser only
- Not shared between teachers
- Size limits (~5-10MB)
- Cleared on logout/cache clear

### 2. Cache Refresh: Manual Teacher-Triggered

**Decision:** No auto-refresh. Teachers click "Refresh Data" button to recompute.

**Rationale:**
- Expensive operation (outcome rollups for all students)
- Infrequent changes to rubric scores
- Teachers control when to update
- Avoids rate limiting Canvas API

### 3. Privacy: No Student Names in Cache

**Decision:** Cache stores only `userId` and `sectionId`. Student names resolved at render time.

**Rationale:**
- Smaller file size
- Names may change (marriage, legal name changes)
- Roster data already cached separately (sessionStorage, 30min TTL)
- Privacy-by-design: cache file contains only numeric IDs

### 4. Deduplication Key: submissionId

**Decision:** Use `submissionId` during fetch/merge to deduplicate scores.

**Rationale:**
- One assignment can have multiple rubric criteria aligned to different outcomes
- Same submission may appear multiple times in outcome rollups
- `submissionId` ensures we count each assessment event once
- `submissionId` is **NOT** stored in cache (only used during fetch/merge)

### 5. Insufficient Data Threshold: 3 Scored Attempts

**Decision:** Students with <3 attempts get status "NE" (Not Enough data). Power Law fields are null.

**Rationale:**
- Power Law regression requires minimum 3 data points for meaningful slope
- Simpler metrics (mean, mostRecent, decayingAvg) still calculated and shown
- Teachers see "NE" badge instead of unreliable predictions

### 6. Re-teach Threshold: Per-User, Per-Course (localStorage)

**Decision:** Store threshold in `localStorage` with key `cg_threshold_{courseId}_{userId}`.

**Rationale:**
- Two teachers in same course may have different intervention strategies
- Persists across sessions for each teacher
- Default: 2.2
- Not stored in cache file (except as snapshot `computedThreshold` for reference)

### 7. Canvas Scoring Method: Reference Only

**Decision:** Store Canvas's scoring method in `meta.canvasScoringMethod` but don't use it.

**Rationale:**
- Dashboard replaces Canvas scoring with Power Law
- Stored for debugging/auditing purposes
- Teachers can compare Power Law vs. Canvas method if needed

### 8. Permissions: Teachers, TAs, Designers, Admins Only

**Decision:** Check `ENV.current_user_roles` for teacher-like roles.

**Allowed Roles:**
- `teacher`
- `ta`
- `admin`
- `accountadmin`
- `root_admin`
- `designer`

**Implementation:** `canAccessOutcomesDashboard()` function checks all role indicators.

### 9. Page Detection: Custom Canvas Page

**Decision:** Dashboard lives at `/courses/{courseId}/pages/outcomes-dashboard`.

**Page Properties:**
- **URL:** `outcomes-dashboard`
- **Title:** "Outcomes Dashboard"
- **Body:** `<div id="outcomes-dashboard-root"></div>`
- **Published:** Can be published or unpublished
  - **Unpublished pages** are accessible to teachers/admins in Canvas
  - Students cannot see unpublished pages
  - Recommendation: Keep unpublished until teachers are ready to share link

**Creation:** Button injected in Course Settings sidebar (similar to Mastery Dashboard creation).

### 10. Error Handling: Show Errors, No Silent Fallback

**Decision:** If Files API fails, show clear error message with retry option. No fallback to localStorage.

**Rationale:**
- Avoids confusion about data source
- Forces resolution of API issues
- Maintains single source of truth (Canvas Files)

---

## Cache Schema

### File Location
- **Path:** `_mastery_cache/outcomes_cache.json`
- **Folder:** Hidden from students (`hidden: true`)
- **Size:** Varies by course (typically 50KB - 500KB for 30 students × 12 outcomes)

### Schema Version 1.0

```json
{
  "meta": {
    "courseId": "123456",
    "courseName": "ELA 10 — Period 3",
    "computedAt": "2026-03-30T14:22:00Z",
    "computedBy": "user_id",
    "studentCount": 34,
    "outcomeCount": 12,
    "canvasScoringMethod": "decaying_average",
    "schemaVersion": "1.0"
  },
  "outcomes": [
    {
      "id": "outcome_id",
      "title": "Argumentative Writing",
      "displayOrder": 1,
      "classStats": {
        "plAvg": 2.74,
        "distribution": { "1": 3, "2": 8, "3": 18, "4": 5 },
        "belowThresholdCount": 11,
        "computedThreshold": 2.2,
        "avgSlope": 0.18,
        "neCount": 4
      },
      "students": [
        {
          "userId": "987",
          "sectionId": "section_id",
          "attempts": [
            { "score": 2, "assessedAt": "2026-01-10T00:00:00Z" },
            { "score": 3, "assessedAt": "2026-02-14T00:00:00Z" },
            { "score": 4, "assessedAt": "2026-03-01T00:00:00Z" }
          ],
          "computed": {
            "status": "ok",
            "plPrediction": 4.21,
            "slope": 0.42,
            "mean": 3.0,
            "mostRecent": 4,
            "decayingAvg": 3.71,
            "attemptCount": 3
          }
        },
        {
          "userId": "988",
          "sectionId": "section_id",
          "attempts": [
            { "score": 1, "assessedAt": "2026-01-10T00:00:00Z" }
          ],
          "computed": {
            "status": "NE",
            "plPrediction": null,
            "slope": null,
            "mean": 1.0,
            "mostRecent": 1,
            "decayingAvg": 1.0,
            "attemptCount": 1
          }
        }
      ]
    }
  ]
}
```

### Schema Fields

**meta:**
- `courseId` - Canvas course ID (string)
- `courseName` - Course name from Canvas (string)
- `computedAt` - ISO 8601 timestamp of cache generation
- `computedBy` - User ID who triggered refresh
- `studentCount` - Total students in roster
- `outcomeCount` - Total outcomes in course
- `canvasScoringMethod` - Canvas's configured method (reference only)
- `schemaVersion` - Schema version ("1.0")

**outcomes[].classStats:**
- `plAvg` - Average Power Law prediction across all students with status "ok"
- `distribution` - Count of students per score level (1-4)
- `belowThresholdCount` - Students below current threshold
- `computedThreshold` - Snapshot of threshold used during computation
- `avgSlope` - Average learning rate (slope) across students with status "ok"
- `neCount` - Count of students with "NE" status

**outcomes[].students[].computed:**
- `status` - "ok" or "NE" (Not Enough data)
- `plPrediction` - Power Law predicted score (null if NE)
- `slope` - Learning rate from regression (null if NE)
- `mean` - Simple average of all scores
- `mostRecent` - Most recent score
- `decayingAvg` - Weighted average (65% weight to recent)
- `attemptCount` - Total scored attempts

---

## Module File Structure

```
src/outcomesDashboard/
├── README.md                      ← This file
├── outcomesDashboardInit.js       ← Entry point, main initialization
├── outcomesDashboardView.js       ← Main render, default state and loaded state
├── outcomesCacheService.js        ← Canvas Files API read/write/folder operations
├── outcomesDataService.js         ← Fetch outcome results + submissions, merge, sort
├── powerLaw.js                    ← Pure math functions (COMPLETE)
├── outcomesRenderer.js            ← DOM builders for outcome rows and student tables
├── outcomesPermissions.js         ← Role-based access control
├── outcomesDashboardCreation.js   ← Button injection for page creation (Course Settings)
└── thresholdStorage.js            ← localStorage threshold management

tests/
└── outcomesCacheFileTest.js       ← Standalone Canvas Files API test script
```

---

## Canvas Files API Integration

### 3-Step Upload Process

The Canvas Files API requires a 3-step process to upload files:

**Step 1: Notify Canvas (Get Upload Token)**
```javascript
POST /api/v1/courses/{courseId}/files
Body: {
  name: 'outcomes_cache.json',
  size: <file size in bytes>,
  content_type: 'application/json',
  parent_folder_id: <folder ID>,
  on_duplicate: 'overwrite'
}
Response: { upload_url, upload_params, id }
```

**Step 2: POST to S3 (External Domain)**
```javascript
POST <upload_url from Step 1>
Body: FormData with:
  - All fields from upload_params
  - file: <Blob object>

IMPORTANT: Use plain fetch(), not apiClient
- S3 is external domain (not Canvas)
- Set credentials: 'omit' (no Canvas cookies needed)
```

**Step 3: Confirm Upload (Canvas)**
```javascript
POST <location from Step 2 response> or GET /api/v1/files/{id}
- Canvas may auto-confirm, but explicit confirmation is safer
```

### Folder Operations

**Check/Create Hidden Folder:**
```javascript
// Try to get existing folder
GET /api/v1/courses/{courseId}/folders/by_path/_mastery_cache

// If 404, create it
POST /api/v1/courses/{courseId}/folders
Body: {
  name: '_mastery_cache',
  hidden: true  // Hidden from students
}
```

**Read Cache File:**
```javascript
// 1. Search for file
GET /api/v1/courses/{courseId}/files?search_term=outcomes_cache.json

// 2. Get file metadata (includes download URL)
GET /api/v1/files/{fileId}

// 3. Fetch file contents
fetch(file.url)  // May redirect to S3, use plain fetch()
```

### Important Implementation Notes

1. **Use `apiClient` for Canvas API calls** (Steps 1, 3, folder ops)
2. **Use plain `fetch()` for S3 upload** (Step 2)
3. **Set `credentials: 'omit'` for S3** (no Canvas cookies)
4. **Always provide context string** to `apiClient` methods for logging
5. **Handle 404 gracefully** when checking for existing folder/file

---

## Data Flow

### 1. Initial Load (Page Load)

```
Teacher visits /courses/123/pages/outcomes-dashboard
    ↓
outcomesDashboardInit.js detects page and permissions
    ↓
renderOutcomesDashboard() renders default empty state
    ↓
tryLoadCache() attempts to read from Canvas Files
    ↓
If cache exists → render loaded state with data
If no cache → show "No data yet" + Refresh button
```

### 2. Refresh Flow (Teacher Clicks Refresh)

```
Teacher clicks "Refresh Data" button
    ↓
Progress: "Fetching outcome data..."
    ↓
outcomesDataService.fetchAllOutcomeData()
  - Fetch all outcomes in course
  - Fetch all students (enrollmentService)
  - Fetch outcome rollups for all students
  - Extract rubric scores, deduplicate by submissionId
  - Sort chronologically per outcome per student
    ↓
Progress: "Computing Power Law predictions..."
    ↓
powerLaw.computeStudentOutcome() for each student
  - If <3 attempts → status "NE", PL fields null
  - If ≥3 attempts → run regression, calculate slope, prediction
powerLaw.computeClassStats() for each outcome
  - Average PL prediction, distribution, below-threshold count
    ↓
Progress: "Saving cache..."
    ↓
outcomesCacheService.writeOutcomesCache()
  - 3-step Canvas Files API upload
  - Overwrites existing file
    ↓
Progress: "Rendering dashboard..."
    ↓
Render loaded state with fresh data
```

### 3. Name Resolution (Render Time)

**Cache file does NOT contain student names.**

At render time:
```javascript
// Get roster from enrollmentService (with session cache, 30min TTL)
const students = await fetchCourseStudents(courseId, apiClient);
const rosterMap = new Map(students.map(s => [s.userId, s]));

// For each student in cache
const studentName = rosterMap.get(userId)?.name ?? `User ${userId}`;
```

**Session Storage Cache Key:** `cg_outcomesDashboard_roster_{courseId}`

---

## Codebase Integration Patterns

### Logger Usage

**Tag Convention:**
- `[OutcomesDashboard]` - Main module
- `[OutcomeCache]` - Cache service
- `[OutcomesData]` - Data service
- `[ThresholdStorage]` - Threshold storage

**Example:**

```javascript
import {logger} from './logger.js';

logger.trace('[OutcomesDashboard] High-frequency debug');
logger.debug('[OutcomesDashboard] Detailed info');
logger.info('[OutcomesDashboard] Important messages');
logger.warn('[OutcomesDashboard] Warnings');
logger.error('[OutcomesDashboard] Errors', error);
```

### CanvasApiClient

**Always provide context string:**
```javascript
const data = await apiClient.get(
    '/api/v1/courses/123/outcomes',
    {},
    'fetchOutcomes'  // ← Context for logging
);

const created = await apiClient.post(
    '/api/v1/courses/123/files',
    { name: 'cache.json', size: 1234 },
    {},
    'filesApiStep1'  // ← Context for logging
);
```

**Pagination:**
```javascript
// Auto-paginates, returns all results
const allStudents = await apiClient.getAllPages(
    `/api/v1/courses/123/users?enrollment_type[]=student`,
    {},
    'fetchAllStudents'
);
```

### EnrollmentService

**Available Methods:**
```javascript
import { fetchCourseStudents, fetchCourseSections } from '../services/enrollmentService.js';

// Returns: [{ userId, name, sortableName, sectionId }, ...]
const students = await fetchCourseStudents(courseId, apiClient);

// Returns: [{ id, name }, ...]
const sections = await fetchCourseSections(courseId, apiClient);
```

**Session Cache:**
- Automatically caches roster in sessionStorage
- TTL: 30 minutes
- Key format: `cg_teacherRoster_{courseId}`

### FONT Constant (Canvas Styling)

```javascript
const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";

element.style.cssText = `
    ${FONT}
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
`;
```

### Role Detection

```javascript
import { canAccessOutcomesDashboard } from './outcomesPermissions.js';

if (!canAccessOutcomesDashboard()) {
    logger.debug('[OutcomesDashboard] User lacks permission');
    return;
}

// Checks ENV.current_user_roles for:
// teacher, ta, admin, accountadmin, root_admin, designer
```

### Page Detection

```javascript
import { isOutcomesDashboardPage } from '../utils/pageDetection.js';

if (isOutcomesDashboardPage()) {
    initOutcomesDashboard();
}

// Pattern: /courses/123/pages/outcomes-dashboard
```

---

## Testing Strategy

### Phase 1: Canvas Files API Test (CURRENT)

**File:** `tests/outcomesCacheFileTest.js`

**Purpose:** Validate Canvas Files API 3-step upload against beta environment.

**Tests:**
1. ✅ Folder creation (`_mastery_cache`)
2. ✅ File write (3-step upload)
3. ✅ File read-back (verify contents)
4. ✅ File overwrite (`on_duplicate: 'overwrite'`)

**How to Run:**
1. Copy test file contents to browser console on Canvas course page
2. Update `TEST_COURSE_ID` constant
3. Run script
4. Check console logs for results
5. Verify file in Canvas Files UI

**Expected Output:**
```
✅ All tests passed!
File ID: 12345
File contents match expected data
```

### Phase 2: Unpublished Page Test

**Purpose:** Verify teachers can access unpublished pages.

**Test Steps:**
1. Create page `/courses/123/pages/outcomes-dashboard`
2. Set `published: false`
3. As teacher, navigate to page URL
4. Verify page loads and `#outcomes-dashboard-root` div exists
5. Verify students cannot access (404 or access denied)

**Canvas Behavior:**
- ✅ Teachers/admins can view unpublished pages
- ✅ Students see 404 for unpublished pages
- ✅ Page won't appear in student's Pages list

### Phase 3: Integration Testing

**After all modules built:**

1. **Page Creation**
   - Click "Create Outcomes Dashboard" button in Course Settings
   - Verify page created with correct body
   - Verify button added to front page

2. **Data Refresh**
   - Click "Refresh Data" button
   - Monitor progress messages
   - Verify cache file created in Canvas Files
   - Verify dashboard renders with data

3. **Threshold Persistence**
   - Adjust threshold slider
   - Refresh page
   - Verify threshold persists (localStorage)
   - Switch users (if possible)
   - Verify each user has independent threshold

4. **Error Handling**
   - Simulate API failure (network offline, invalid course ID)
   - Verify clear error message shown
   - Verify retry option available
   - Verify no silent fallback to localStorage

---

## Development Roadmap

### ✅ Completed
- [x] `powerLaw.js` - Pure math functions
- [x] `outcomesDashboardView.js` - View layer skeleton
- [x] `tests/outcomesCacheFileTest.js` - Standalone test script
- [x] Planning documentation (this file)

### 🔄 In Progress
- [ ] **Canvas Files API Test** - Run test script on beta environment
- [ ] **Unpublished Page Test** - Verify teacher access to unpublished pages

### 📋 To Do

**Priority 1: Core Services**
1. [ ] `outcomesCacheService.js` - Canvas Files API integration
   - Folder operations
   - Read cache file
   - Write cache file (3-step upload)

2. [ ] `thresholdStorage.js` - localStorage threshold management
   - getThreshold(courseId, userId)
   - saveThreshold(courseId, userId, value)

3. [ ] `outcomesPermissions.js` - Role-based access control
   - canAccessOutcomesDashboard()

**Priority 2: Data Pipeline**
4. [ ] `outcomesDataService.js` - Fetch and merge outcome data
   - fetchOutcomeNames(courseId, apiClient)
   - fetchOutcomeRollups(courseId, studentIds, apiClient)
   - extractAttempts(rollups) - deduplicate, sort
   - fetchAllOutcomeData(courseId, apiClient) - orchestrate

**Priority 3: Initialization & Page Creation**
5. [ ] `outcomesDashboardInit.js` - Entry point
   - Page detection
   - Permission check
   - Render orchestration
   - Refresh handler with progress callbacks

6. [ ] `outcomesDashboardCreation.js` - Button injection
   - Inject button in Course Settings sidebar
   - Create page with `#outcomes-dashboard-root` div
   - Add button to front page
   - Delete functionality

**Priority 4: UI Components**
7. [ ] `outcomesRenderer.js` - DOM builders
   - renderOutcomeRow() - expandable rows
   - renderStudentTable() - PL predictions, score history
   - renderInterventionSidebar() - low-performing students, re-teach list

8. [ ] Complete `outcomesDashboardView.js`
   - Wire tryLoadCache() to outcomesCacheService
   - Wire fetchOutcomeNames() to outcomesDataService
   - Build threshold slider UI
   - Build intervention sidebar
   - Build expandable outcome rows

**Priority 5: Integration**
9. [ ] Add to `customGradebookInit.js`
   - Import modules
   - Add page detection
   - Call injectOutcomesDashboardButton() on settings page
   - Call initOutcomesDashboard() on dashboard page

10. [ ] Add to `src/utils/pageDetection.js`
    - isOutcomesDashboardPage() function

---

## Implementation Guidelines

### Code Style

**ES Modules:**
```javascript
// Always use ES module imports
import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
export function myFunction() { }
export default MyClass;
```

**Async/Await:**
```javascript
// Prefer async/await over .then()
async function fetchData() {
    try {
        const data = await apiClient.get('/api/v1/endpoint', {}, 'context');
        return data;
    } catch (error) {
        logger.error('[Module] Error:', error);
        throw error;
    }
}
```

**Error Handling:**
```javascript
// Always wrap API calls in try/catch
// Log errors with context
// Re-throw or return null as appropriate
try {
    const result = await apiCall();
    return result;
} catch (error) {
    logger.error('[Module] Operation failed:', error);
    throw error;  // Let caller handle
}
```

**Inline Styles:**
```javascript
// Use FONT constant for Canvas consistency
// Use cssText for multi-property styles
const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";

element.style.cssText = `
    ${FONT}
    font-size: 14px;
    color: #333;
    padding: 8px;
`;
```

### Performance Considerations

**Session Caching:**
- Roster data cached 30min (enrollmentService handles this)
- Outcome names cached in sessionStorage if needed
- Cache file read once per page load

**Batch API Calls:**
```javascript
// Fetch in parallel when possible
const [students, sections, outcomes] = await Promise.all([
    fetchCourseStudents(courseId, apiClient),
    fetchCourseSections(courseId, apiClient),
    fetchOutcomeNames(courseId, apiClient)
]);
```

**Pagination Limits:**
```javascript
// Canvas limits user_ids[] parameter to ~50 per request
// Batch large requests
const BATCH_SIZE = 50;
for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
    const batch = studentIds.slice(i, i + BATCH_SIZE);
    // Process batch...
}
```

**DOM Updates:**
```javascript
// Build DOM fragments off-document, append once
const fragment = document.createDocumentFragment();
students.forEach(s => {
    const row = buildStudentRow(s);
    fragment.appendChild(row);
});
container.appendChild(fragment);
```

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **No real-time updates**
   - Cache is manually refreshed
   - Teachers must click "Refresh Data" to see new scores

2. **Single course only**
   - No cross-course analytics
   - Each course has independent cache

3. **No historical tracking**
   - Cache overwrites previous data
   - No trend analysis over weeks/months

4. **Power Law requires 3+ attempts**
   - Students with <3 scores get "NE" status
   - May miss early intervention opportunities

5. **No CSV export**
   - Data viewable in dashboard only
   - No export for external analysis

### Future Enhancements

**Phase 2 Features:**
- [ ] CSV export (download cache as spreadsheet)
- [ ] Historical snapshots (save weekly/monthly snapshots)
- [ ] Trend charts (progress over time per student)
- [ ] Email alerts (students falling below threshold)
- [ ] Bulk re-teach assignment creation (auto-create assignments for intervention)

**Phase 3 Features:**
- [ ] Cross-course analytics (department/grade-level view)
- [ ] Predicted mastery date (when will student reach proficiency?)
- [ ] Confidence intervals (uncertainty in predictions)
- [ ] Alternative models (linear, exponential, logistic regression)

---

## Troubleshooting

### Dashboard Doesn't Appear

**Check:**
1. Page URL is `/courses/123/pages/outcomes-dashboard`
2. Page has `<div id="outcomes-dashboard-root"></div>` in body
3. User has teacher/admin role
4. Script loaded without errors (check browser console)

**Debug:**
```javascript
// In browser console
console.log('Current user roles:', ENV.current_user_roles);
console.log('Dashboard root:', document.querySelector('#outcomes-dashboard-root'));
```

### Refresh Button Does Nothing

**Check:**
1. Browser console for errors
2. Network tab for failed API calls
3. Logger output (enable trace logging)

**Common Causes:**
- No outcomes in course
- No enrolled students
- Canvas API rate limiting
- Network connectivity issues

### Cache File Not Created

**Check:**
1. Canvas Files API enabled for course
2. Teacher has permission to create files
3. Folder creation succeeded
4. S3 upload step succeeded (check network tab)

**Debug:**
```javascript
// Test folder creation manually
const apiClient = new CanvasApiClient();
const folder = await apiClient.post(
    '/api/v1/courses/123/folders',
    { name: '_mastery_cache', hidden: true },
    {},
    'testFolderCreate'
);
console.log('Folder created:', folder);
```

### Power Law Predictions Look Wrong

**Check:**
1. Scores are 0-4 scale (not percentages)
2. Scores are rubric criteria scores (not assignment scores)
3. Chronological sort is correct (oldest first)
4. No duplicate submissionIds

**Debug:**
```javascript
// Check raw attempts data
const cache = await readOutcomesCache(courseId, apiClient);
console.log('First student first outcome attempts:',
    cache.outcomes[0].students[0].attempts);
```

### Threshold Not Persisting

**Check:**
1. localStorage not disabled in browser
2. Private/incognito mode (localStorage cleared on close)
3. Key format: `cg_threshold_{courseId}_{userId}`

**Debug:**
```javascript
// Check localStorage
const key = `cg_threshold_${courseId}_${userId}`;
console.log('Stored threshold:', localStorage.getItem(key));
```

---

## API Reference

### outcomesCacheService.js

```javascript
/**
 * Read cache file from Canvas Files
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Object|null>} Cache data or null if not found
 */
export async function readOutcomesCache(courseId, apiClient)

/**
 * Write cache file to Canvas Files (3-step upload)
 * @param {string} courseId - Course ID
 * @param {Object} cacheData - Cache data matching schema v1.0
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<string>} File ID
 */
export async function writeOutcomesCache(courseId, cacheData, apiClient)
```

### outcomesDataService.js

```javascript
/**
 * Fetch all outcome names from course
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Array<{id, title, displayOrder}>>}
 */
export async function fetchOutcomeNames(courseId, apiClient)

/**
 * Fetch all outcome data and prepare for Power Law computation
 * @param {string} courseId - Course ID
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Object>} { outcomeNames, students, attemptsByOutcome }
 */
export async function fetchAllOutcomeData(courseId, apiClient)
```

### thresholdStorage.js

```javascript
/**
 * Get re-teach threshold for user in course
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @returns {number} Threshold (default: 2.2)
 */
export function getThreshold(courseId, userId)

/**
 * Save re-teach threshold for user in course
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {number} value - Threshold value (0-4)
 */
export function saveThreshold(courseId, userId, value)
```

### outcomesPermissions.js

```javascript
/**
 * Check if current user can access outcomes dashboard
 * @returns {boolean} True if user is teacher/ta/admin/designer
 */
export function canAccessOutcomesDashboard()
```

### powerLaw.js (COMPLETE)

```javascript
/**
 * Compute Power Law prediction and metrics for one student/outcome
 * @param {number[]} scores - Array of scores (chronological)
 * @returns {Object} { status, plPrediction, slope, mean, mostRecent, decayingAvg, attemptCount }
 */
export function computeStudentOutcome(scores)

/**
 * Compute class-level statistics for one outcome
 * @param {Array} studentResults - Array of student computed objects
 * @param {number} threshold - Re-teach threshold
 * @returns {Object} { plAvg, distribution, belowThresholdCount, computedThreshold, avgSlope, neCount }
 */
export function computeClassStats(studentResults, threshold)
```

---

## Resources

### Canvas API Documentation
- **Files API:** https://canvas.instructure.com/doc/api/files.html
- **Outcomes API:** https://canvas.instructure.com/doc/api/outcomes.html
- **Outcome Results:** https://canvas.instructure.com/doc/api/outcome_results.html

### Related Codebase Modules
- **Mastery Dashboard:** `src/masteryDashboard/` - Student mastery view
- **Teacher Mastery View:** `src/masteryDashboard/teacherMasteryView.js` - Multi-student roster
- **Enrollment Service:** `src/services/enrollmentService.js` - Student roster fetching
- **Page Service:** `src/services/pageService.js` - Canvas Pages API

### Power Law Learning Theory
- **Marzano Research:** Power Law of Learning
- **Regression:** y = a · x^b (where x = attempt number, y = predicted score)

---

## Change Log

### Version 1.0 (Initial Release)
- Core Power Law prediction engine
- Canvas Files API integration
- Manual cache refresh
- Teacher/admin-only access
- Per-user threshold storage
- Unpublished page support

---

## Contact & Support

**Module Owner:** CustomizedGradebook Development Team
**Repository:** https://github.com/MOREnet-Canvas/CustomizedGradebook
**Branch:** `Teacher-Mastery-Dashboard`

**For Questions:**
1. Check this documentation first
2. Review browser console logs
3. Test with standalone test scripts
4. Open GitHub issue with full context

---

## Appendix A: Complete Example Cache File

```json
{
  "meta": {
    "courseId": "123456",
    "courseName": "ELA 10 — Period 3",
    "computedAt": "2026-04-03T10:30:00Z",
    "computedBy": "67890",
    "studentCount": 34,
    "outcomeCount": 12,
    "canvasScoringMethod": "decaying_average",
    "schemaVersion": "1.0"
  },
  "outcomes": [
    {
      "id": "100",
      "title": "Argumentative Writing",
      "displayOrder": 1,
      "classStats": {
        "plAvg": 2.74,
        "distribution": { "1": 3, "2": 8, "3": 18, "4": 5 },
        "belowThresholdCount": 11,
        "computedThreshold": 2.2,
        "avgSlope": 0.18,
        "neCount": 0
      },
      "students": [
        {
          "userId": "987",
          "sectionId": "55",
          "attempts": [
            { "score": 2, "assessedAt": "2026-01-10T08:00:00Z" },
            { "score": 3, "assessedAt": "2026-02-14T09:30:00Z" },
            { "score": 4, "assessedAt": "2026-03-01T10:15:00Z" }
          ],
          "computed": {
            "status": "ok",
            "plPrediction": 4.21,
            "slope": 0.42,
            "mean": 3.0,
            "mostRecent": 4,
            "decayingAvg": 3.71,
            "attemptCount": 3
          }
        }
      ]
    }
  ]
}
```

---

## Appendix B: Testing Checklist

### Pre-Development Tests
- [ ] Canvas Files API test script runs successfully
- [ ] Folder creation works (`_mastery_cache`)
- [ ] File upload works (3-step process)
- [ ] File read-back works (verify JSON contents)
- [ ] File overwrite works (`on_duplicate: 'overwrite'`)
- [ ] Unpublished page accessible to teachers
- [ ] Unpublished page NOT accessible to students

### Post-Development Tests
- [ ] Page creation button appears in Course Settings
- [ ] Page creation succeeds
- [ ] Front page button added correctly
- [ ] Dashboard page loads without errors
- [ ] Permission check blocks students
- [ ] Permission check allows teachers/admins
- [ ] Refresh button triggers data fetch
- [ ] Progress messages update during refresh
- [ ] Cache file created in Canvas Files
- [ ] Cache file contains correct JSON structure
- [ ] Dashboard renders outcome rows
- [ ] Outcome rows expand/collapse
- [ ] Student names resolved from roster
- [ ] Threshold slider works
- [ ] Threshold persists in localStorage
- [ ] Threshold independent per user
- [ ] Error handling shows clear messages
- [ ] Retry option available on errors
- [ ] No silent fallback to localStorage

---

**End of Documentation**