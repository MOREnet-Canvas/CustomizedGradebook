# District Settings — Spec

## Overview

**Delivery mechanism pivoted — read this before touching anything below.** `districtSettings.html` as a *pasted-into-a-Canvas-page* deliverable is dead. Live testing confirmed it cannot work as designed: Canvas's RCE strips `<script>` tags from wiki page bodies, and file-preview iframes are sandboxed without `allow-scripts` — a standalone HTML file with inline JS can never execute once it's actually placed on a Canvas page.

The district settings editing UI will instead ship as **theme-injected code**, part of the normal esbuild bundle, loaded via Canvas's Theme JS field (which Canvas never sanitizes). This mirrors how Cidi Labs' DesignPLUS solves the identical problem — confirmed via network capture and page-source inspection on a live Canvas instance: the settings-editing UI is never pasted page content, it's part of their theme-injected bundle, gated to only render on a specific course + page combination. The `[District Settings]` wiki page itself becomes an empty placeholder that the injected UI mounts into.

`districtSettings.html` stays in the repo, retained as an **implementation reference** — its toggle+lock row markup, CSS, and Files API read/write logic (described below) are the starting point for porting into the theme-injected version. It is not a shipped artifact. It can be formally retired once the theme-injected UI exists and those pieces have been ported. `districtSettings/district-settings-manifest.json` also stays in the repo, unused for now, same reasoning — it is **not wired to anything** (see "Self-update mechanism is dead" below).

The underlying storage layer is unaffected by any of this: `district_config.json` is still stored and read the same way (sparse-override JSON via Canvas Files API), and `src/services/districtConfigService.js` — the bundled runtime consumer teachers'/students' pages actually hit — did not change.

**Hard constraints on `districtSettings.html` as a reference file, while it's still in this state:** it stays exactly as authored (Files API + per-key lock model, described below) — don't delete or modify it until the theme-injected UI is built and ready to formally replace it.

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
- Confirmed by live testing (`scripts/canvas-test/verifyVisibility.js`, course 581): a **locked folder** blocks student reads the same way a locked file does, even when the file inside it is unlocked and `institution`-visible. This is why neither folder in the path is ever locked either.

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

## Data layer (reference implementation in `districtSettings.html`)

This describes the read/write logic as implemented in the retained reference file — port this logic (not the file itself) into the theme-injected UI:

- Course ID parsed from `window.location.pathname` via `/\/courses\/(\d+)/`; fallback `'COURSE_ID'`.
- CSRF: hand-lifted from `src/utils/canvasApiClient.js`'s cookie-reading logic (`document.cookie` split/trim/match on `_csrf_token`, `X-CSRF-Token` header, `authenticity_token` body field). The theme-injected version can and should just import `CanvasApiClient` directly instead — this hand-lifted duplication only existed because a standalone pasted-HTML file couldn't import anything; that constraint goes away once the UI ships in the normal bundle.
- Read: search `/api/v1/courses/{courseId}/files` for `district_config.json`, download via the returned file `url`, `JSON.parse`, validate `schemaVersion`. Any failure (not found, non-OK download, malformed JSON, schema mismatch) → keep defaults silently.
- Write: standard Canvas 3-step upload (`POST .../files` for upload instructions → `FormData` POST to `upload_url` → `PUT /api/v1/files/{id}` to finalize with `locked: false, hidden: false, visibility_level: 'institution'`).
- Folders (`MOREnet_CustomizedGradebook` → `district_config`) are found-or-created idempotently, never locked.
- Inline save feedback only (success/error) — no `alert()`.

## Sections (reference implementation in `districtSettings.html`)

- **Summary** — one metric card per round-1 setting, showing on/off plus a 🔒 marker when locked.
- **Feature flags** — one row per round-1 setting: label + hint, a value toggle, and a padlock button (🔒 locked / 🔓 unlocked) that flips lock state independently of the value.
- **Canvas loader** — courseId badge from URL, minimal loader snippet (`CG_DISTRICT_COURSE` + plain `<script src>` injection, no generated config block), copy button, 3 numbered steps. This section's *purpose* changes under the new architecture (see "District course ID must be configurable per-district" below) but its display logic is still a useful reference.

Removed from the original prototype (out of round-1 scope, no longer fit the new schema): Labels, Outcome config, Grading, Account filter, Custom status sections. These referenced settings that aren't part of round 1 and had their own drifted key shapes (e.g. an invented `ENABLE_ACCOUNT_FILTER`/`ALLOWED_ACCOUNT_IDS` shape that didn't match `src/config.js`). They can come back in a later round once those settings get their own (likely nested-JSON) editing UI.

## Lock icon — known limitation

No lock icon or toggle-switch CSS exists anywhere else in the repo to reuse. The preferred option was Canvas's native `ic-Super-toggle` switch markup and `icon-lock`/`icon-unlock` icon-font classes, since the theme-injected UI still renders inside real Canvas pages and inherits Canvas's site CSS — but that requires live verification against a real Canvas page, which wasn't available while the reference file was authored. It currently ships (in the reference file) with a safe, dependency-free fallback: hand-rolled `.cg-toggle` CSS plus plain Unicode lock glyphs (🔒/🔓) for the padlock button. Swapping in Canvas-native classes is a follow-up someone with live Canvas access can do when porting to the theme-injected UI, if the native look is wanted.

