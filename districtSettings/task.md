# District Settings — Build Task List

## Overview
Build a single standalone hand-crafted HTML file at `src/districtSettings/districtSettings.html`: a self-contained Canvas wiki deliverable (inline CSS + inline JS, zero external dependencies) that reads/writes a district config JSON on a Canvas `district-config` wiki page and renders an 8-section settings UI. It is pasted into the Canvas HTML editor and exported as `.imscc` — it is NOT built or deployed.

**Hard constraints:** Create only the one new file. Do NOT add it to `esbuild.config.js`. Do NOT import it anywhere. Do NOT modify ANY existing file (including `esbuild.config.js` and `package.json`).

## Task Breakdown

### Builder A — Scaffold, CSS design system, and data layer

#### Scaffold
- [ ] Add `<!DOCTYPE html>` + full `<html>`/`<head>`/`<body>` so it opens locally in a browser.
- [ ] Put all CSS in one inline `<style>` block in `<head>`; all JS in one inline `<script>` at the bottom of `<body>`. No CDN links, no imports, no script fetches.

#### Body layout containers
- [ ] Outer shell: CSS grid, `220px` sidebar + `1fr` main, `min-height: 100vh`.
- [ ] Sidebar (white bg, `0.5px` right border `#C7CDD1`, padding 0) with logo area (`padding 20px 16px 16px`, `0.5px` bottom border) and a nav list.
- [ ] Main column: flex column with sticky topbar (`padding 14px 20px`, `0.5px` bottom border, flex space-between: title + district name left, save button right) + scrollable content area (`padding 20px`, flex column `gap 16px`).
- [ ] Content root element `#cg-district-settings-root`.
- [ ] Hidden config div consumed at runtime: `<div id="cg-district-config" style="display:none">...</div>`.

#### CSS design system (exact values)
- [ ] Colors: primary `#185FA5`, success `#0F6E56`, text `#2D3B45`, text-secondary `#6b7785`, text-tertiary `#9aa5b0`, border `#C7CDD1` at `0.5px`, page bg `#f5f5f5`, surface `#ffffff`, secondary bg `#F5F5F5`.
- [ ] Status colors: success bg `#F6FFED`/border `#B7EB8F`; warning bg `#FFF7E6`/border `#F3D19E`; error bg `#FFF1F0`/border `#FFA39E`; info bg `#F0F7FF`/border `#0374B5`.
- [ ] Typography: font `system-ui, -apple-system, sans-serif`; body `14px`/`1.5`; labels `11px`/weight `500`/text-secondary; hints `11px`/text-tertiary; code `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- [ ] Nav items: `36px` tall, `8px` horizontal / `7px` vertical padding, `border-radius 6px`, `13px` font, `gap 8px` icon+label, active = white bg + primary text.
- [ ] Summary bar: 2x2 grid, `gap 10px`. Metric cards: bg `#F5F5F5`, `border-radius 8px`, `padding 12px 14px`, `11px` muted label, `18px`/`500` value.
- [ ] Panels: `0.5px` border `#C7CDD1`, `border-radius 12px`, white bg, `overflow hidden`. Header: `padding 12px 16px`, flex space-between, `13px`/`500`, hover bg `#F5F5F5`, cursor pointer, chevron on right. Body: `padding 16px`, `0.5px` top border, hidden when collapsed.
- [ ] Toggle rows: flex space-between, `padding 8px 0`, `0.5px` bottom border on all but last.
- [ ] Toggle switch: `32px` wide × `18px` tall, `border-radius 99px`, gray off / `#185FA5` on, white `12px` circle thumb sliding left/right.
- [ ] Field labels: `11px`/`500`/`#6b7785`/`margin-bottom 4px`. Inputs & selects: `12px` font, `6px 8px` padding, `0.5px` border `#C7CDD1`, `border-radius 6px`, full width.
- [ ] Code block: bg `#F5F5F5`, `0.5px` border, `border-radius 6px`, `padding 14px`, monospace `12px`, `line-height 1.8`, `position relative`. Copy button: absolute top-right, `11px` font, small padding, secondary style.
- [ ] Step list: flex column `gap 6px`, `12px` font, muted; step number tertiary color `min-width 14px`.
- [ ] Save button: Button--primary, blue bg, white text, `padding 6px 16px`, `border-radius 6px`, `13px` font.

