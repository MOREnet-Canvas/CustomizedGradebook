# District Settings — Spec

## Overview

`districtSettings/districtSettings.html` is a single standalone hand-crafted HTML file: a self-contained Canvas wiki deliverable (inline CSS + inline JS, zero external dependencies). It is pasted directly into the `[District Settings]` page body in the district config course. It is NOT built or deployed — it is entirely outside the esbuild pipeline and is never touched by `deploy-dev.js`, `deploy-prod.js`, or `release.js`.

It manages a separate storage artifact, `district_config.json`, uploaded via the Canvas Files API into the same course (`MOREnet_CustomizedGradebook/district_config/district_config.json`). That file is what `src/services/districtConfigService.js` reads at runtime in the bundled extension.

**Hard constraints:** Do NOT add this file to `esbuild.config.js`. Do NOT import it anywhere. Do NOT modify `package.json`. No CDN links, no build step, no `alert()` calls — inline feedback only.

## Per-key lock model

This is the core mechanic, modeled on Canvas's native Feature Flags UI (toggle switch + small padlock icon per row). Each setting has two independent values:

- **Locked** — the district `value` wins outright for every course, regardless of any per-course value.
- **Unlocked** — the district `value` is only a fallback default; a per-course value would take precedence if one existed.

**No per-course settings store exists yet** (as of this writing). This means `perCourseValue` is always absent at every call site today, so **unlocked currently behaves identically to locked in practice** — the district value applies either way. This is expected, not a defect. It will start to matter once a per-course store is built as separate, later work.

## Round 1 settings (exact keys, defaults, labels/hints)

Scoped to four existing plain booleans, chosen because they already exist with clear defaults on both `src/config.js` and the admin dashboard's `src/admin/data/defaultConfigConstants.js`. Labels/hints below are reused verbatim from `src/config.js`'s own comments.

| Key | Default | Label | Hint |
|---|---|---|---|
| `ENFORCE_COURSE_OVERRIDE` | `false` | Enforce course override | Sets course override via API on every sync |
| `ENFORCE_COURSE_GRADING_SCHEME` | `false` | Enforce grading scheme | Sets grading scheme via API on every sync |
| `ENABLE_GRADE_CUSTOM_STATUS` | `false` | Custom grade statuses | Apply custom status labels when outcomes lack evidence |
| `ENABLE_NEGATIVE_ZERO_COUNT` | `false` | Zero grade penalty | Each zero subtracts 1 from the score |

**Known gap:** `ENABLE_NEGATIVE_ZERO_COUNT` has no runtime call site anywhere in the codebase yet — `src/config.js`'s own comment describes an `overrideScore = -zeroCount` behavior that was never actually implemented. It's included here for round-1 UI/schema completeness (so the toggle+lock pattern is proven out for all four), but there is currently nothing in the bundled extension that reads its resolved value. Wiring it is future work once (or if) the underlying gate logic is built.

Deferred to a later round: grading scheme objects, rating scales, and other free-text/complex-shaped settings — those need a different (likely nested-JSON) editing UI.

## Storage: Canvas Files API — unlocked, `visibility_level: 'institution'`

This deviates from the pattern `src/masteryOutlook/masteryOutlookCacheService.js` uses for its own cache file, on purpose:

- Confirmed by live testing on `morenetlab` course 581 with an unenrolled student test account: a **locked** file blocks institution-visibility reads even for authenticated students — Canvas checks the `locked` flag before `visibility_level` and blocks regardless of the visibility setting underneath. Locked + `visibility_level: institution` cannot coexist.
- District config needs to be readable by students eventually (a student-facing gradebook display toggle is a known future use case), so the file — and both folders in its path (`MOREnet_CustomizedGradebook`, `district_config`) — are created and kept **unlocked**.
- This is safe: locking was never the write-protection mechanism. It only controls read visibility. Write access is governed by the district course's `manage_files` permission, which already restricts writes to whoever has an actual admin/teacher/designer role in that course. Leaving the file unlocked doesn't open a write path that wasn't already closed by the permissions model.
- After the 3-step upload, an explicit follow-up `PUT /api/v1/files/{id}` sets `visibility_level: 'institution'` — this is not set by default on upload and needs its own call.

