# Mastery Outlook — Background Polling & Refresh System

## Overview

Add a background polling system to Mastery Outlook that checks for new grading activity in Canvas and prompts the teacher to refresh when changes are detected. The actual refresh uses parallel page fetching to reduce load time from ~60 seconds sequential to ~13 seconds. The parallel fetch is missing a critical filter
The state spec says Refresh Data step 3 fetches outcome results "filtered to exclude PL override assignments." The polling doc's parallel fetch implementation doesn't mention this filter at all. If Augment implements the parallel fetch without it, PL override assignments will pollute the score history and corrupt the PL calculation. Add this to the parallel fetch section explicitly.

---

## Architecture Questions to Resolve First

Before implementing, confirm the following with the existing codebase:

**1. Should the refresh process be its own standalone script?**
The refresh logic is substantial enough — parallel fetching, error handling, cache writing, state transitions — that it may belong in its own module (e.g. `refreshService.js` or `outcomeRefresh.js`) rather than inline in the main tool. This keeps the polling logic, the refresh logic, and the cache logic cleanly separated and independently testable.

**2. Should refresh be its own step in the state machine?**
If Mastery Outlook uses a state machine to manage loading states, the refresh process likely warrants its own state — something like:

```
IDLE → POLLING → CHANGES_DETECTED → REFRESHING → IDLE
```

Rather than treating refresh as a side effect of a button click, modeling it as an explicit state means the UI can react consistently at every stage — showing the banner in `CHANGES_DETECTED`, a progress indicator in `REFRESHING`, and error state if the refresh fails. Consider whether the current state machine has a `REFRESHING` state or whether one needs to be added.

**3. Does the Canvas services API module need updating?**
The existing Canvas API service module likely fetches `outcome_results` sequentially — one page at a time. This will need to be updated or extended to support parallel page fetching as described below. Check whether the current module has a paginated fetch utility, and if so whether it can accept a `parallel: true` option, or whether a new parallel fetch function should be added alongside the existing one to avoid breaking other callers.

---

## Polling System

### How the poll check works

Every 5 minutes, run a single lightweight API call to check if any submissions have been graded since the cache was last built:

```javascript
GET /api/v1/courses/:course_id/students/submissions
  ?student_ids[]=all
  &workflow_state=graded
  &graded_since=${cache.computedAt}
  &per_page=1
```

This call returns in roughly 2 seconds and costs almost nothing against Canvas rate limits. If the response array has any results (`d.length > 0`), changes exist. If empty, the cache is still current.

**Do not process the response contents.** It is used only as a binary changed/unchanged signal. No pagination needed — one result is enough to trigger the banner.

```javascript
async function checkForChanges(courseId, cacheComputedAt) {
  const r = await fetch(
    `/api/v1/courses/${courseId}/students/submissions` +
    `?student_ids[]=all` +
    `&workflow_state=graded` +
    `&graded_since=${cacheComputedAt}` +
    `&per_page=1`
  );
  const d = await r.json();
  return d.length > 0;
}
```

### Polling interval

```javascript
let pollInterval = null;

function startPolling(courseId, cache, onChangesDetected) {
  pollInterval = setInterval(async () => {
    try {
      const hasChanges = await checkForChanges(courseId, cache.metadata.computedAt);
      if (hasChanges) {
        stopPolling();
        onChangesDetected();
      }
    } catch (e) {
      // Silent fail — never interrupt the teacher for a poll error
    }
  }, 5 * 60 * 1000); // 5 minutes
}

function stopPolling() {
  clearInterval(pollInterval);
  pollInterval = null;
}
```

---

## Page Visibility API Integration

Use the browser's built-in Page Visibility API to pause polling when the teacher switches to another tab and resume immediately when they return. This API is available natively in all modern browsers — Chrome, Edge, Firefox, Safari — with no library or installation required.

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    // Run check immediately on return, then restart interval
    // This way the banner is waiting for the teacher the moment
    // they switch back from Canvas rather than up to 5 minutes later
    runPollCheck().then(hasChanges => {
      if (hasChanges) {
        showRefreshBanner();
      } else {
        startPolling(courseId, cache, showRefreshBanner);
      }
    });
  }
});
```

Running the check immediately on tab return is important — the teacher typically finishes grading in Canvas and then switches back to Mastery Outlook. The banner should be there when they arrive, not up to 5 minutes later.

---

## Refresh Banner

When changes are detected, show a non-intrusive sticky banner at the top of the tool. Do not use a modal or popup.

```html
<div id="refresh-banner" style="display:none;">
  <span>New scores have been graded — your data may be out of date</span>
  <button onclick="runFullRefresh()">Refresh now</button>