#### Data layer (`<script>`)
- [ ] `DEFAULTS` config object with EVERY key/default: `ENABLE_STUDENT_GRADE_CUSTOMIZATION:true`, `ENABLE_GRADE_OVERRIDE:true`, `ENFORCE_COURSE_OVERRIDE:false`, `ENFORCE_COURSE_GRADING_SCHEME:false`, `ENABLE_GRADE_CUSTOM_STATUS:false`, `ENABLE_NEGATIVE_ZERO_COUNT:false`, `UPDATE_AVG_BUTTON_LABEL:'Update Current Score'`, `AVG_OUTCOME_NAME:'Current Score'`, `AVG_ASSIGNMENT_NAME:'Current Score Assignment'`, `AVG_RUBRIC_NAME:'Current Score Rubric'`, `DEFAULT_MAX_POINTS:4`, `DEFAULT_MASTERY_THRESHOLD:3`, `EXCLUDED_OUTCOME_KEYWORDS:[]`, `DEFAULT_GRADING_TYPE:'letter_grade'`, `DEFAULT_GRADING_SCHEME_ID:null`, `ENABLE_ACCOUNT_FILTER:false`, `ALLOWED_ACCOUNT_IDS:[]`, `DEFAULT_CUSTOM_STATUS_ID:null`.
- [ ] Runtime state object (current config) seeded from `DEFAULTS`.
- [ ] Parse courseId from `window.location.pathname` via `/\/courses\/(\d+)/`; fallback to `'COURSE_ID'`.
- [ ] Read CSRF token: `document.querySelector('meta[name="csrf-token"]')?.content` OR parse `document.cookie` for `_csrf_token`.
- [ ] `GET /api/v1/courses/{courseId}/pages/district-config`; on failure/404 use defaults silently.
- [ ] Extract JSON from `#cg-district-config` div text content and merge over defaults.
- [ ] PUT save: `PUT /api/v1/courses/{courseId}/pages/district-config`, headers `{ 'Content-Type':'application/json', 'X-CSRF-Token': csrfToken }`, body `JSON.stringify({ wiki_page: { body: '<div id="cg-district-config" style="display:none">' + JSON.stringify(config) + '</div>' } })`.
- [ ] Save transforms: `EXCLUDED_OUTCOME_KEYWORDS`/`ALLOWED_ACCOUNT_IDS` split CSV; empty `DEFAULT_GRADING_SCHEME_ID` → `null`; empty `DEFAULT_CUSTOM_STATUS_ID` → `null`.
- [ ] Inline save feedback (success/error) — NO `alert()` anywhere.
- [ ] Clearly-named stub render functions for Builder B (e.g. `renderSummary`, `renderFeatureFlags`, `renderLabels`, `renderOutcomeConfig`, `renderGrading`, `renderAccountFilter`, `renderCustomStatus`, `renderCanvasLoader`, `renderSidebar`).

### Builder B — UI rendering and interactions

#### Sections
- [ ] **Summary**: 2x2 metric cards — Active version (hardcoded `'district config'`), Grade override (enabled/disabled from `ENABLE_GRADE_OVERRIDE`), Account filter (count of `ALLOWED_ACCOUNT_IDS` or `'off'`), Custom status (ID or `'none'`).
- [ ] **Feature flags**: 6 toggle rows (label + hint + toggle), exact labels/hints:
    - [ ] `ENABLE_STUDENT_GRADE_CUSTOMIZATION` → 'Student grade customization' / 'Allows per-student grade overrides in the gradebook'
    - [ ] `ENABLE_GRADE_OVERRIDE` → 'Grade override' / 'Requires final grade override feature flag on the Canvas account'
    - [ ] `ENFORCE_COURSE_OVERRIDE` → 'Enforce course override' / 'Sets course override via API on every sync'
    - [ ] `ENFORCE_COURSE_GRADING_SCHEME` → 'Enforce grading scheme' / 'Sets grading scheme via API on every sync'
    - [ ] `ENABLE_GRADE_CUSTOM_STATUS` → 'Custom grade statuses' / 'Apply custom status labels when outcomes lack evidence'
    - [ ] `ENABLE_NEGATIVE_ZERO_COUNT` → 'Zero grade penalty' / 'Each zero subtracts 1 from the score'
