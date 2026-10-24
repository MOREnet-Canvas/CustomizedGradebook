// Adopting an existing Projected Score assignment must store the rubric's ID —
// never the criterion's learning_outcome_id (an outcome ID) as rubric_id.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../masteryOutlookCacheService.js', () => ({
    readMasteryOutlookCache: vi.fn(),
    readPLAssignments:       vi.fn(async () => ({})),
    writePLAssignments:      vi.fn(),
    readSyncState:           vi.fn(async () => ({})),
    writeSyncState:          vi.fn(),
}));
vi.mock('../plOutlookSetup.js', () => ({
    findExistingPLAssignment: vi.fn(async () => ({ id: 3627, name: 'Outcome 5 — Projected Score' })),
}));
vi.mock('../../services/submissionService.js', () => ({
    fetchRubricAssociationId: vi.fn(async () => 'assoc-1'),
}));

import { PLOutlookStateMachine, PL_STATES } from '../plOutlookStateMachine.js';
import { handleCreatingAssignment } from '../plOutlookStateHandlers.js';
import { writePLAssignments } from '../masteryOutlookCacheService.js';

function adoptWith(assignmentDetail) {
    const apiClient = {
        get:         vi.fn(async () => assignmentDetail),
        put:         vi.fn(async () => ({})),
        getAllPages: vi.fn(async () => []),
    };
    const sm = new PLOutlookStateMachine({
        courseId: '566', outcomeId: '602', outcomeName: 'Outcome 5', apiClient, setupOnly: true,
    });
    sm.transition(PL_STATES.CHECKING_SETUP);
    sm.transition(PL_STATES.CREATING_ASSIGNMENT);
    return handleCreatingAssignment(sm);
}

describe('adopting an existing Projected Score assignment', () => {
    test('stores rubric_settings.id as rubric_id', async () => {
        await adoptWith({ rubric_settings: { id: 505 }, rubric: [{ id: 'crit', learning_outcome_id: 602 }] });
        expect(writePLAssignments.mock.calls.at(-1)[1]['602'].rubric_id).toBe('505');
    });

    test('no rubric_settings → rubric_id is null, not the outcome ID', async () => {
        await adoptWith({ rubric: [{ id: 'crit', learning_outcome_id: 602 }] });
        expect(writePLAssignments.mock.calls.at(-1)[1]['602'].rubric_id).toBeNull();
    });
});
