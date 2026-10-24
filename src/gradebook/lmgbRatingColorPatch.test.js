// src/gradebook/lmgbRatingColorPatch.test.js
// Canvas's LMGB drops scores whose rating has no color; the patch fills in only
// the missing colors on outcome_rollups responses and changes nothing else.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    addMissingRatingColors, patchRollupsText, isRollupsUrl, installLmgbRatingColorPatch,
    _resetLmgbRatingColorPatchForTests, FALLBACK_RATING_COLOR,
} from './lmgbRatingColorPatch.js';
import { getOptInPalette } from '../ui/masteryColors.js';

const bands = getOptInPalette('sedaliaA').bands;

const rollups = () => ({
    rollups: [{ scores: [{ score: 2.5, links: { outcome: '598' } }], links: { user: '643' } }],
    linked: {
        outcomes: [
            { id: '598', ratings: [
                { description: 'Exemplary', points: 4, mastery: false },
                { description: 'Approaching Target', points: 2.5, mastery: false },
                { description: 'No Evidence', points: 0, mastery: false },
            ] },
            { id: '700', ratings: [{ description: 'Mastery', points: 3, color: '03893D' }] },
        ],
    },
});

describe('isRollupsUrl', () => {
    it('matches the LMGB rollups request only', () => {
        expect(isRollupsUrl('/api/v1/courses/566/outcome_rollups?per_page=15&include%5B%5D=outcomes')).toBe(true);
        expect(isRollupsUrl('https://x.instructure.com/api/v1/courses/566/outcome_rollups')).toBe(true);
        expect(isRollupsUrl('/api/v1/courses/566/outcome_rollups?aggregate=course')).toBe(false);
        expect(isRollupsUrl('/api/v1/courses/566/outcome_results')).toBe(false);
        expect(isRollupsUrl('/api/v1/courses/566/outcome_mastery_distribution')).toBe(false);
    });
});

describe('addMissingRatingColors', () => {
    it('colors uncolored ratings from the palette and keeps existing colors', () => {
        const { json, changed } = addMissingRatingColors(rollups(), bands);
        expect(changed).toBe(3);
        expect(json.linked.outcomes[0].ratings.map(r => r.color)).toEqual(['6A4AA5', '8A9B00', 'F43F38']);
        expect(json.linked.outcomes[1].ratings[0].color).toBe('03893D');
        expect(json.rollups).toEqual(rollups().rollups);            // scores untouched
    });

    it('falls back to a neutral color without a palette', () => {
        const { json } = addMissingRatingColors(rollups(), null);
        expect(json.linked.outcomes[0].ratings.every(r => r.color === FALLBACK_RATING_COLOR)).toBe(true);
    });
});

describe('patchRollupsText', () => {
    it('keeps the while(1); prefix and only adds colors', () => {
        const out = patchRollupsText('while(1);' + JSON.stringify(rollups()), bands);
        expect(out.startsWith('while(1);')).toBe(true);
        const json = JSON.parse(out.slice('while(1);'.length));
        const expected = rollups();
        addMissingRatingColors(expected, bands);
        expect(json).toEqual(expected);
    });

    it('returns the original text when nothing is missing or it is not JSON', () => {
        const colored = JSON.stringify({ linked: { outcomes: [{ ratings: [{ points: 3, color: 'ABCDEF' }] }] } });
        expect(patchRollupsText(colored, bands)).toBe(colored);
        expect(patchRollupsText('<html>oops</html>', bands)).toBe('<html>oops</html>');
        expect(patchRollupsText('', bands)).toBe('');
    });
});

describe('installLmgbRatingColorPatch', () => {
    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;

    beforeEach(() => _resetLmgbRatingColorPatchForTests());
    afterEach(() => {
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalOpen;
    });

    it('patches fetch responses for rollups only', async () => {
        const body = JSON.stringify(rollups());
        window.fetch = vi.fn(async () => new Response(body, { status: 200 }));
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA' });

        const patched = await (await window.fetch('/api/v1/courses/566/outcome_rollups?page=1')).json();
        expect(patched.linked.outcomes[0].ratings[0].color).toBe('6A4AA5');

        const other = await (await window.fetch('/api/v1/courses/566/assignments')).text();
        expect(other).toBe(body);
    });

    it('patches XHR responseText for rollups only', () => {
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA' });
        const body = JSON.stringify(rollups());
        const textDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
        const readyDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'readyState');
        vi.spyOn(XMLHttpRequest.prototype, 'readyState', 'get').mockReturnValue(4);
        Object.defineProperty(XMLHttpRequest.prototype, 'responseText', { configurable: true, get: () => body });
        try {
            // Re-install against the stubbed getter
            _resetLmgbRatingColorPatchForTests();
            XMLHttpRequest.prototype.open = originalOpen;
            installLmgbRatingColorPatch({ schemeKey: 'sedaliaA' });

            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/v1/courses/566/outcome_rollups?page=1');
            expect(JSON.parse(xhr.responseText).linked.outcomes[0].ratings[1].color).toBe('8A9B00');

            const plain = new XMLHttpRequest();
            plain.open('GET', '/api/v1/courses/566/assignments');
            expect(plain.responseText).toBe(body);
        } finally {
            Object.defineProperty(XMLHttpRequest.prototype, 'responseText', textDesc);
            if (readyDesc) Object.defineProperty(XMLHttpRequest.prototype, 'readyState', readyDesc);
        }
    });

    it('installs once', () => {
        expect(installLmgbRatingColorPatch()).toBe(true);
        expect(installLmgbRatingColorPatch()).toBe(false);
    });
});
