# Page Detection

`src/utils/pageDetection.js` · `src/utils/canvas.js` · `src/admin/pageDetection.js`

---

## Overview

The extension must behave differently on every Canvas page type. Three files provide the page-detection and user-identity layer:

- **`src/utils/pageDetection.js`** — the main detection library. All URL-based and ENV-based predicates live here.
- **`src/utils/canvas.js`** — course ID extraction and role-group detection.
- **`src/admin/pageDetection.js`** — admin-specific predicates (Theme Editor, CG Admin Dashboard).

All predicates read `window.location` and/or `window.ENV` synchronously. They are pure functions that return `boolean` (or `string|null` for extractors) and have no side effects.

---

## `src/utils/pageDetection.js`

### Page predicates

| Function | URL pattern matched | Key exclusion | Detection method |
|----------|-------------------|--------------|-----------------|
| `isDashboardPage()` | `/`, `/dashboard`, `/dashboard/*` | — | `pathname === '/'` or `startsWith('/dashboard')` |
| `isAllGradesPage()` | `/grades`, `/users/:id/grades` | `/courses/` in path | `includes('/grades') && !includes('/courses/')` |
| `isSingleCourseGradesPage()` | `/courses/:id/grades` | — | `href includes '/courses/'` AND `pathname includes '/grades'` |
| `isCoursePageNeedingCleanup()` | `/courses/:id/grades`, `/courses/:id/assignments`, `/courses/:id` (root only) | `/modules`, `/settings`, other sub-pages | Three-condition OR with regex for exact course root |
| `isTeacherViewingStudentGrades()` | `/courses/:id/grades/:studentId` | `/courses/:id/grades` (no student ID) | Regex `/^\/courses\/\d+\/grades\/\d+/` |
| `isGradebookPage()` | `/courses/:id/gradebook` | `/speed_grader` in path | `includes('/gradebook') && !includes('/speed_grader')` |
| `isLMGBPage()` | Same URL as gradebook | — | `ENV.GRADEBOOK_OPTIONS` inspection (see below) |
| `isSpeedGraderPage()` | `/courses/:id/gradebook/speed_grader` | — | `includes('/speed_grader')` |
| `isCourseSettingsPage()` | `/courses/:id/settings` | — | Regex `/^\/courses\/\d+\/settings/` |
| `isMasteryOutlookPage()` | `/courses/:id/pages/mastery-outlook` and auto-numbered variants | — | `includes('/pages/mastery-outlook')` |
| `isCoursePage()` | `/courses/:id` and all sub-paths | `/courses` list page | Regex `/^\/courses\/\d+/` |

> **`isLMGBPage` gotcha** — LMGB and the traditional gradebook share `/courses/:id/gradebook`. URL detection alone cannot tell them apart. `isLMGBPage` inspects `ENV.GRADEBOOK_OPTIONS`:
>
> 1. **Primary:** `ENV.GRADEBOOK_OPTIONS.settings.gradebook_view === 'learning_mastery'`
> 2. **Fallback:** `ENV.GRADEBOOK_OPTIONS.outcome_proficiency` exists (LMGB-only property)

---

### `waitForSettingsSidebar(callback, tag?)` → `void`

Polls every 300 ms (up to 33 attempts ≈ 10 s) until:

1. `isCourseSettingsPage()` is true
2. `document.readyState === 'complete'`
3. A sidebar element is found: `#right-side` → `#right-side-wrapper` → `aside[id="right-side"]`

When all three conditions are met, clears the interval and calls `callback(sidebarElement)`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `callback` | `Function` | required | Called with the sidebar `HTMLElement` |
| `tag` | `string` | `'Settings'` | Log prefix for diagnostic messages |

---

### `getStudentIdFromUrl()` → `string|null`

Extracts the student ID from the teacher-viewing-student-grades URL pattern `/courses/:courseId/grades/:studentId`. Returns `null` if the pattern does not match.

---

### `resolveTargetStudentId(courseId?, apiClient?)` → `Promise<string|null>`

Determines the correct student to load grades for, handling three roles:

| Priority | Scenario | Source |
|----------|----------|--------|
| 1 | Teacher viewing a specific student | URL (`getStudentIdFromUrl`) |
| 2 | Observer (parent) viewing an observed student | Canvas enrollment API (`associated_user_id`) |
| 3 | Student viewing their own grades | `ENV.current_user_id` |

`courseId` and `apiClient` are required for observer detection (scenario 2). If omitted, observer check is skipped and the function falls through to scenario 3.

Returns `null` if no user ID can be determined.

---