- [ ] **Labels**: 4 text inputs (UPDATE_AVG_BUTTON_LABEL, AVG_OUTCOME_NAME, AVG_ASSIGNMENT_NAME, AVG_RUBRIC_NAME) in single-column layout.
- [ ] **Outcome config**: DEFAULT_MAX_POINTS + DEFAULT_MASTERY_THRESHOLD side by side (number, `min 1`); EXCLUDED_OUTCOME_KEYWORDS full width below (CSV text, joined with `', '` for display).
- [ ] **Grading**: DEFAULT_GRADING_TYPE select (options `letter_grade`, `gpa_scale`, `points`) + DEFAULT_GRADING_SCHEME_ID number input, side by side.
- [ ] **Account filter**: ENABLE_ACCOUNT_FILTER toggle + ALLOWED_ACCOUNT_IDS CSV input shown only when toggle is on.
- [ ] **Custom status**: DEFAULT_CUSTOM_STATUS_ID text input.
- [ ] **Canvas loader**: header explainer; courseId in monospace badge (from URL); pre-filled code block (exact snippet below); copy button (plain-text copy + 2s checkmark); divider; 3 numbered steps (exact text below).

#### Interactions
- [ ] Sidebar nav: clicking an item scrolls to and expands that section, collapsing all others.
- [ ] Toggle switch behavior (thumb slides, on/off color, updates state).
- [ ] Conditional ALLOWED_ACCOUNT_IDS visibility tied to ENABLE_ACCOUNT_FILTER.
- [ ] Copy-to-clipboard with `✓`/checkmark feedback for 2 seconds.
- [ ] Save button states: 'Saving...' (disabled) → '✓ Saved' (green, brief) → normal; on error show inline message below topbar and restore button.
- [ ] Summary metric cards refresh immediately on save.

## Verification Checklist

### Structure & dependencies
- [ ] Only `src/districtSettings/districtSettings.html` created; no other files added/modified.
- [ ] `esbuild.config.js` and `package.json` untouched; file not imported anywhere.
- [ ] `<!DOCTYPE html>` + full `<html>`/`<head>`/`<body>` present.
- [ ] All CSS inline in `<head>` `<style>`; all JS inline in bottom-of-body `<script>`.
- [ ] No external deps: no CDN links, no imports, no script fetches.
- [ ] No `alert()` calls anywhere; no icon fonts (Unicode icons only).

### Runtime / data layer
- [ ] courseId parsed via `/\/courses\/(\d+)/` with `'COURSE_ID'` fallback.
- [ ] CSRF via `meta[name="csrf-token"]` content OR `_csrf_token` cookie.
- [ ] `GET /api/v1/courses/{courseId}/pages/district-config`; silent defaults on failure/404.
- [ ] JSON parsed from `#cg-district-config` div text content.
- [ ] `PUT /api/v1/courses/{courseId}/pages/district-config` with headers `Content-Type: application/json` + `X-CSRF-Token`.
- [ ] PUT body exactly `{ wiki_page: { body: '<div id="cg-district-config" style="display:none">' + JSON.stringify(config) + '</div>' } }`.
- [ ] Save transforms: keywords/account IDs CSV split; empty grading-scheme-id → null; empty custom-status-id → null.

### Config keys & defaults
- [ ] Flags: ENABLE_STUDENT_GRADE_CUSTOMIZATION=true, ENABLE_GRADE_OVERRIDE=true, ENFORCE_COURSE_OVERRIDE=false, ENFORCE_COURSE_GRADING_SCHEME=false, ENABLE_GRADE_CUSTOM_STATUS=false, ENABLE_NEGATIVE_ZERO_COUNT=false.
- [ ] Labels: UPDATE_AVG_BUTTON_LABEL='Update Current Score', AVG_OUTCOME_NAME='Current Score', AVG_ASSIGNMENT_NAME='Current Score Assignment', AVG_RUBRIC_NAME='Current Score Rubric'.
- [ ] Outcome: DEFAULT_MAX_POINTS=4 (min 1), DEFAULT_MASTERY_THRESHOLD=3 (min 1), EXCLUDED_OUTCOME_KEYWORDS=[] (CSV, joined `', '` for display).
- [ ] Grading: DEFAULT_GRADING_TYPE='letter_grade' (options letter_grade/gpa_scale/points), DEFAULT_GRADING_SCHEME_ID=null.
- [ ] Account filter: ENABLE_ACCOUNT_FILTER=false, ALLOWED_ACCOUNT_IDS=[].
- [ ] Custom status: DEFAULT_CUSTOM_STATUS_ID=null.

