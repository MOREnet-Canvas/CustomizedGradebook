# TODO: Remove the legacy "Mastery Dashboard" title match for Mastery View pages

**Tracking issue:** [#108](https://github.com/MOREnet-Canvas/CustomizedGradebook/issues/108)
**Code marker:** search for `LEGACY — "Mastery Dashboard" title`

## Why it exists

Mastery View pages used to be titled **"Mastery Dashboard"**. To keep older courses working, `findMasteryViewPages()` in `src/services/pageService.js` also matches that legacy title. Every Mastery View lookup goes through it:

- Create Mastery View Button (repair / re-link), `src/masteryDashboardCreation/buttonInjection.js`
- Delete Mastery View Setup, same file
- `findMasteryDashboardPageUrl()`. Mastery Outlook uses it to save the teacher's outcome order and names onto the page (`outcomeLayoutService.js`) and to record the page URL in its cache.

## The risk

A teacher's own, unrelated page titled "Mastery Dashboard" gets the slug `mastery-dashboard`, the same as ours. Without a guard it would be treated as Mastery View:

- Create would prepend `#mastery-dashboard-root` to it and point the front-page button at it.
- Delete Mastery View Setup would delete it.
- Mastery Outlook could write `data-outcome-order` / `data-outcome-names` onto it.

## The guard (in place)

A page titled "Mastery Dashboard" only counts when its body contains `#mastery-dashboard-root`, which a real legacy Mastery View page always does. Pages titled "Mastery View" count as before, including empty ones, so Create can repair them.

Trade-off: an *empty* legacy-titled page is not repaired. Create makes a new "Mastery View" page instead.

## When it's safe to remove

Remove it once no course still has a Mastery View page titled "Mastery Dashboard". Either:

- sweep courses (API or account report) for pages titled "Mastery Dashboard" whose body contains `mastery-dashboard-root`, and rename them to "Mastery View"; or
- decide the remaining ones are acceptable to break.

## Removal checklist

- [ ] `src/services/pageService.js`: remove `'Mastery Dashboard'` from `MASTERY_VIEW_PAGE_TITLES`, the guard in `findMasteryViewPages`, and the LEGACY comment block
- [ ] `src/masteryDashboardCreation/buttonInjection.js`: remove the two LEGACY marker comments
- [ ] `src/masteryDashboardCreation/tests/masteryViewSetup.test.js`: remove the "legacy Mastery Dashboard title guard" tests, and change the legacy-titled page in the finder test to "Mastery View"
- [ ] `CLAUDE.md`: remove this item from "Temporary / legacy code"
- [ ] `AI_SERVICES_REFERENCE.md`: remove the ⚠️ legacy note in the `pageService.js` section
- [ ] Delete this file
- [ ] Search for `LEGACY — "Mastery Dashboard" title`; nothing should be left. Then close #108
