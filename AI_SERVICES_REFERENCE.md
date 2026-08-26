# AI Services Reference

**Quick reference for AI assistants working on CustomizedGradebook codebase.**

Shows what services, utilities, and patterns already exist. **Always search here before creating new utilities.**

---

## Core Utilities (`src/utils/`)

### `canvasApiClient.js` - Canvas API Client
**Use:** All Canvas API calls

```javascript
import { CanvasApiClient } from '../utils/canvasApiClient.js';

const apiClient = new CanvasApiClient();  // Auto-fetches CSRF token

// GET request (automatically adds per_page=100)
const data = await apiClient.get('/api/v1/courses/123/assignments');

// GET with pagination (follows Link headers, returns all pages)
const allStudents = await apiClient.getAllPages('/api/v1/courses/123/enrollments');

// POST request
const created = await apiClient.post('/api/v1/courses/123/assignments', { assignment: {...} });

// PUT request
const updated = await apiClient.put('/api/v1/assignments/456', { assignment: {...} });

// DELETE request
await apiClient.delete('/api/v1/assignments/456');

// GraphQL request
const result = await apiClient.graphql(query, variables);
```

**Features:**
- ✅ CSRF token handling (cached at initialization)
- ✅ Automatic `per_page=100` on GET requests
- ✅ Pagination support with `getAllPages()`
- ✅ Integrated with `safeFetch` error handling

---

### `canvas.js` - Canvas Environment Utilities
**Use:** Course ID, user roles, Canvas ENV data

```javascript
import { getCourseId, getUserRoleGroup, extractCourseIdFromHref } from '../utils/canvas.js';

// Get current course ID from URL
const courseId = getCourseId();  // Returns string or null

// Get user role group (returns "teacher_like" | "student_like" | "other")
const roleGroup = getUserRoleGroup();

if (roleGroup === "teacher_like") {
    // User is teacher, TA, admin, AccountAdmin, designer, or root_admin
}

if (roleGroup === "student_like") {
    // User is student or observer
}

// Extract course ID from href
const courseId = extractCourseIdFromHref(link.href);  // Returns string or null
```

**Role Detection Details:**
- `teacher_like` includes: teacher, admin, root_admin, designer, ta, AccountAdmin
- `student_like` includes: student, observer
- Checks `ENV.current_user_roles`, `ENV.current_user_types`, and `ENV.current_user_is_*` flags
- Result is cached in sessionStorage

---

### `logger.js` - Logging Utility
**Use:** All logging (replaces console.log)

```javascript
import { logger } from '../utils/logger.js';

logger.trace('[ModuleName] Detailed trace info');   // Very verbose
logger.debug('[ModuleName] Debug info');            // Development info
logger.info('[ModuleName] Normal operation');       // Default level
logger.warn('[ModuleName] Warning message');        // Warnings
logger.error('[ModuleName] Error occurred', error); // Errors
```

**Log Levels:** trace < debug < info < warn < error

**Convention:** Always tag with `[ModuleName]` prefix

---

### `pageDetection.js` - Page Detection Utilities
**Use:** Detect which Canvas page you're on

```javascript
import {
    isDashboardPage,
    isGradebookPage,
    isSpeedGraderPage,
    isCourseSettingsPage,
    isAllGradesPage,
    isSingleCourseGradesPage,
    isTeacherViewingStudentGrades
} from '../utils/pageDetection.js';

if (isDashboardPage()) {
    // On /courses or /
}

if (isGradebookPage()) {
    // On /courses/:id/gradebook
}

if (isCourseSettingsPage()) {
    // On /courses/:id/settings
}
```

**Available Functions:**
- `isDashboardPage()` - Dashboard (course list)
- `isGradebookPage()` - Teacher gradebook
- `isSpeedGraderPage()` - SpeedGrader
- `isCourseSettingsPage()` - Course settings
- `isAllGradesPage()` - Student all-grades page
- `isSingleCourseGradesPage()` - Student single course grades
- `isTeacherViewingStudentGrades()` - Teacher viewing student view

