# Configuration

`src/config.js`

---

## Overview

All configuration constants are defined in `src/config.js` with hardcoded defaults. Every constant reads from `window.CG_CONFIG` first, falling back to the default if that key is absent.

```js
export const SOME_CONSTANT = window.CG_CONFIG?.SOME_CONSTANT ?? defaultValue;
```

**Customization without rebuilding:** The loader files (`upload_dev.js` or `loader_production.js`) run before the bundle and can set `window.CG_CONFIG` to override any constant. This means teachers or administrators can change behavior by editing only the loader — no rebuild required.

**Execution order:**

1. Loader file sets `window.CG_CONFIG`
2. Loader injects the main bundle `<script>`
3. Bundle loads; `config.js` is imported and reads `window.CG_CONFIG`
4. Constants are frozen for the page session

---

## Feature flags

| Constant | Default | Description |
|----------|---------|-------------|
| `ENABLE_STUDENT_GRADE_CUSTOMIZATION` | `true` | Master switch for the student-facing grade display customization |
| `REMOVE_ASSIGNMENT_TAB` | `false` | If `true`, hides the Assignments tab on the student grades page |
| `PER_STUDENT_UPDATE_THRESHOLD` | `25` | Max students to process concurrently during bulk grade updates |
| `MASTERY_REFRESH_ENABLED` | `true` | If `false`, skips the post-push mastery refresh API call |
| `ADMIN_DASHBOARD_ENABLED` | `true` | If `false`, the CG Admin Dashboard is never initialized |
| `ADMIN_DASHBOARD_LABEL` | `"Open Manager"` | Button label for the admin dashboard entry point |

---

## Grading mode

Three constants together control what gets written to Canvas when a grade update runs.

| Constant | Default | Description |
|----------|---------|-------------|
| `ENABLE_OUTCOME_UPDATES` | `true` | Update outcome scores (rubric criteria) and assignment grades |
| `ENABLE_GRADE_OVERRIDE` | `false` | Update the course-level final grade override (`setOverrideScore`) |
| `ENFORCE_COURSE_OVERRIDE` | `false` | If `true`, automatically enables "Allow Final Grade Override" in Canvas via API |
| `ENFORCE_COURSE_GRADING_SCHEME` | `false` | If `true`, automatically applies the selected grading scheme to the course via API |

**Supported modes:**

| Mode | `ENABLE_OUTCOME_UPDATES` | `ENABLE_GRADE_OVERRIDE` |
|------|--------------------------|------------------------|
| Outcome only | `true` | `false` |
| Override only | `false` | `true` |
| Both (full sync) | `true` | `true` |

---

## Custom grade status (OutcomeCompletionGate)

| Constant | Default | Description |
|----------|---------|-------------|
| `ENABLE_GRADE_CUSTOM_STATUS` | `false` | Master switch for the OutcomeCompletionGate state in the grading pipeline |
| `ENABLE_NEGATIVE_ZERO_COUNT` | `false` | When gate fails: `true` sets `overrideScore = -zeroCount`; `false` sets `overrideScore = null` |
| `DEFAULT_CUSTOM_STATUS_ID` | `null` | Canvas custom grade status ID applied when gate fails |
| `USE_UNIFIED_GRAPHQL_ONLY` | `false` (auto `true` if `ENABLE_GRADE_CUSTOM_STATUS`) | Skip the REST/bulk pipeline and use the unified GraphQL mutation path |

> **Auto-enable:** `USE_UNIFIED_GRAPHQL_ONLY` is automatically set to `true` if `ENABLE_GRADE_CUSTOM_STATUS` is `true`, because custom status requires GraphQL. This auto-enable logs a console message at startup. Override explicitly via `window.CG_CONFIG.USE_UNIFIED_GRAPHQL_ONLY` if needed.

---

## Grade scaling

| Constant | Default | Description |
|----------|---------|-------------|
| `OVERRIDE_SCALE` | `avg => Number((avg * 25).toFixed(2))` | Function that converts 0–4 Marzano average to 0–100 Canvas override percentage |

The default maps the 0–4 scale linearly to 0–100 (multiply by 25). To use a different scale (e.g. 0–4 → 0–40 for a 40-point scheme), set a custom function in `window.CG_CONFIG.OVERRIDE_SCALE`.

---

## UI labels

| Constant | Default | Description |
|----------|---------|-------------|
| `UPDATE_AVG_BUTTON_LABEL` | `"Update Current Score"` | Label on the button that triggers avg assignment update |
| `AVG_OUTCOME_NAME` | `"Current Score"` | Title of the outcome representing the class average |
| `AVG_ASSIGNMENT_NAME` | `"Current Score Assignment"` | Name of the Canvas assignment used for avg grade posting |
| `AVG_RUBRIC_NAME` | `"Current Score Rubric"` | Name of the rubric attached to the avg assignment |

