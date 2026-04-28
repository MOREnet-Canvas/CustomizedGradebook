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
 * Derive the sync status for one student × outcome cell.
 *
 * Priority order (first match wins):
 *  1. NE         — student has no PL prediction (not enough attempts)
 *  2. not_setup  — no PL assignment exists for this outcome yet
 *  3. manual_override — teacher has confirmed Canvas score should be kept
 *  4. possible_override — Canvas score changed AFTER the last PL push
 *  5. needs_sync — plPrediction differs from Canvas score (or never pushed)
 *  6. synced     — Canvas score matches last pushed PL prediction
 *
 * @param {string|number} studentId
 * @param {string|number} outcomeId
 * @param {number|null}   plPrediction  - computed Power Law score (null → NE)
 * @param {number|null}   canvasScore   - current Canvas rollup score (null = not set)
 * @param {Object}        plConfig      - { pl_assignments, sync_state } from cache
 * @returns {{ status: string, label: string, cssClass: string, [extra]: * }}
 */
export function getSyncStatus(studentId, outcomeId, plPrediction, canvasScore, plConfig) {
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
    if (lastSyncedScore === null || !scoresMatch(plPrediction, canvasScore)) {
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
 * @returns {{ total, synced, needsSync, possibleOverride, manualOverride, ne, notSetup }}
 */
export function aggregateSyncStatus(students, outcomeId, plConfig) {
    const counts = {
        total: 0, synced: 0, needsSync: 0,
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
            case 'possible_override': counts.possibleOverride++; break;
            case 'manual_override':   counts.manualOverride++;   break;
            case 'ne':                counts.ne++;               break;
            case 'not_setup':         counts.notSetup++;         break;
        }
    }

    return counts;
}