</div>
```

**Banner behaviour:**
- Blue toned, not red — informational not alarming
- Sticky below the top bar so it doesn't obscure content
- Single "Refresh now" action
- Polling stops once the banner is shown — no point continuing to check once changes are confirmed
- Do not automatically refresh the cache — the teacher must explicitly trigger it. They may be mid-decision on a student and need to control when their view updates

---

## The Actual Refresh — Parallel Page Fetching

### Why parallel matters

Sequential fetching on a 200-student course produces 40+ pages at ~1.5 seconds each — approximately 60 seconds total. Parallel fetching of all pages simultaneously completes in approximately 13 seconds in testing. This is the primary performance gain.

### Canvas services module update

The existing Canvas API service module likely fetches paginated endpoints sequentially. **This module will need to be updated or extended** to support parallel page fetching for `outcome_results`. Options:

- Add a `fetchAllPagesParallel(url, options)` utility alongside the existing sequential fetcher
- Add a `parallel: true` option to the existing paginated fetch utility if it has one
- Create a new `outcomeResultsService.js` that handles this endpoint specifically

Do not replace the sequential fetcher entirely — other endpoints may rely on it and parallel fetching is not always appropriate.

### Parallel fetch implementation

```javascript
async function fetchAllOutcomeResults(courseId) {
  // Step 1 — get first page and determine total page count from link header
  const first = await fetch(
    `/api/v1/courses/${courseId}/outcome_results?per_page=100&page=1`
  );
  if (!first.ok) throw new Error(`Failed to fetch page 1: ${first.status}`);
  
  const firstData = await first.json();
  const totalPages = parseTotalPages(first.headers.get('link'));
  const allResults = [...firstData.outcome_results];

  // Step 2 — fetch remaining pages in parallel batches of 10
  const pageNums = Array.from({length: totalPages - 1}, (_, i) => i + 2);
  const batches = chunk(pageNums, 10);

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(p =>
        fetch(`/api/v1/courses/${courseId}/outcome_results?per_page=100&page=${p}`)
          .then(r => {
            if (!r.ok) throw new Error(`Page ${p} failed: ${r.status}`);
            return r.json();
          })
          .then(d => d.outcome_results)
      )
    );

    // If any page in this batch failed, abort entirely
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      throw new Error(
        `Refresh failed — ${failed.length} page(s) could not be fetched`
      );
    }

    results.forEach(r => allResults.push(...r.value));
  }

  return allResults;
}
```

**Why `Promise.allSettled` not `Promise.all`:** `Promise.all` rejects immediately on the first failure, which could leave you uncertain about the state of other in-flight requests. `Promise.allSettled` lets all requests in the batch settle before you inspect results, giving you a clean picture of what succeeded and what failed before deciding whether to abort.

### Cache integrity rule

**Never write a partially updated cache.** If any batch fails, throw and leave the existing cache unchanged. The teacher gets either a fully fresh cache or the previous cache intact — never a mixed state where some students have today's PL scores and others have yesterday's.

```javascript
async function runFullRefresh(courseId) {
  try {
    const allResults = await fetchAllOutcomeResults(courseId);
    // Only reaches here if all pages succeeded
    const newCache = buildCache(allResults);
    await saveCache(courseId, newCache);
    showSuccess('Scores updated successfully');
    hideRefreshBanner();
    startPolling(courseId, newCache, showRefreshBanner);
  } catch (e) {
    showError('Refresh incomplete — showing last known data. Try again.');
    // Cache is unchanged
  }
}
```

---

## Polling Settings

Auto-polling should be **on by default**. Include a toggle in the existing Tweaks panel to disable it for teachers who prefer manual control. Persist the preference to localStorage.

```javascript
const settings = {
  autoRefresh: localStorage.getItem('autoRefresh') !== 'false'
};

if (settings.autoRefresh) {
  startPolling(courseId, cache, showRefreshBanner);
}
```

Even with auto-polling off, the manual "Refresh" button in the top bar should always be available and always trigger `runFullRefresh()`.

---

## Summary of API Calls

| Call | Frequency | Cost | Purpose |
|---|---|---|---|
| `students/submissions?per_page=1&graded_since=X` | Every 5 min | ~2s, 1 request | Dirty check |
| `outcome_results?per_page=100` × N pages parallel | On refresh only | ~13s, 40 requests | Full cache rebuild |

---

## Files Likely Affected

- `masteryOutlookDataService.js` — add parallel page fetch utility for `outcome_results`; update or extend existing paginated fetch to support parallel mode without breaking other callers
- `masteryOutlookCacheService.js` — `buildCache` must produce `metadata.computedAt` (already the case per real cache schema); polling reads `cache.metadata.computedAt`
- `plOutlookStateHandlers.js` — if refresh is modelled as an explicit state, add `REFRESHING` state alongside `IDLE → POLLING → CHANGES_DETECTED → REFRESHING → IDLE`
- `plOutlookSync.js` — new `runFullRefresh` function if refresh logic is extracted here, or keep inline in the main tool; parallel fetch lives in `masteryOutlookDataService.js`
- `masteryOutlookView.js` — polling start/stop, banner show/hide, Page Visibility listener, auto-refresh toggle in Tweaks panel