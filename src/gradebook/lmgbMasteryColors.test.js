import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../utils/canvasApiClient.js', () => ({
    CanvasApiClient: class { get(...args) { return mockGet(...args); } },
}));
vi.mock('../utils/canvas.js', () => ({ getCourseId: () => '566' }));
// Isolate from config.js module-load side effects; tests pass schemeKey explicitly
vi.mock('../config.js', () => ({ LMGB_MASTERY_SCHEME: 'sedaliaA', CUSTOM_MASTERY_PALETTES: {} }));

import {
    initLmgbMasteryColors,
    stopLmgbMasteryColors,
    applyLmgbMasteryColors,
    buildDistributionBar,
} from './lmgbMasteryColors.js';
import { getOptInPalette } from '../ui/masteryColors.js';
import { getBandClassName } from '../ui/masteryColorStyles.js';

function scoreCell(outcomeId, text) {
    return `<td data-col-key="outcome-${outcomeId}"><div data-testid="score-cell-content"><span><span>${text}</span></span></div></td>`;
}

function chartCell(outcomeId) {
    return `<td id="bar-chart-outcome-${outcomeId}"><div data-testid="mastery-distribution-chart-cell-${outcomeId}"><div class="canvas-chart">old</div></div></td>`;
}

function mountGrid(cells) {
    document.body.innerHTML = `<div id="learning_mastery_gradebook"><table><tr>${cells}</tr></table></div>`;
}

function distribution(description = 'Target') {
    return { total_students: 4, ratings: [{ points: 3, count: 3, description }, { points: 1, count: 1 }] };
}

const pill = (outcomeId) => document.querySelector(`[data-col-key="outcome-${outcomeId}"] span span`);

describe('lmgbMasteryColors', () => {
    beforeEach(() => {
        mockGet.mockReset();
        document.head.innerHTML = '';
    });

    afterEach(() => stopLmgbMasteryColors());

    it('does not start for an unknown scheme', () => {
        mountGrid(scoreCell(1, '3'));
        expect(initLmgbMasteryColors({ schemeKey: 'nope' })).toBe(false);
        expect(pill(1).classList.contains('cg-mastery-pill')).toBe(false);
    });

    it('colors score cells and swaps the band when a recycled cell changes', async () => {
        mountGrid(scoreCell(1, '3.5'));
        initLmgbMasteryColors({ schemeKey: 'sedaliaA' });
        expect(pill(1).classList).toContain('cg-mastery-pill');
        expect(pill(1).classList).toContain(getBandClassName('sedaliaA', 1));

        pill(1).textContent = '2';
        await applyLmgbMasteryColors();
        expect(pill(1).classList).toContain(getBandClassName('sedaliaA', 4));
        expect(pill(1).classList).not.toContain(getBandClassName('sedaliaA', 1));

        pill(1).textContent = '-';
        await applyLmgbMasteryColors();
        expect(pill(1).classList.contains('cg-mastery-pill')).toBe(false);
        expect(pill(1).dataset.cgLmgbScore).toBeUndefined();
    });

    it('ignores the override 🔒 badge when reading the score', () => {
        mountGrid(scoreCell(1, '2<span data-cg-lmgb-lock>🔒</span>'));
        initLmgbMasteryColors({ schemeKey: 'sedaliaA' });
        expect(pill(1).classList).toContain(getBandClassName('sedaliaA', 4));
    });

    it('fetches all visible outcome distributions in one request and renders bars', async () => {
        mountGrid(chartCell(11) + chartCell(12));
        mockGet.mockResolvedValue({ outcome_distributions: { 11: distribution(), 12: distribution() } });

        initLmgbMasteryColors({ schemeKey: 'sedaliaA' });
        await applyLmgbMasteryColors();

        expect(mockGet).toHaveBeenCalledTimes(1);
        expect(mockGet.mock.calls[0][0]).toContain('outcome_ids[]=11&outcome_ids[]=12');
        expect(document.querySelectorAll('.cg-mastery-bar')).toHaveLength(2);
        expect(document.querySelector('.canvas-chart').hasAttribute('data-cg-mastery-hidden')).toBe(true);
    });

    it('does not refetch an outcome after a failed request', async () => {
        mountGrid(chartCell(11));
        mockGet.mockRejectedValue(new Error('403'));

        initLmgbMasteryColors({ schemeKey: 'sedaliaA' });
        await applyLmgbMasteryColors();
        await applyLmgbMasteryColors();

        expect(mockGet).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.canvas-chart').hasAttribute('data-cg-mastery-hidden')).toBe(false);
    });

    it('renders tooltip text without parsing HTML', () => {
        const { bands } = getOptInPalette('sedaliaA');
        const bar = buildDistributionBar(distribution('<img src=x onerror=alert(1)>'), 'sedaliaA', bands);
        document.body.appendChild(bar);

        const seg = bar.querySelector('.cg-mastery-seg');
        seg.dispatchEvent(new Event('focus'));

        const tip = document.getElementById('cg-lmgb-mastery-tooltip');
        expect(tip.hidden).toBe(false);
        expect(tip.querySelector('img')).toBeNull();
        expect(tip.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(tip.textContent).toContain('3 students (75.0%)');
        expect(bar.querySelectorAll('.cg-mastery-seg')[1].getAttribute('aria-label')).toContain('1 student,');
    });

    it('returns no bar when there are no students', () => {
        const { bands } = getOptInPalette('sedaliaA');
        expect(buildDistributionBar({ total_students: 0, ratings: [] }, 'sedaliaA', bands)).toBeNull();
    });

    // TEMPORARY — remove with legacyLmgbLoaderGuard.js
    describe('legacy loader guard', () => {
        it('defers to loader Section D and removes everything it added', async () => {
            mountGrid(scoreCell(1, '3') + chartCell(11));
            mockGet.mockResolvedValue({ outcome_distributions: { 11: distribution() } });

            initLmgbMasteryColors({ schemeKey: 'sedaliaA' });
            await applyLmgbMasteryColors();
            expect(document.querySelector('.cg-mastery-bar')).not.toBeNull();

            pill(1).setAttribute('data-schs-mastery-score', '3');
            await applyLmgbMasteryColors();

            expect(document.querySelector('.cg-mastery-pill')).toBeNull();
            expect(document.querySelector('[data-cg-lmgb-owned]')).toBeNull();
            expect(document.querySelector('[data-cg-mastery-hidden]')).toBeNull();
        });
    });
});
