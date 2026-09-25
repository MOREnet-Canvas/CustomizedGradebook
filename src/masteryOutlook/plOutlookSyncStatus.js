// src/masteryOutlook/plOutlookSyncStatus.js
/**
 * Sync-status helpers for the PL Outlook view.
 *
 * getSyncStatus() is the single source of truth for the status badge shown
 * per student × outcome row.  It is consumed by:
 *   - masteryOutlookView.js  → sync badge rendering
 *   - plOutlookSync.js       → checkSyncNeeded counts
 *   - plOutlookActions.js    → deciding what chain step to run next
 */


/**
 * Compare two PL scores treating them as equal when they round to the same
 * two-decimal value. Avoids false "needs sync" from floating-point drift.
 *
 * @param {number} a
 * @param {number} b
 * @returns {boolean}
 */
export function scoresMatch(a, b) {
    if (a == null || b == null) return false;
    return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * How long after a push an unconfirmed Canvas score counts as "still verifying"
 * rather than a possible manual override. Canvas can take a while to update the
 * rollup after a rubric assessment.
 */
export const VERIFY_PENDING_WINDOW_MS = 30 * 60 * 1000;

/** Tooltip text for the "verifying" status (chip and row marker). */
export const VERIFYING_TIP = 'Saved to Canvas; waiting for Canvas to update the score. This clears on its own.';

/** Tooltip text for the "possible override" status (chip and row marker). */
export const POSSIBLE_OVERRIDE_TIP =
    'Canvas score no longer matches the score Mastery Outlook last saved — ' +
    'it may have been changed directly in Canvas. Open the outcome to review.';

/**
 * True when a push happened but no verify pass completed after it, and the
 * push is recent enough that Canvas may simply not have caught up yet.
 *
 * @param {Object} state - sync_state entry
 * @param {number} now   - epoch ms
 * @returns {boolean}
 */
function isVerifyPending(state, now) {
    const syncedAt = state?.last_synced_at ? Date.parse(state.last_synced_at) : NaN;
    if (Number.isNaN(syncedAt)) return false;
    const verifiedAt = state?.last_verify_at ? Date.parse(state.last_verify_at) : NaN;
    const verifiedSincePush = !Number.isNaN(verifiedAt) && verifiedAt >= syncedAt;
    return !verifiedSincePush && (now - syncedAt) < VERIFY_PENDING_WINDOW_MS;
}

/**
 * Derive the sync status for one student × outcome cell.
 *
 * Priority order (first match wins):
 *  1. NE         — student has no PL prediction (not enough attempts)
 *  2. not_setup  — no PL assignment exists for this outcome yet
 *  3. manual_override — teacher has confirmed Canvas score should be kept
 *  3b. verifying — pushed recently, Canvas not yet showing it, no verify pass since
 *  4. possible_override — Canvas score changed AFTER the last PL push
 *  5. needs_sync — teacher-set will_post differs from Canvas score (or never pushed)
 *  6. synced     — Canvas score matches last pushed PL prediction
 *
 * @param {string|number} studentId
 * @param {string|number} outcomeId
 * @param {number|null}   plPrediction  - computed Power Law score (null → NE)
 * @param {number|null}   canvasScore   - current Canvas rollup score (null = not set)
 * @param {Object}        plConfig      - { pl_assignments, sync_state } from cache
 * @param {number}        [now=Date.now()] - current time in epoch ms (injectable for tests)
 * @returns {{ status: string, label: string, cssClass: string, [extra]: * }}
 */
export function getSyncStatus(studentId, outcomeId, plPrediction, canvasScore, plConfig, now = Date.now()) {
    const oId = String(outcomeId);
    const sId = String(studentId);

    // 1. NE — student has no PL prediction
    if (plPrediction === null || plPrediction === undefined) {
        return { status: 'ne', label: 'NE', cssClass: 'sb-ne' };
    }

    // 2. not_setup — outcome has no PL assignment yet
    const hasAssignment = Boolean(plConfig?.pl_assignments?.[oId]?.assignment_id);
    if (!hasAssignment) {
        return { status: 'not_setup', label: 'Setup needed', cssClass: 'sb-ne' };
    }

    const state = plConfig?.sync_state?.[oId]?.[sId];

    // 3. manual_override — teacher confirmed Canvas score should win
    if (state?.manual_override) {
        return {
            status:       'manual_override',
            label:        '⚑ Override',
            cssClass:     'sb-override',
            canvasScore,
            plPrediction,
            overrideNote: state.will_post_note ?? null,
        };
    }

    const lastSyncedScore = state?.last_synced_score ?? null;

    // 3b. verifying — the push hasn't shown up in Canvas yet (e.g. page reloaded
    //     mid-verify). Not a manual override until the pending window passes.
    if (lastSyncedScore !== null && canvasScore !== null
        && !scoresMatch(canvasScore, lastSyncedScore)
        && isVerifyPending(state, now)) {
        return {
            status:          'verifying',
            label:           '⏳ Verifying',
            cssClass:        'sb-verifying',
            canvasScore,
            plPrediction,
            lastSyncedScore,
        };
    }

    // 4. possible_override — Canvas changed AFTER the last PL push
    //    (lastSyncedScore exists but canvasScore no longer matches it)
    if (lastSyncedScore !== null && canvasScore !== null
        && !scoresMatch(canvasScore, lastSyncedScore)) {
        return {
            status:          'possible_override',
            label:           '⚑ Override?',
            cssClass:        'sb-override-q',
            canvasScore,
            plPrediction,
            lastSyncedScore,
        };
    }

    // 5. needs_sync — never pushed (no lastSyncedScore) OR prediction has drifted
    // Only a teacher-set override is ever pushed — no override means nothing to sync.
    const targetScore = state?.will_post ?? null;
    if (targetScore !== null && (lastSyncedScore === null || !scoresMatch(targetScore, canvasScore))) {
        return {
            status:   'needs_sync',
            label:    '↑ Needs sync',
            cssClass: 'sb-needs',
            plPrediction,
            canvasScore,
        };
    }

    // 6. synced — all clear
    return {
        status:   'synced',
        label:    '✓ Synced',
        cssClass: 'sb-synced',
        plPrediction,
        canvasScore,
    };
}

/**
 * Aggregate getSyncStatus across all students for one outcome.
 * Returns counts used by checkSyncNeeded and the sync-summary badge.
 *
 * @param {Object[]} students      - cache.students (must already have .name attached by enrichCache)
 * @param {string|number} outcomeId
 * @param {Object} plConfig        - { pl_assignments, sync_state }
 * @returns {{ total, synced, needsSync, verifying, possibleOverride, manualOverride, ne, notSetup }}
 */
export function aggregateSyncStatus(students, outcomeId, plConfig) {
    const counts = {
        total: 0, synced: 0, needsSync: 0, verifying: 0,
        possibleOverride: 0, manualOverride: 0, ne: 0, notSetup: 0,
    };

    for (const student of students) {
        const outcomeData = student.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
        if (!outcomeData) continue;

        counts.total++;
        const { status } = getSyncStatus(
            student.id, outcomeId,
            outcomeData.plPrediction, outcomeData.canvasScore,
            plConfig
        );

        switch (status) {
            case 'synced':            counts.synced++;           break;
            case 'needs_sync':        counts.needsSync++;        break;
            case 'verifying':         counts.verifying++;        break;
            case 'possible_override': counts.possibleOverride++; break;
            case 'manual_override':   counts.manualOverride++;   break;
            case 'ne':                counts.ne++;               break;
            case 'not_setup':         counts.notSetup++;         break;
        }
    }

    return counts;
}
