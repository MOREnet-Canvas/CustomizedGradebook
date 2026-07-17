# Supporting Tools

This page covers the features that don't live on a single canvas page but run across multiple page types.

---

## Gradebook Enhancements (Teacher-Side)

**URL:** `/courses/:id/gradebook`
**Entry points:** `gradebook/ui/buttonInjection.js`, `gradebook/ui/assignmentKebabMenu.js`

### Refresh Mastery button

Injected into the gradebook toolbar for all courses. Triggers a mastery recalculation and updates outcome scores and/or final grade overrides, depending on the `ENABLE_OUTCOME_UPDATES` and `ENABLE_GRADE_OVERRIDE` configuration flags.

The button triggers the **gradebook update state machine** (`gradebook/stateMachine.js`):

```
IDLE → FETCHING_ROLLUP → CALCULATING → SUBMITTING_GRADES → VERIFYING → COMPLETE
```

### Assignment kebab menu additions

For **standards-based courses only** (detected via `courseSnapshotService.js` + `STANDARDS_BASED_COURSE_PATTERNS`), additional items are added to the assignment ⋮ (kebab) menu.

Standards-based detection flow:

1. Load or populate the course snapshot (cached in `sessionStorage`)
2. Check `snapshot.model === 'standards'`
3. If standards-based, call `initAssignmentKebabMenuInjection()`

---

## Student Grade Customization (Student-Side)

**URLs:** `/courses/:id/grades`, `/grades`, Canvas dashboard
**Entry point:** `student/studentGradeCustomization.js`

Runs for all users, but applies role-appropriate behavior based on `getUserRoleGroup()` and page detection.

### Single-course grades page (`/courses/:id/grades`)

`gradePageCustomizer.js` enhances the visual grade display:
- Reformats percentage/letter grade display
- Optionally removes the Assignments tab (`REMOVE_ASSIGNMENT_TAB = true`)
- Normalizes grade values via `gradeNormalizer.js`

### All-grades page (`/grades`)

`allGradesPageCustomizer.js` processes the multi-course grade list:
- Identifies standards-based courses by name pattern
- Reformats grade display per course type
- Adds section filtering where applicable

### Dashboard grade display

`dashboard/gradeDisplay.js` enriches Canvas dashboard course cards with grade information. Reads from course snapshots (`courseSnapshotService.js`) to avoid redundant API calls.

### Observer support

For observers (parents), `resolveTargetStudentId()` detects the observed student via the enrollment API and the grade display shows that student's data.

### Teacher-as-student view

When a teacher visits `/courses/:id/grades/:studentId`, `teacherStudentGradeCustomizer.js` applies the same grade display enhancements for that student.

### Cleanup observer

`cleanupObserver.js` uses a `MutationObserver` to detect Canvas's SPA-style navigation and revert injected DOM changes when the user navigates away. This prevents stale UI state from persisting across page transitions.

---

## SpeedGrader Integration

**URL:** `/courses/:id/gradebook/speed_grader`
**Entry points:** `speedgrader/gradingDropdown.js`, `speedgrader/speedgraderScoreSync.js`

### Grading dropdown auto-activator

`initSpeedGraderDropdown()` automatically expands the grading dropdown when SpeedGrader loads. Eliminates the repetitive click required to open the grading panel for each submission.

### SpeedGrader Score Sync

`initSpeedGraderAutoGrade()` renders a docked panel alongside SpeedGrader that:
- Reads the score entered in SpeedGrader
- Syncs it back to the relevant Canvas outcome and assignment
- Shows sync status inline

Entry: `speedgrader/scoreSyncDockedPanel.js`

No role check is performed — SpeedGrader is already restricted to teachers by Canvas.

---

## Admin Dashboard

**URL:** Any Canvas account page + `?cg_admin_dashboard=1`
**Entry point:** `admin/adminDashboard.js`

The Admin Dashboard is a **virtual page** — it piggybacks on an existing Canvas URL and activates when the `cg_admin_dashboard` query parameter is present. No dedicated Canvas route exists.

### Accessing the admin dashboard

Append `?cg_admin_dashboard=1` to any Canvas account URL:

```
https://your-canvas/accounts/1?cg_admin_dashboard=1
```

### Panels

| Panel | Module | Description |
|-------|--------|-------------|
| Account settings | `admin/accountSettingsPanel.js` | View/edit account-level settings |
| Grading schemes | `admin/gradingSchemesPanel.js` | Manage grading scheme configurations |
| Custom grade statuses | `admin/customGradeStatusPanel.js` | Configure custom grade status IDs |
| Loader generator | `admin/loaderGeneratorPanel.js` | Generate loader file for canvas injection |
| Theme status | `admin/themeStatusPanel.js` | View current brand config / theme details |
| Summary | `admin/summaryPanel.js` | Overview of installed extension state |

### Theme Editor button

When on the Canvas Theme Editor (`/accounts/:id/theme_editor`), a **"CG Tools"** button is injected into the sidebar via `admin/themeEditorInjection.js`. Clicking it opens the admin dashboard.

### Init guard

`customGradebookInit.js` runs `initAdminDashboard()` early and then checks `isAdminDashboardPage()`. If true, it returns immediately — no other CG features initialize on the admin dashboard page.

---

## Debug utilities (dev mode only)

When the extension is built in dev mode (`ENV_DEV = true`), the following functions are exposed on `window`:

| Global | Description |
|--------|-------------|
| `window.CG_testAllGradesDataSources()` | Compares all-grades data source approaches |
| `window.CG_clearAllSnapshots()` | Clears all cached course snapshots from `sessionStorage` |
| `window.CG_debugSnapshots()` | Prints all cached course snapshots |
| `window.CG_debugAssignmentDetection(courseId)` | Runs assignment detection debug for a course |

`window.CG.clearAllSnapshots` is always exposed (any build) for use during logout or user-change flows.

`exposeCGDevTools()` (`cgDevTools.js`) is runtime-gated by the debug logger — it activates whenever `?debug=true` or `sessionStorage.setItem('cg_debug','true')` is set, regardless of build mode. See [Dev Tools](../dev-tools.md) for full details.
