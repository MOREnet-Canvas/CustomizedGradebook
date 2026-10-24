// src/masteryOutlook/tests/outcomeLayoutService.test.js
// Outcome order + custom names stored on the Mastery Dashboard page.
import { describe, test, expect, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../../services/pageService.js', () => ({
    findMasteryDashboardPageUrl: vi.fn(async () => 'mastery-dashboard'),
    getPage:    vi.fn(async () => ({ body: '<div id="mastery-dashboard-root" data-outcome-order=\'["599","598"]\'></div>' })),
    updatePage: vi.fn(async () => ({})),
}));

import { parseOutcomeLayout, applyOutcomeLayout, saveOutcomeLayout } from '../outcomeLayoutService.js';
import { resolveOutcomeName, getOutcomeDisplayName } from '../outcomeTypes.js';
import { updatePage } from '../../services/pageService.js';

const ROOT = '<div id="mastery-dashboard-root"></div>';

describe('outcome layout on the dashboard page', () => {
    test('round-trips order and names, including quotes and HTML characters', () => {
        const names = { '598': `Reading "closely" & <fast>`, '599': "Writing's best" };
        const body = applyOutcomeLayout(ROOT, { order: ['599', 598], names });
        expect(parseOutcomeLayout(body)).toEqual({ order: ['599', '598'], names });

        // The browser decodes the attribute for the student dashboard's dataset.
        document.body.innerHTML = body;
        const root = document.getElementById('mastery-dashboard-root');
        expect(JSON.parse(root.dataset.outcomeNames)).toEqual(names);
        expect(JSON.parse(root.dataset.outcomeOrder)).toEqual(['599', '598']);
    });

    test('reads the existing single-quoted order and Canvas-encoded &quot; values', () => {
        expect(parseOutcomeLayout(`<div id="mastery-dashboard-root" data-outcome-order='["1","2"]'>`).order).toEqual(['1', '2']);
        expect(parseOutcomeLayout(`<div id="mastery-dashboard-root" data-outcome-order="[&quot;3&quot;]">`).order).toEqual(['3']);
        expect(parseOutcomeLayout(ROOT)).toEqual({ order: null, names: {} });
    });

    test('updating one part leaves the other alone', () => {
        const body = applyOutcomeLayout(ROOT, { order: ['1', '2'], names: { '1': 'A' } });
        const renamed = applyOutcomeLayout(body, { names: { '2': 'B' } });
        expect(parseOutcomeLayout(renamed)).toEqual({ order: ['1', '2'], names: { '2': 'B' } });
    });

    test('saveOutcomeLayout writes names without dropping the saved order', async () => {
        expect(await saveOutcomeLayout('566', {}, { names: { '598': 'Reading' } })).toBe(true);
        const written = updatePage.mock.calls[0][2].body;
        expect(parseOutcomeLayout(written)).toEqual({ order: ['599', '598'], names: { '598': 'Reading' } });
    });
});

describe('display names', () => {
    test('custom name wins; blank or missing falls back to the Canvas title', () => {
        const o = { id: 598, title: 'Outcome 1 — Reading' };
        expect(resolveOutcomeName(o, { '598': ' Reading ' })).toBe('Reading');
        expect(resolveOutcomeName(o, { '598': '  ' })).toBe('Outcome 1 — Reading');
        expect(resolveOutcomeName(o)).toBe('Outcome 1 — Reading');
        expect(getOutcomeDisplayName(o, { meta: { customOutcomeNames: { '598': 'R' } } })).toBe('R');
    });
});