---

### `errorHandler.js` - Error Handling
**Use:** Safe fetch and JSON parsing

```javascript
import { safeFetch, safeJsonParse } from '../utils/errorHandler.js';

// Safe fetch with error logging
const response = await safeFetch(url, options, 'contextName');

// Safe JSON parse with error handling
const data = safeJsonParse(jsonString, 'contextName');
```

**Features:**
- Logs errors with context
- Returns null on error instead of throwing


---

### `assignmentService.js` - Assignments API

```javascript
import {
    getAssignmentObjectFromOutcomeObj,
    createAssignment
} from '../services/assignmentService.js';

// Find assignment linked to an outcome
const assignment = await getAssignmentObjectFromOutcomeObj(courseId, outcomeObj);

// Create a new assignment
const created = await createAssignment(courseId, assignmentData);
```

---

### `rubricService.js` - Rubrics API

```javascript
import {
    getRubricForAssignment,
    createRubric
} from '../services/rubricService.js';

// Get rubric for an assignment
const rubric = await getRubricForAssignment(courseId, assignmentId);

// Create a new rubric
const created = await createRubric(courseId, rubricData);
```

---

### `courseSnapshotService.js` - Course Data Caching

```javascript
import {
    getCourseSnapshot,
    populateCourseSnapshot,
    clearAllSnapshots
} from '../services/courseSnapshotService.js';

// Get cached course snapshot (student grades, model, etc.)
const snapshot = getCourseSnapshot(courseId);

// Populate/refresh course snapshot
await populateCourseSnapshot(courseId, apiClient);

// Clear all snapshots
clearAllSnapshots();
```

**Features:**
- Session storage based
- TTL: 10 minutes
- User ownership validation
- Role-based access (student-like only)

---

### `gradeOverride.js` - Final Grade Override

```javascript
import {
    getAllEnrollmentIds,
    getEnrollmentIdForUser,
    setOverrideScoreGQL
} from '../services/gradeOverride.js';

// Get all enrollment IDs for a course
const enrollmentIds = await getAllEnrollmentIds(courseId);

// Get specific user's enrollment ID
const enrollmentId = await getEnrollmentIdForUser(courseId, userId);

// Set override score via GraphQL
await setOverrideScoreGQL(enrollmentId, score);
```

---

## UI Components (`src/ui/`)

### `buttons.js` - Button Creation

```javascript
import { makeButton } from '../ui/buttons.js';

// Create Canvas-styled button
const button = makeButton({
    text: 'Click Me',
    onClick: () => { /* ... */ },
    variant: 'primary'  // 'primary' | 'secondary' | 'danger'
});
```

---

## Configuration (`src/config.js`)

**Import configuration constants instead of hardcoding values:**

```javascript
import {
    DEFAULT_MAX_POINTS,
    DEFAULT_MASTERY_THRESHOLD,
    OUTCOME_AND_RUBRIC_RATINGS,
    ENABLE_STUDENT_GRADE_CUSTOMIZATION,
    ADMIN_DASHBOARD_ENABLED
} from '../config.js';
```

**Available Constants:**
- `DEFAULT_MAX_POINTS` - Default outcome max points (4)
- `DEFAULT_MASTERY_THRESHOLD` - Default mastery threshold (3)
- `OUTCOME_AND_RUBRIC_RATINGS` - 9-level rating scale
- `ENABLE_STUDENT_GRADE_CUSTOMIZATION` - Feature flag
- `ENABLE_OUTCOME_UPDATES` - Update outcomes flag
- `ENABLE_GRADE_OVERRIDE` - Grade override flag
- `MASTERY_REFRESH_ENABLED` - Mastery refresh feature flag
- `ADMIN_DASHBOARD_ENABLED` - Admin dashboard flag

