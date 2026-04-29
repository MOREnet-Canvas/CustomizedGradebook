# Mastery Outlook — Addendum: Will Post Persistence & Exceptions View

**For:** Augment Code
**Date:** April 2026
**Relates to:** `src/masteryOutlook/` — supplements `PL_SYNC_STATE_DESIGN_SPEC.md`

---

## 1. Will Post Persistence

### The problem

`will_post` values, lock states, and override notes currently exist only in browser memory. Closing or refreshing the tab loses everything the teacher has entered. This means "Save grades to Canvas" is the only way to preserve work, which is too much pressure — teachers should be able to set Will Post values across multiple sessions and push to Canvas when they are ready.

### Solution: persist Will Post to the cache immediately on change

Every time a teacher modifies a Will Post value (from any source — auto-fill, Canvas click, Marzano click, or custom input), write it to `mastery_outlook_cache.json` immediately via `masteryOutlookCacheService.js`. Do not wait for "Save grades to Canvas."

**"Save grades to Canvas" is a separate, explicit act from recording the value.** The toolbar message "Ready to save — X students have updated grades" is accurate precisely because the values are already safely stored in the cache. Canvas is just the downstream destination.

### New fields in `sync_state`

Add three fields to each `sync_state[outcomeId][studentId]` entry:

```json
{
  "last_synced_score": 4.0,
  "last_synced_at": "2026-04-22T09:00:00Z",
  "manual_override": false,
  "override_score": null,
  "override_reason": null,
  "override_comment_posted": false,
  "override_by": null,
  "override_at": null,

  "will_post": 3.50,
  "will_post_lock": "locked",
  "will_post_note": "Score confirmed — strong verbal demonstration Apr 19"
}
```

| Field | Type | Description |
|---|---|---|
| `will_post` | `number\|null` | The score the teacher intends to post to Canvas. `null` means auto-track Marzano — do not store the Marzano value itself here, compute it at render time. |
| `will_post_lock` | `"none"\|"unlocked"\|"locked"` | `none` = auto-tracking Marzano. `unlocked` = differs from Marzano, not yet committed (Marzano could overwrite on next sync). `locked` = committed override, Marzano will never change this. |
| `will_post_note` | `string\|null` | Teacher's optional note or override reason. |

### `will_post: null` vs a stored value

**Do not** store the Marzano prediction in `will_post`. If `will_post` is `null`, the UI derives the display value from `plPrediction` at render time. This means if Marzano recalculates (new assessment, ignored alignment toggled), the Will Post display automatically reflects the new prediction — no stale values to clean up.

Only store a value in `will_post` when the teacher has explicitly chosen something other than auto-tracking.

### When `will_post_lock: "unlocked"` is cleared by Marzano

If `will_post_lock` is `"unlocked"` (differs from Marzano but not committed), a Marzano recalculation is allowed to overwrite `will_post` and reset the lock to `"none"`. This is the expected behaviour — the teacher has not committed to this value yet.

If `will_post_lock` is `"locked"`, Marzano recalculation must never touch `will_post` or `will_post_note`. This mirrors the existing `manual_override` protection in `plOutlookStateHandlers.js`.

### Relationship to `manual_override`

`will_post_lock: "locked"` and `manual_override: true` are related but distinct:

- `will_post_lock: "locked"` is the **UI state** — the teacher has set an intended grade and does not want Marzano to change it.
- `manual_override: true` is the **Canvas sync state** — a teacher has explicitly confirmed that the Canvas score intentionally differs from Marzano. It is only set when the teacher clicks "confirm override" (spec Section 5C).

A locked Will Post does not automatically set `manual_override`. `manual_override` is only set when the locked Will Post value has actually been posted to Canvas and confirmed. Until that point, the override exists only in Mastery Outlook's working state.

### Write timing

Write to cache on every Will Post change:

| Event | What to write |
|---|---|
| Teacher clicks Marzano pill | Set `will_post: null`, `will_post_lock: "none"`, preserve `will_post_note` |
| Teacher clicks Canvas pill | Set `will_post: canvasValue`, `will_post_lock: "unlocked"` |
| Teacher types custom value | Set `will_post: value`, `will_post_lock: "unlocked"` (or `"locked"` if already locked) |
| Teacher clicks grey padlock to lock | Set `will_post_lock: "locked"` |
| Teacher clicks amber padlock to revert | Set `will_post: null`, `will_post_lock: "none"` |
| Teacher types in note field | Set `will_post_note: value` — debounce 600ms |
| "Save grades to Canvas" completes for a student | Set `last_synced_score`, `last_synced_at`; reset `will_post: null`, `will_post_lock: "none"` if Will Post now matches Canvas |

Use the existing read-merge-write pattern from `readPLAssignments` / `writePLAssignments`. Do not overwrite unrelated sync_state fields.

---

## 2. Exceptions View

### Use case

Occasionally a teacher needs to audit all their overrides or ignored alignments at once — before a parent conference, at semester end, or just to review their decisions. This is a rare action, not part of the regular workflow. The solution should surface it without cluttering the main view.

### Two levels of access

**Within a single outcome (existing tab bar):**

The existing "All students / Struggling / Growing" tab bar inside each expanded outcome row should gain an **Exceptions** tab. This tab shows only students for that outcome who have at least one of:
- A locked Will Post (`will_post_lock: "locked"`)
- A confirmed manual override (`manual_override: true`)
- One or more ignored alignments

If the count is zero, hide the tab entirely. If there are exceptions, show a count badge: `Exceptions (3)`.

**Across all outcomes (top-level audit view):**

Add a small **"View exceptions"** text link in the top bar, right-aligned near the Refresh button. It opens a flat cross-outcome list — a simple table showing every exception in the course in one place. This is the primary tool for end-of-term audits.

### Cross-outcome exceptions table

Columns:

| Column | Content |
|---|---|
| Outcome | Outcome name |
| Student | Student name |
| Type | `Override` / `Ignored alignment` |
| Canvas | Current Canvas score |
| Marzano | Current Marzano prediction |
| Will Post | Current Will Post value (if locked) |
| Note | `will_post_note` or alignment ignore reason |
| Date | `override_at` or `ignored_at` |

**Filterable by type** — two filter chips above the table: `Overrides` and `Ignored alignments`. Both on by default. Clicking one toggles it off to focus on the other.

**No actions in this view.** It is read-only. The teacher navigates back to the outcome to make changes. This keeps the audit view simple and avoids the risk of accidental edits during a review.

### Implementation notes

- Source data: `sync_state` (for overrides and locked Will Post) and `ignored_alignments` (for ignored alignments) — both already in the cache.
- No additional API calls required. Everything is in the local cache.
- Render from cache only — do not trigger a Canvas fetch when opening this view.
- If `ignored_alignments` is empty and no locked overrides exist, show an empty state: *"No overrides or ignored alignments recorded for this course."*

### Files affected

| File | Change |
|---|---|
| `masteryOutlookCacheService.js` | Add `will_post`, `will_post_lock`, `will_post_note` to `readSyncState` / `writeSyncState` |
| `plOutlookStateHandlers.js` | Respect `will_post_lock: "locked"` in `handleCalculatingChanges` — treat same as `manual_override` for Marzano overwrite protection |
| `masteryOutlookView.js` | Add Exceptions tab to outcome detail tab bar; add "View exceptions" link to top bar; render cross-outcome exceptions table |
| `plOutlookActions.js` | Call `writeSyncState` on every Will Post change (see write timing table above) |
