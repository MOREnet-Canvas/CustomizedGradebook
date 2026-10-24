// src/gradebook/lmgbRatingColorPatch.test.js
// Canvas's LMGB drops scores whose rating has no color; the patch fills in only
// the missing colors on outcome_rollups responses, and reloads once when Canvas
// read an uncolored response before the patch was installed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    addMissingRatingColors, patchRollupsText, isRollupsUrl, hasUncoloredRatings,
    installLmgbRatingColorPatch, recoverMissedRollups, _resetLmgbRatingColorPatchForTests,
    FALLBACK_RATING_COLOR,
} from './lmgbRatingColorPatch.js';
import { getOptInPalette } from '../ui/masteryColors.js';

const bands = getOptInPalette('sedaliaA').bands;
const ROLLUPS = 'https://lab.instructure.com/api/v1/courses/566/outcome_rollups?per_page=15&page=1';

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
const colored = () => ({ linked: { outcomes: [{ ratings: [{ points: 3, color: 'ABCDEF' }] }] } });

afterEach(() => {
    _resetLmgbRatingColorPatchForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('helpers', () => {
    it('isRollupsUrl matches the LMGB rollups request only', () => {
        expect(isRollupsUrl('/api/v1/courses/566/outcome_rollups?per_page=15&include%5B%5D=outcomes')).toBe(true);
        expect(isRollupsUrl(ROLLUPS)).toBe(true);
        expect(isRollupsUrl('/api/v1/courses/566/outcome_rollups?aggregate=course')).toBe(false);
        expect(isRollupsUrl('/api/v1/courses/566/outcome_results')).toBe(false);
        expect(isRollupsUrl('/api/v1/courses/566/outcome_mastery_distribution')).toBe(false);
    });

    it('colors uncolored ratings from the palette and keeps existing colors and scores', () => {
        const { json, changed } = addMissingRatingColors(rollups(), bands);
        expect(changed).toBe(3);
        expect(json.linked.outcomes[0].ratings.map(r => r.color)).toEqual(['6A4AA5', '8A9B00', 'F43F38']);
        expect(json.linked.outcomes[1].ratings[0].color).toBe('03893D');
        expect(json.rollups).toEqual(rollups().rollups);
    });

    it('falls back to a neutral color without a palette', () => {
        const { json } = addMissingRatingColors(rollups(), null);
        expect(json.linked.outcomes[0].ratings.every(r => r.color === FALLBACK_RATING_COLOR)).toBe(true);
    });

    it('hasUncoloredRatings', () => {
        expect(hasUncoloredRatings(rollups())).toBe(true);
        expect(hasUncoloredRatings(colored())).toBe(false);
    });

    it('patchRollupsText keeps the while(1); prefix and only adds colors', () => {
        const out = patchRollupsText('while(1);' + JSON.stringify(rollups()), bands);
        expect(out.startsWith('while(1);')).toBe(true);
        const expected = rollups();
        addMissingRatingColors(expected, bands);
        expect(JSON.parse(out.slice('while(1);'.length))).toEqual(expected);
    });

    it('patchRollupsText returns the original text when nothing is missing or it is not JSON', () => {
        const text = JSON.stringify(colored());
        expect(patchRollupsText(text, bands)).toBe(text);
        expect(patchRollupsText('<html>oops</html>', bands)).toBe('<html>oops</html>');
        expect(patchRollupsText('', bands)).toBe('');
    });
});

describe('XHR (prototype-level)', () => {
    let saved;
    /** Stub the native XHR getters so a request "has completed" without a network. */
    function stubXhr(body, { url = ROLLUPS, responseType = '' } = {}) {
        const proto = XMLHttpRequest.prototype;
        saved = ['responseText', 'response', 'readyState', 'responseURL', 'responseType']
            .map(k => [k, Object.getOwnPropertyDescriptor(proto, k)]);
        Object.defineProperty(proto, 'responseText', { configurable: true, get: () => body });
        Object.defineProperty(proto, 'response', {
            configurable: true, get: () => (responseType === 'json' ? JSON.parse(body) : body),
        });
        Object.defineProperty(proto, 'readyState', { configurable: true, get: () => 4 });
        Object.defineProperty(proto, 'responseURL', { configurable: true, get: () => url });
        Object.defineProperty(proto, 'responseType', { configurable: true, get: () => responseType });
    }
    afterEach(() => {
        _resetLmgbRatingColorPatchForTests();
        saved?.forEach(([k, d]) => (d ? Object.defineProperty(XMLHttpRequest.prototype, k, d)
            : delete XMLHttpRequest.prototype[k]));
        saved = null;
    });

    it('patches responseText for rollups, including requests created before install', () => {
        stubXhr(JSON.stringify(rollups()));
        const earlyXhr = new XMLHttpRequest();          // Canvas started this before our bundle ran
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA', reload: vi.fn() });
        expect(JSON.parse(earlyXhr.responseText).linked.outcomes[0].ratings[1].color).toBe('8A9B00');
        expect(JSON.parse(earlyXhr.response).linked.outcomes[0].ratings[0].color).toBe('6A4AA5');
    });

    it('patches responseType json', () => {
        stubXhr(JSON.stringify(rollups()), { responseType: 'json' });
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA', reload: vi.fn() });
        expect(new XMLHttpRequest().response.linked.outcomes[0].ratings[2].color).toBe('F43F38');
    });

    it('leaves other URLs untouched', () => {
        const body = JSON.stringify(rollups());
        stubXhr(body, { url: 'https://lab.instructure.com/api/v1/courses/566/assignments' });
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA', reload: vi.fn() });
        expect(new XMLHttpRequest().responseText).toBe(body);
    });
});

describe('fetch', () => {
    it('patches fetch responses for rollups only', async () => {
        const body = JSON.stringify(rollups());
        vi.spyOn(window, 'fetch').mockImplementation(async () => new Response(body, { status: 200 }));
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA', reload: vi.fn() });

        const patched = await (await window.fetch(ROLLUPS)).json();
        expect(patched.linked.outcomes[0].ratings[0].color).toBe('6A4AA5');
        expect(await (await window.fetch('/api/v1/courses/566/assignments')).text()).toBe(body);
    });

    it('installs once', () => {
        expect(installLmgbRatingColorPatch({ reload: vi.fn() })).toBe(true);
        expect(installLmgbRatingColorPatch({ reload: vi.fn() })).toBe(false);
    });
});

describe('recoverMissedRollups', () => {
    function setup({ responseEnd = 500, body = rollups() } = {}) {
        vi.spyOn(performance, 'now').mockReturnValue(1000);   // patch installed at t=1000
        vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ name: ROLLUPS, responseEnd }]);
        const fetchMock = vi.spyOn(window, 'fetch')
            .mockImplementation(async () => new Response('while(1);' + JSON.stringify(body), { status: 200 }));
        installLmgbRatingColorPatch({ schemeKey: 'sedaliaA', reload: vi.fn() });
        const store = new Map();
        const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
        return { fetchMock, storage };
    }

    it('reloads once when Canvas read an uncolored response before install', async () => {
        const { storage } = setup();
        const reload = vi.fn();
        expect(await recoverMissedRollups({ reload, storage })).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);

        // A second miss right after (e.g. the reload still lost the race) does not loop
        const reload2 = vi.fn();
        expect(await recoverMissedRollups({ reload: reload2, storage })).toBe(false);
        expect(reload2).not.toHaveBeenCalled();
    });

    it('no reload when the ratings already have colors (≤6-level scales)', async () => {
        const { storage } = setup({ body: colored() });
        const reload = vi.fn();
        expect(await recoverMissedRollups({ reload, storage })).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it('no reload when the response finished after install', async () => {
        const { fetchMock, storage } = setup({ responseEnd: 1500 });
        const reload = vi.fn();
        expect(await recoverMissedRollups({ reload, storage })).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('no reload when the patch served that response after all', async () => {
        const { storage } = setup();
        // Canvas read the finished response through the (already installed) patch
        await window.fetch(ROLLUPS);
        const reload = vi.fn();
        expect(await recoverMissedRollups({ reload, storage })).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it('install schedules the check', async () => {
        vi.useFakeTimers();
        vi.spyOn(performance, 'now').mockReturnValue(1000);
        vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
        const reload = vi.fn();
        installLmgbRatingColorPatch({ reload });
        await vi.advanceTimersByTimeAsync(2000);
        expect(performance.getEntriesByType).toHaveBeenCalledWith('resource');
        expect(reload).not.toHaveBeenCalled();
    });
});