---

## Module-Specific Services

### `powerLaw.js` (outcomesDashboard) - Power Law Math

```javascript
import {
    powerLawPredict,
    computeStudentOutcome,
    MIN_SCORES
} from '../outcomesDashboard/powerLaw.js';

// Get Power Law prediction for next attempt
const nextScore = powerLawPredict([2, 3.5, 4]);  // Chronological scores

// Get complete student outcome stats
const stats = computeStudentOutcome([2, 3.5, 4]);
// Returns: { status, plPrediction, slope, mean, mostRecent, decayingAvg, attemptCount }

// Minimum attempts required for prediction
if (scores.length >= MIN_SCORES) {
    // Can predict
}
```

**Important:** `MIN_SCORES` is configurable (currently 3).

---

### `outcomesCacheService.js` (outcomesDashboard) - Cache Management

```javascript
import {
    ensureFolder,
    writeOutcomesCache,
    readOutcomesCache,
    SCHEMA_VERSION
} from '../outcomesDashboard/outcomesCacheService.js';

// Ensure folder structure exists
const folderId = await ensureFolder(courseId, apiClient);

// Write cache to Canvas Files
await writeOutcomesCache(courseId, apiClient, cacheData);

// Read cache from Canvas Files (returns null if not found or schema mismatch)
const cache = await readOutcomesCache(courseId, apiClient);

// Check schema version
if (cache && cache.metadata.schemaVersion === SCHEMA_VERSION) {
    // Valid cache
}
```

**Cache Location:** `MOREnet_CustomizedGradebook/outcomes_cache/outcomes_cache.json`

**Schema Version:** Auto-validated on read. Mismatches return `null`.

---

### `thresholdStorage.js` (outcomesDashboard) - Threshold Persistence

```javascript
import {
    getThreshold,
    saveThreshold,
    resetThreshold,
    DEFAULT_THRESHOLD
} from '../outcomesDashboard/thresholdStorage.js';

// Get threshold (returns 2.2 if not set)
const threshold = getThreshold(courseId, userId);

// Save threshold
saveThreshold(courseId, userId, 3.0);

// Reset to default
resetThreshold(courseId, userId);
```

**Storage:** `localStorage['cg_threshold_{courseId}_{userId}']`

**Default:** `2.2` (22nd percentile)

---

## Common Patterns

### API Client Pattern

```javascript
import { CanvasApiClient } from '../utils/canvasApiClient.js';

async function myFunction(courseId) {
    const apiClient = new CanvasApiClient();

    // Simple GET
    const data = await apiClient.get(`/api/v1/courses/${courseId}/assignments`);

    // Paginated GET (automatically follows all pages)
    const allData = await apiClient.getAllPages(`/api/v1/courses/${courseId}/enrollments`);

    // POST
    const created = await apiClient.post(`/api/v1/courses/${courseId}/assignments`, {
        assignment: { name: 'New Assignment' }
    });
}
```

---

### Role-Based Access Pattern

```javascript
import { getUserRoleGroup } from '../utils/canvas.js';

const roleGroup = getUserRoleGroup();

if (roleGroup === "teacher_like") {
    // Teacher, TA, Admin, Designer, AccountAdmin, Root Admin
    initTeacherFeature();
}

if (roleGroup === "student_like") {
    // Student or Observer
    initStudentFeature();
}

// DO NOT create separate permission checking files
// getUserRoleGroup() is the standard pattern
```

---

### Logging Pattern

```javascript
import { logger } from '../utils/logger.js';

// Always tag with module name
logger.info('[MyModule] Starting operation');
logger.debug('[MyModule] Debug details', data);
logger.error('[MyModule] Error occurred', error);
```

---

### Page Detection Pattern

