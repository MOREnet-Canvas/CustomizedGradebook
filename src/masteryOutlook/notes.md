Here's the full spec. A few things worth highlighting before handing to Augment:

**The most important implementation note** is Section 6 — `possibleManualOverride` is stored in the main cache (temporary, derived during Refresh Data) while `manual_override` lives in `sync_state` (permanent, teacher-confirmed). Augment needs to understand that distinction or it'll conflate the two.

**The new file `plOutlookActions.js`** in Section 10 is the key piece — it orchestrates the automatic chain so the view never has to know about the sequence. The view just calls `handleIgnoreAlignment(studentId, outcomeId, alignmentId, reason)` and the action handler does everything else.

**One thing not yet in the spec** — what happens to `last_synced_score` during `FETCHING_SUBMISSIONS` (new students). When a new student gets their submission record created and their first sync runs, that should write their `last_synced_score` for the first time. Augment should handle that in `handleSyncing` in `plOutlookStateHandlers.js`.