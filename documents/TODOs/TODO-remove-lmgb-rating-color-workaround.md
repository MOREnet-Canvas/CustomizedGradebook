# TODO: Remove the LMGB rating-color workaround once Canvas fixes the LMGB

**Tracking issue:** [#107](https://github.com/MOREnet-Canvas/CustomizedGradebook/issues/107)
**Instructure ticket:** filed by Julia (add the ticket # here and on #107)
**Shipped in:** v1.3.13 (`hotfix/v1.3.13`) and `mastery-outlook` (commits `ca85a0c`, `9a2f207`)

## The Canvas bug

With **Learning Mastery Gradebook Enhancements** (`improved_lmgb`) on, the LMGB shows **0 for every student** on outcomes whose rating scale has **more than 6 levels**. Sedalia uses 9 levels.

- `GET /api/v1/courses/:id/outcome_rollups` (the LMGB's own request) returns the correct scores.
- The deployed LMGB code keeps a score only when its rating has a `color`:
  `(null==a?void 0:a.color) && n.push({outcomeId, score, rating:{..., color:"#"+a.color}})`
  Found in chunk `14661-chunk-8c6306795db2bee3.js`, Canvas build `main-entry-f2803db10611ef9a.js`, Oct 2026.
- Canvas's server never gives default colors to scales larger than 6 ratings (`LearningOutcome#meets_color_criteria`: "Anything larger than 6 ratings will use numbers"), even with `add_defaults=true`.
- So every score is dropped. It reproduces with the default theme and no custom JS.

## The workaround

`src/gradebook/lmgbRatingColorPatch.js`, on the LMGB page only:

- Adds a color to each uncolored rating in `outcome_rollups` responses. The colors come from the LMGB mastery palette (`LMGB_MASTERY_SCHEME`), or neutral gray if no palette is set. Scores are never changed, and nothing is written to Canvas.
- Patches `XMLHttpRequest.prototype.responseText/response` (by `responseURL`) and `fetch`. This covers requests Canvas started before the bundle loaded.
- If Canvas already read an uncolored response before the bundle ran, it reloads the page **once**. A sessionStorage guard (`cg_lmgb_color_reload:*`, 60 s) prevents loops.
- It's installed as the first step of `init()` and gated by `ENABLE_LMGB_RATING_COLOR_FIX` (default `true`).

## How to tell that Canvas fixed it

1. Open the LMGB of a course with a 9-level scale (morenetlab course 566 works).
2. Turn the workaround off: `ENABLE_LMGB_RATING_COLOR_FIX: false` in the loader's managed config, or block `customGradebookInit.js` with DevTools → Network → request blocking (`https://github.com/*/customGradebookInit.js`).
3. **Real scores** mean Canvas fixed it, so remove the workaround. **All 0s** means it's still broken, so keep it.

## Removal checklist

- [ ] Delete `src/gradebook/lmgbRatingColorPatch.js` and `src/gradebook/lmgbRatingColorPatch.test.js`
- [ ] `src/config.js`: delete `ENABLE_LMGB_RATING_COLOR_FIX` and its comment
- [ ] `src/customGradebookInit.js`: delete the `installLmgbRatingColorPatch` import, drop `ENABLE_LMGB_RATING_COLOR_FIX` from the config import, and delete the install block at the top of `init()`
- [ ] Delete this file
- [ ] Search for `TEMPORARY — Canvas LMGB workaround`; nothing should be left
- [ ] Ship the removal on every live track (1.3.x hotfix and/or main), then close #107

Nothing else depends on the workaround. The sessionStorage keys expire with the browser session, and loaders that still set `ENABLE_LMGB_RATING_COLOR_FIX` are harmless once the code is gone.