## File shape (`district_config.json`)

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-08-26T00:00:00.000Z",
  "settings": {
    "ENFORCE_COURSE_OVERRIDE": { "value": false, "locked": false },
    "ENFORCE_COURSE_GRADING_SCHEME": { "value": false, "locked": false },
    "ENABLE_GRADE_CUSTOM_STATUS": { "value": false, "locked": false },
    "ENABLE_NEGATIVE_ZERO_COUNT": { "value": false, "locked": false }
  }
}
```

- `schemaVersion` mismatch or absence → treated as malformed; readers fall back to defaults silently, never throw.
- A key **absent** from `settings` → no district opinion for that key; resolvers fall through to `perCourseValue ?? fallbackDefault`. This makes adding a new lockable key later backward-compatible with older stored files.
- Key names are exactly `src/config.js`'s export names, not `defaultConfigConstants.js`'s `DEFAULT_`-prefixed names.

## Data layer (`<script>`)

- Course ID parsed from `window.location.pathname` via `/\/courses\/(\d+)/`; fallback `'COURSE_ID'`.
- CSRF: hand-lifted from `src/utils/canvasApiClient.js`'s cookie-reading logic (`document.cookie` split/trim/match on `_csrf_token`, `X-CSRF-Token` header, `authenticity_token` body field). `safeFetch`/`safeJsonParse`/`logger` are intentionally not ported — this file can't import anything, so plain `fetch`/`console` are used instead.
- Read: search `/api/v1/courses/{courseId}/files` for `district_config.json`, download via the returned file `url`, `JSON.parse`, validate `schemaVersion`. Any failure (not found, non-OK download, malformed JSON, schema mismatch) → keep defaults silently.
- Write: standard Canvas 3-step upload (`POST .../files` for upload instructions → `FormData` POST to `upload_url` → `PUT /api/v1/files/{id}` to finalize with `locked: false, hidden: false, visibility_level: 'institution'`).
- Folders (`MOREnet_CustomizedGradebook` → `district_config`) are found-or-created idempotently, never locked.
- Inline save feedback only (success/error) — no `alert()`.

## Sections

- **Summary** — one metric card per round-1 setting, showing on/off plus a 🔒 marker when locked.
- **Feature flags** — one row per round-1 setting: label + hint, a value toggle, and a padlock button (🔒 locked / 🔓 unlocked) that flips lock state independently of the value.
- **Canvas loader** — unchanged from the original design: courseId badge from URL, minimal loader snippet (`CG_DISTRICT_COURSE` + plain `<script src>` injection, no generated config block), copy button, 3 numbered steps.

Removed from the original prototype (out of round-1 scope, no longer fit the new schema): Labels, Outcome config, Grading, Account filter, Custom status sections. These referenced settings that aren't part of round 1 and had their own drifted key shapes (e.g. an invented `ENABLE_ACCOUNT_FILTER`/`ALLOWED_ACCOUNT_IDS` shape that didn't match `src/config.js`). They can come back in a later round once those settings get their own (likely nested-JSON) editing UI.

## Lock icon — known limitation

No lock icon or toggle-switch CSS exists anywhere else in the repo to reuse. The plan's preferred option was Canvas's native `ic-Super-toggle` switch markup and `icon-lock`/`icon-unlock` icon-font classes, since this page renders inside a real Canvas page and inherits Canvas's site CSS — but that requires live verification against a real Canvas page, which wasn't available while this file was authored. It currently ships with a safe, dependency-free fallback: the hand-rolled `.cg-toggle` CSS already used elsewhere in this file, plus plain Unicode lock glyphs (🔒/🔓) for the padlock button. Swapping in Canvas-native classes is a follow-up someone with live Canvas access can do if the native look is wanted.

## Self-update mechanism

This applies only to `districtSettings.html`'s own page body — it never touches `district_config.json`. Saved settings are completely unaffected by applying a self-update.

1. The script embeds its own version, `CG_DS_VERSION`, near the top.
2. On load, it fetches `districtSettings/district-settings-manifest.json` from its **raw GitHub URL** (`https://raw.githubusercontent.com/MOREnet-Canvas/CustomizedGradebook/main/districtSettings/district-settings-manifest.json`) — a small static file: `{ version, url, notes }`. Fails silently on any error — a missed update check isn't worth surfacing.

   **Deliberately not GitHub Pages.** `.github/workflows/deploy-pages.yml` does not publish the whole repo root — it builds a curated `site/` artifact that only copies `docs/`, `versions.json`, `mobile-versions.json`, and two files from `github-pages/`. `districtSettings/**` was never added to it and never should be. Raw GitHub URLs work immediately on every push to `main` with zero CI/CD involvement (the repo is public, so this is an unauthenticated, CORS-open fetch) — this was the original design intent from day one ("GitHub raw URL is the simple option"), not a workaround.

   **Filename is `district-settings-manifest.json`, not `manifest.json`.** Named deliberately unlike `versions.json`/`mobile-versions.json` to avoid a future reader assuming a relationship — see "Three independent systems" below.