## `src/utils/canvas.js`

### `getCourseId()` → `string|null`

Returns the current course ID using two methods in priority order:

1. `ENV.COURSE_ID` (Canvas global)
2. `extractCourseIdFromHref(window.location.pathname)` — regex `/^\/courses\/(\d+)\b/`

Returns `null` and logs an error if neither source has a value.

---

### `extractCourseIdFromHref(href)` → `string|null`

Extracts a course ID from any URL or `href` string containing `/courses/:id`. Returns `null` if the pattern does not match.

```js
extractCourseIdFromHref('/courses/512/grades')  // → '512'
extractCourseIdFromHref('/dashboard')           // → null
```

---

### `getUserRoleGroup()` → `'teacher_like' | 'student_like' | 'other'`

Collapses Canvas's multi-value role system into three groups. Result is memoized in `sessionStorage` keyed by `roleGroup_<userId>`.

**Input sources** (all merged into one `Set` before classification):

- `ENV.current_user_roles[]`
- `ENV.current_user_types[]`
- `ENV.current_user_is_admin`, `ENV.current_user_is_student`, `ENV.current_user_is_teacher`, `ENV.current_user_is_observer`

**Classification** (teacher-like check runs first):

| Group | Roles that match |
|-------|----------------|
| `teacher_like` | `teacher`, `admin`, `root_admin`, `designer`, `ta`, `accountadmin` |
| `student_like` | `student`, `observer` |
| `other` | Everything else |

> **Gotcha** — Teacher-like check is intentionally evaluated first. A user who is both a teacher and a student (e.g. an admin enrolled as a student) will be classified as `teacher_like`. This prevents teacher-only features from being incorrectly hidden.

A debug snapshot `roleGroup_debug_<userId>` is also written to `sessionStorage` with the full `{ userId, normRoles, decided }` object for troubleshooting.

---

## `src/admin/pageDetection.js`

### Predicates

| Function | Detection method |
|----------|----------------|
| `isThemeEditorPage()` | Regex `/^\/accounts\/\d+\/theme_editor/` on `pathname` |
| `isAdminDashboardPage()` | `URLSearchParams` has `cg_admin_dashboard` query param |

### Extractors

| Function | Source | Returns |
|----------|--------|---------|
| `getAccountId()` | `ENV.ACCOUNT_ID` | `string \| null` |
| `getInstalledThemeJsUrl()` | `ENV.active_brand_config.js_overrides` | `string` (empty string if absent) |
| `getInstalledThemeCssUrl()` | `ENV.active_brand_config.css_overrides` | `string` (empty string if absent) |
| `getBrandConfigMetadata()` | `ENV.active_brand_config` | `{ md5, created_at }` |

The CG Admin Dashboard is a **virtual page** — it reuses an existing Canvas URL and adds `?cg_admin_dashboard=1` as a query parameter. There is no dedicated Canvas route for it.

---

## How page detection drives initialization

`src/customGradebookInit.js` orchestrates the startup sequence. The detection call order is:

```
isDashboardPage()             → dashboard grade customization
isGradebookPage()             → gradebook grade injection
isSpeedGraderPage()           → SpeedGrader integration
isTeacherViewingStudentGrades() → teacher-view-as-student mode
isCourseSettingsPage()        → Mastery Outlook settings sidebar
isAdminDashboardPage()        → admin virtual dashboard
```

Each predicate gates an `init*` function call. If none match, the init exits silently.

---

## Gotchas

- **`isSingleCourseGradesPage` vs `isTeacherViewingStudentGrades`** — both match `/courses/:id/grades/*`. Call `isTeacherViewingStudentGrades` first (more specific pattern). If order is reversed, the teacher-viewing-student case will be misidentified as a plain grades page.
- **`isLMGBPage` reads `ENV` at call time** — Canvas sets `ENV.GRADEBOOK_OPTIONS` synchronously before the page JS runs, so it is safe to call at startup. However, if the user navigates within a SPA-like gradebook without a full page reload, the ENV may not update and the predicate could return stale results.
- **`getUserRoleGroup` sessionStorage cache** — cached for the entire browser session. If a user's roles change during the session (e.g. an admin removes their teacher role in another tab), the cached role group will not update until the session ends or `sessionStorage` is cleared.
- **`isMasteryOutlookPage` matches all auto-numbered variants** — Canvas auto-increments the URL slug (`mastery-outlook-2`, `mastery-outlook-3`) if a page already exists at the base slug. The `includes('/pages/mastery-outlook')` check handles all variants, but it also matches any page whose URL contains `mastery-outlook` as a substring.