---

## PL override assignment naming

PL override assignments are named `"<Outcome Name> — <PL_ASSIGNMENT_SUFFIX>"`.

| Constant | Default | Example result |
|----------|---------|---------------|
| `PL_ASSIGNMENT_SUFFIX` | `'Projected Score'` | `"Argumentative Writing — Projected Score"` |
| `PL_RUBRIC_SUFFIX` | `'Projected Score Rubric'` | `"Argumentative Writing — Projected Score Rubric"` |

Common alternatives: `'Growth Score'`, `'Current Level'`, `'Trend Score'`, `'Marzano Score'`.

---

## PL assignment grading

| Constant | Default | Description |
|----------|---------|-------------|
| `PL_GRADING_TYPE` | `'gpa_scale'` | Canvas grading type for PL override assignments. Supported: `pass_fail`, `percent`, `letter_grade`, `gpa_scale`, `points`, `not_graded` |
| `PL_GRADING_SCHEME_ID` | `null` | Canvas grading standard ID attached to PL assignments. `null` uses the course-level default |

> **Validation:** If `PL_GRADING_TYPE` is set to an unsupported value, a `console.warn` is emitted at startup. Canvas will return 400 if an invalid value is sent to the assignments API.

---

## Outcome configuration

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_MAX_POINTS` | `4` | Default `points_possible` for auto-created outcomes and rubric criteria |
| `DEFAULT_MASTERY_THRESHOLD` | `3` | Mastery threshold used when creating outcomes via CSV import |
| `OUTCOME_AND_RUBRIC_RATINGS` | 9-level scale (see below) | Rating levels for auto-created outcomes and rubrics |

**Default rating scale** (9 levels, 0–4):

| Points | Description |
|--------|-------------|
| 4 | Exemplary |
| 3.5 | Beyond Target |
| 3 | Target |
| 2.5 | Approaching Target |
| 2 | Developing |
| 1.5 | Beginning |
| 1 | Needs Partial Support |
| 0.5 | Needs Full Support |
| 0 | Insufficient Evidence |

---

## Outcome filtering

| Constant | Default | Description |
|----------|---------|-------------|
| `EXCLUDED_OUTCOME_KEYWORDS` | `[]` | Outcome title substrings to exclude from grade averaging. Case-insensitive match. Example: `["attendance", "behavior"]` |

---

## Grading scheme

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_GRADING_SCHEME_ID` | `null` | Canvas grading standard ID for auto-created assignments |
| `DEFAULT_GRADING_TYPE` | `'points'` | Grading type for auto-created assignments |

---

## Course detection

| Constant | Default | Description |
|----------|---------|-------------|
| `STANDARDS_BASED_COURSE_PATTERNS` | See below | Array of strings or RegExp objects matched against course names to identify standards-based courses (shown differently on the all-grades page) |

**Default patterns:** `"Standards Based"`, `"SBG"`, `"Mastery"`, `/\[SBG\]/i`, `/^SBG[-\s]/i`

Both string patterns (case-insensitive substring match) and `RegExp` objects are supported.

---

## Timing

| Constant | Default | Description |
|----------|---------|-------------|
| `MASTERY_REFRESH_DELAY_MS` | `5000` | Milliseconds to wait for Canvas to propagate `points_possible` changes before the mastery refresh step reverts the value to `0` |

---

## Gotchas

- **`window.CG_CONFIG` must be set before the bundle loads** — the loader sets it synchronously before injecting the `<script>` tag. If the bundle loads first, all constants read `undefined` from `CG_CONFIG` and fall back to defaults.
- **`OVERRIDE_SCALE` must be a function** — passing a number instead of a function will throw at runtime when `OVERRIDE_SCALE(avg)` is called.
- **`USE_UNIFIED_GRAPHQL_ONLY` auto-enable** — setting `ENABLE_GRADE_CUSTOM_STATUS=true` without explicitly setting `USE_UNIFIED_GRAPHQL_ONLY` will auto-enable it. If you want `ENABLE_GRADE_CUSTOM_STATUS=true` but still use the REST pipeline, you must explicitly set `USE_UNIFIED_GRAPHQL_ONLY: false` in `window.CG_CONFIG`.
- **`EXCLUDED_OUTCOME_KEYWORDS` is an empty array by default** — no outcomes are excluded. If your courses include non-academic outcomes (attendance, behavior), add those keywords to prevent them from skewing the calculated average.
- **Console logs at startup** — `config.js` always logs `ENABLE_GRADE_CUSTOM_STATUS` and `USE_UNIFIED_GRAPHQL_ONLY` to the browser console. This is intentional for operator visibility and not gated by the debug logger.