3. If `manifest.version` differs from `CG_DS_VERSION`, a dismissible banner appears with an "Update" button and the manifest's `notes`.
4. Clicking Update: `window.confirm()` (explaining that only this page's UI changes, not saved settings), then fetches `manifest.url` (the new HTML), then `PUT /api/v1/courses/{courseId}/pages/{currentPageSlug}` with `{ wiki_page: { body: <new html> } }`, using the same hand-lifted CSRF helper. If the current URL doesn't look like a normal Canvas page URL (e.g. previewed locally), self-update is refused with an inline error instead of guessing at a page slug.

**Banner trigger is version-only, never content-diffing.** `checkForUpdate()` compares `manifest.version !== CG_DS_VERSION` — it never fetches or inspects `districtSettings.html`'s own content to decide whether to show the banner. `manifest.url` is only fetched after the admin clicks Update.

### Hard rule: keep the manifest in sync, same commit, every time

**Every commit that changes `districtSettings.html` must, in the same commit, bump the version number in `district-settings-manifest.json` and write a meaningful `notes` line describing what changed.** Not a follow-up step. This is the same class of drift that hit the original prototype (`task.md` describing Pages API while the code had already moved to Files API) — a file describing another file, edited out of sync.

- `district-settings-manifest.json`'s `url` field does **not** need to change commit-to-commit — it always points at this file's raw content on `main` (`.../main/districtSettings/districtSettings.html`), not a pinned tag or commit SHA. This is safe specifically because of the same-commit rule above: both files land in one atomic push, so by the time a version bump makes the banner fire for anyone, the corresponding HTML is already live at that same URL. If the rule is ever violated (HTML changed without a version bump), the failure mode is a silent miss — the banner just doesn't fire — not a false trigger pointing at unreachable content.

### Three independent systems — do not cross-wire

This repo has three separate version/manifest-shaped things that must stay separate:

1. **`district-settings-manifest.json`** (this file's own self-update signal) — hand-edited, read only by `districtSettings.html`'s own banner via its raw GitHub URL. No workflow generates or triggers it.
2. **`versions.json` / `mobile-versions.json`** — generated, never hand-edited. Chain: `npm run release:patch/minor/major` (`buildScripts/release.js`) bumps `package.json`, tags, pushes, uploads a GitHub Release → publishing that release triggers `update-version-manifest.yml`, which runs `buildScripts/update-version-manifest.js` to regenerate `versions.json` from `v*.*.*` git tags → `deploy-pages.yml` publishes it to GitHub Pages. Mobile has an identical parallel chain (`release-mobile.js` → `update-mobile-version-manifest.yml` → `mobile-versions.json`). This is the product's own auto-patch version resolution — unrelated to district settings.
3. **The `customGradebookInit.js` bundle itself** — built and uploaded to GitHub Releases by `release.js`/`deploy-dev.js`/`deploy-prod.js`, fetched by the loader snippet teachers paste into Canvas Theme JS. A separate distribution path from either of the above.

`district-settings-manifest.json` must never be wired into `update-version-manifest.yml`, `update-mobile-version-manifest.yml`, `release.js`, `release-mobile.js`, `deploy-dev.js`, `deploy-prod.js`, or any release-tag-triggered workflow, and `deploy-pages.yml` must never be extended to cover `districtSettings/**`. Its version string has no relationship to `package.json`'s version or any git tag.

## No automated test coverage — by design

This file is outside the esbuild/Vitest pipeline (not an ES module, can't be imported by the test runner without a DOM-scraping harness this repo doesn't have). `src/services/districtConfigService.js` — the bundled runtime consumer of the same `district_config.json` shape — has full Vitest coverage instead; that's where the read/parse/fallback logic is verified. This file's own correctness has to be checked by hand.

## Manual verification checklist (no browser/Canvas credentials were available while this file was authored — these have NOT been run against a live Canvas instance yet)

- [ ] Paste into a real `[District Settings]` page in a test district course (e.g. morenetlab) and confirm it renders without console errors.
- [ ] Save with all four toggles off/unlocked; confirm `district_config.json` lands in `MOREnet_CustomizedGradebook/district_config/` with `locked: false`, `visibility_level: institution`.
- [ ] Confirm an unenrolled student test account can read the file directly (200, not 401/403).
- [ ] Toggle a setting on and lock it; confirm the summary card and row reflect both value and lock state after a save + reload.
- [ ] Confirm `districtConfigService.js`, pointed at this course via `window.CG_DISTRICT_COURSE`, resolves a locked setting's value correctly from a different (teacher) course context.
- [ ] Bump `districtSettings/district-settings-manifest.json`'s version (and `notes`), confirm the update banner appears, and confirm clicking Update successfully overwrites this page's body without touching `district_config.json`.
- [ ] Confirm the raw GitHub URL for both files (`.../main/districtSettings/district-settings-manifest.json` and `.../districtSettings.html`) actually resolves once this branch is pushed to `main`.
- [ ] Try the Canvas-native `ic-Super-toggle` / `icon-lock` classes live; if they render correctly, consider swapping them in for the current Unicode fallback.