```javascript
import { isCourseSettingsPage } from '../utils/pageDetection.js';
import { getCourseId } from '../utils/canvas.js';

export function initMyModule() {
    if (!isCourseSettingsPage()) {
        return;  // Exit early if not on correct page
    }

    const courseId = getCourseId();
    if (!courseId) {
        logger.error('[MyModule] No course ID found');
        return;
    }

    // Proceed with initialization
}
```

---

## Key Principles

1. **Always search for existing utilities before creating new ones**
2. **Use `CanvasApiClient` for all API calls** (don't create new fetch wrappers)
3. **Use `getUserRoleGroup()` for role detection** (don't check ENV directly)
4. **Use `logger` for all logging** (don't use console.log)
5. **Import from `config.js`** for configurable constants
6. **Follow existing naming patterns** (e.g., `[ModuleName]` in logs)

---

## File Locations Quick Reference

| Need | File |
|------|------|
| Canvas API calls | `src/utils/canvasApiClient.js` |
| Role detection | `src/utils/canvas.js` → `getUserRoleGroup()` |
| Course ID | `src/utils/canvas.js` → `getCourseId()` |
| Logging | `src/utils/logger.js` |
| Page detection | `src/utils/pageDetection.js` |
| Error handling | `src/utils/errorHandler.js` |
| Button creation | `src/ui/buttons.js` |
| Student roster | `src/services/enrollmentService.js` |
| Canvas pages | `src/services/pageService.js` |
| Outcomes | `src/services/outcomeService.js` |
| Configuration | `src/config.js` |

---

**Last Updated:** 2026-04-06

**For AI Assistants:** Always check this document before implementing new utilities. If functionality exists here, reuse it instead of recreating.

### `dom.js` - DOM Utilities

```javascript
import { inheritFontStylesFrom, debounce } from '../utils/dom.js';

// Copy font styles from Canvas element
inheritFontStylesFrom('.selector', myElement);

// Debounce function calls
const debouncedFn = debounce(() => { /* ... */ }, 300);
```

---

### `observerHelpers.js` - MutationObserver Utilities

```javascript
import {
    createAutoDisconnectObserver,
    createDebouncedObserver,
    OBSERVER_CONFIGS
} from '../utils/observerHelpers.js';

// Auto-disconnect after timeout
const observer = createAutoDisconnectObserver(callback, {
    timeout: 30000,
    config: OBSERVER_CONFIGS.CHILD_LIST,
    target: document.body,
    name: 'MyObserver'
});

// Debounced observer (for expensive operations)
const debouncedObserver = createDebouncedObserver(callback, 300, options);
```

---

## Core Services (`src/services/`)

### `enrollmentService.js` - Student/Enrollment Data

```javascript
import { fetchCourseStudents, fetchUserEnrollments } from '../services/enrollmentService.js';

// Get all students in a course
const students = await fetchCourseStudents(courseId, apiClient);
// Returns: [{ id, user_id, name, sortable_name, ... }]

// Get current user's enrollments
const enrollments = await fetchUserEnrollments(apiClient);
```

---

### `pageService.js` - Canvas Pages API

```javascript
import {
    createPage,
    updatePage,
    deletePage,
    getPage
} from '../services/pageService.js';

// Create a Canvas page
const page = await createPage(courseId, apiClient, {
    title: 'Page Title',
    body: '<div>Content</div>',
    published: false
});

// Update a page
await updatePage(courseId, pageUrl, apiClient, { body: newContent });

// Delete a page
await deletePage(courseId, pageUrl, apiClient);

// Get page details
const page = await getPage(courseId, pageUrl, apiClient);
```

---

### `outcomeService.js` - Outcomes API

```javascript
import {
    getRollup,
    getOutcomeObjectByName,
    createOutcome
} from '../services/outcomeService.js';

// Get outcome rollup for a student
const rollup = await getRollup(courseId, userId);

// Find outcome by name
const outcome = await getOutcomeObjectByName(courseId, outcomeName);

// Create a new outcome
const created = await createOutcome(courseId, outcomeData);
```