## Self-update mechanism is dead

The pasted-HTML delivery model needed a way to update itself in place (a version-check banner + PUT-to-page-body flow) since there was no normal release pipeline putting new code in front of the admin. That entire problem goes away with theme-injected delivery — the UI ships through the same release/deploy pipeline as everything else in this codebase, so it never needs to update itself. `district-settings-manifest.json` remains in the repo, unused, for the same no-urgency-to-delete reasoning as `districtSettings.html` itself — it is not read by anything, not generated by anything, and not wired into `update-version-manifest.yml`, `update-mobile-version-manifest.yml`, `release.js`, `release-mobile.js`, `deploy-dev.js`, `deploy-prod.js`, `deploy-pages.yml`, or any other workflow. Don't go looking for a self-update flow — there isn't one anymore.

## Route gate

The theme-injected settings UI only mounts when **both** conditions match:

- The loader is running inside the district-config course (course ID check).
- The current page matches the designated `[District Settings]` page (page-slug check).

Outside that exact course+page combination — every teacher course, every student, every other page in the district-config course itself — this code never mounts. Everyone else only ever hits `districtConfigService.js`'s read path (`getEffectiveValue()`/`loadDistrictConfig()`); they never load any settings-editing UI at all.

## District course ID must be configurable per-district, not hardcoded

This needs to work for districts beyond Sedalia eventually, so the district-config course ID can't be baked into the bundle.

**Bootstrapping idea under active investigation (not finalized):** a generic "starter loader" that locates the district-config course **by name** rather than a hardcoded ID. This solves the install-time chicken-and-egg problem — a district admin importing the `.imscc` has no course ID to configure yet (it's assigned at import time), but does know/control the course's name.

**Open unknown, still being tested:** whether Canvas's `.imscc` import actually lets a district admin control the resulting course's name — forced from the cartridge manifest, assigned by the importer regardless of manifest content, or dependent on importing into an already-named course shell. This will determine the exact mechanics of the starter loader and isn't settled yet.

## Future loader specialization (planned, not built)

Once real settings exist, for any values that should live in the static loader itself for performance (skipping the async Files API fetch on every page load), the district settings UI will generate updated loader text reflecting current config — similar to the existing Loader Generator panel pattern (`src/admin/loaderGenerator.js`), but sourced from district settings instead of per-course config. The district admin takes that generated text and uploads it as a more specialized loader via Canvas's Theme JS field, replacing the generic starter loader. Not built yet — documented here so the intent isn't lost.

## Per-course teacher overrides do NOT live here

Per-course teacher overrides (mentioned elsewhere as a possible future feature) will **not** live on this district settings page or in this course. If/when built, they'll be a separate, course-by-course mechanism. Don't assume this page is where that would go.

## No automated test coverage — by design

`districtSettings.html` is outside the esbuild/Vitest pipeline (not an ES module, can't be imported by the test runner without a DOM-scraping harness this repo doesn't have) — this remains true as a reference file. `src/services/districtConfigService.js` — the bundled runtime consumer of the same `district_config.json` shape — has full Vitest coverage; that's where the read/parse/fallback logic is verified. Once the theme-injected settings UI is built as part of the normal bundle, it should get normal Vitest coverage like everything else in `src/` — the "no automated coverage" constraint was specific to the pasted-HTML delivery model, not a permanent property of this feature.

## Manual verification checklist

Split by what's been confirmed via the `scripts/canvas-test/` API harness (Bearer token, course 581, student `642`) versus what still requires an actual browser session with the future theme-injected UI, since the two aren't interchangeable — the harness never exercises `districtConfigService.js`'s own code paths, only the underlying Canvas platform behavior it depends on.

**Confirmed via `scripts/canvas-test/verifyVisibility.js`:**
- [x] An unenrolled student test account can read an unlocked, `visibility_level: institution` file directly (200 metadata, 200 download).
- [x] A locked file blocks that same student regardless of `visibility_level` (200 metadata with `locked_for_user: true`, but no `url` issued — no way to actually fetch content).
- [x] An unlocked, `institution`-visible file inside a *locked folder* is blocked the same way — folder lock cascades exactly like file lock. Confirms `districtConfigService.js`'s `ensureFolder()` is right to never lock either folder in the chain.

**Still needs the theme-injected UI to exist and a real browser session (not run yet):**
- [ ] Confirm the route gate actually mounts the settings UI only on the district-config course's `[District Settings]` page, and nowhere else.
- [ ] Save with all four toggles off/unlocked through the actual injected UI; confirm `district_config.json` lands in `MOREnet_CustomizedGradebook/district_config/` with `locked: false`, `visibility_level: institution` (the harness only tested hand-created fixtures, not a save performed through this code path).
- [ ] Toggle a setting on and lock it; confirm the UI reflects both value and lock state after a save + reload.
- [ ] Confirm `districtConfigService.js`, pointed at this course via `window.CG_DISTRICT_COURSE`, resolves a locked setting's value correctly from a different (teacher) course context — this exercises the application's own cookie/CSRF code path, which the Bearer-token harness deliberately never touches.
- [ ] Once the starter-loader-by-name idea is resolved, confirm it actually locates the district-config course correctly on a fresh `.imscc` import.