### Feature-flag labels/hints (all 6 exact — see Builder B list)
- [ ] All 6 human-readable labels + hints match spec verbatim.

### Sections content
- [ ] Summary: 4 cards (active version 'district config', grade override status, account filter count/'off', custom status ID/'none').
- [ ] Labels: 4 text inputs, single column.
- [ ] Outcome: max points + mastery side by side; keywords full width below.
- [ ] Grading: type select + scheme id side by side.
- [ ] Account filter: toggle + conditional CSV input.
- [ ] Custom status: single text input.
- [ ] Canvas loader: explainer header, monospace courseId badge, code block, copy button (2s checkmark), divider, 3 numbered steps.

### Canvas loader snippet (exact)
- [ ] `var CG_DISTRICT_COURSE = '{courseId}';`
- [ ] `var CG_BASE = 'https://cdn.morenet.net/cg/';`
- [ ] `var s = document.createElement('script');`
- [ ] `s.src = CG_BASE + 'dist/main.js';`
- [ ] `document.head.appendChild(s);`
- [ ] Steps: 1 'Copy the snippet above'; 2 'In Canvas go to Admin → Themes → Edit theme → JavaScript file'; 3 'Paste and save — teachers will pick up district settings automatically'.

### Styling — colors
- [ ] #185FA5, #0F6E56, #2D3B45, #6b7785, #9aa5b0, #C7CDD1 (0.5px), #f5f5f5, #ffffff, #F5F5F5.
- [ ] Status: #F6FFED/#B7EB8F, #FFF7E6/#F3D19E, #FFF1F0/#FFA39E, #F0F7FF/#0374B5.

### Styling — typography
- [ ] Font `system-ui, -apple-system, sans-serif`; body 14px/1.5; labels 11px/500/secondary; hints 11px/tertiary; code `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.

### Styling — layout dimensions
- [ ] Shell grid 220px sidebar + 1fr, min-height 100vh; sidebar white + 0.5px right border; logo area padding 20px 16px 16px + 0.5px bottom border.
- [ ] Nav items 36px tall, 8px/7px padding, radius 6px, 13px, gap 8px, active white bg + primary text.
- [ ] Topbar sticky, padding 14px 20px, 0.5px bottom border, flex space-between; content area padding 20px, gap 16px.
- [ ] Summary 2x2 grid gap 10px; metric cards bg #F5F5F5 radius 8px padding 12px 14px, 11px label, 18px/500 value.
- [ ] Panels 0.5px border radius 12px white overflow hidden; header padding 12px 16px, 13px/500, hover #F5F5F5, chevron; body padding 16px + 0.5px top border, hidden when collapsed.
- [ ] Toggle rows flex space-between padding 8px 0, 0.5px bottom border (not last); toggle switch 32x18 radius 99px, gray off / #185FA5 on, 12px white thumb.
- [ ] Field labels 11px/500/#6b7785/mb 4px; inputs/selects 12px, 6px 8px padding, 0.5px border, radius 6px, full width.
- [ ] Code block bg #F5F5F5, 0.5px border, radius 6px, padding 14px, monospace 12px, line-height 1.8, position relative; copy button absolute top-right, 11px, secondary.
- [ ] Step list flex column gap 6px, 12px muted, step number tertiary min-width 14px; save button blue/white padding 6px 16px radius 6px 13px.

### Icons & interactions
- [ ] Unicode icons used: ▶ ▼ (chevrons), ✓ (success), ⎘ or 'Copy' (copy).
- [ ] Sidebar nav scroll+expand-one / collapse-others.
- [ ] Toggle behavior, conditional account-filter visibility, copy 2s checkmark.
- [ ] Save states: 'Saving...' (disabled) → '✓ Saved' (green) → normal; inline error below topbar on failure.
- [ ] Summary cards refresh immediately on save.

### Do not touch
- [ ] No existing file modified; esbuild.config.js, package.json, and all other files untouched.