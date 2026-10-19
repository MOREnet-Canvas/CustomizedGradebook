import { describe, it, expect, beforeEach } from 'vitest';
import { getOptInPalette, getReadableTextColor, getBandIndex } from './masteryColors.js';
import {
    buildMasteryColorCss,
    ensureMasteryColorStyles,
    getMasteryBandClass,
    getBandClassName,
} from './masteryColorStyles.js';

describe('getOptInPalette', () => {
    it('resolves the built-in Sedalia scheme', () => {
        const p = getOptInPalette('sedaliaA');
        expect(p.label).toBe('Sedalia Mastery Color Scheme A');
        expect(p.bands).toHaveLength(10);
    });

    it('returns null for unknown or empty keys', () => {
        expect(getOptInPalette('nope')).toBeNull();
        expect(getOptInPalette(null)).toBeNull();
        expect(getOptInPalette('x', { x: { bands: [] } })).toBeNull();
    });

    it('normalizes district palettes: sorts bands and fills fg/accent', () => {
        const p = getOptInPalette('d', {
            d: { bands: [{ min: 0, bg: '#000000' }, { min: 3, bg: '#FFFFFF' }] },
        });
        expect(p.bands.map(b => b.min)).toEqual([3, 0]);
        expect(p.bands[0]).toMatchObject({ fg: '#000000', accent: '#FFFFFF' });
        expect(p.bands[1].fg).toBe('#FFFFFF');
    });
});

describe('getReadableTextColor', () => {
    it('picks the higher-contrast text color', () => {
        expect(getReadableTextColor('#6A4AA5')).toBe('#FFFFFF');
        expect(getReadableTextColor('#8A9B00')).toBe('#000000');
        expect(getReadableTextColor('bad')).toBe('#000000');
    });
});

describe('band lookup', () => {
    const { bands } = getOptInPalette('sedaliaA');

    it.each([
        [4, 0], [3.99, 1], [3, 2], [0.5, 7], [0.1, 8], [0.05, 9], [0, 9],
    ])('score %s is band %s', (score, index) => {
        expect(getBandIndex(score, bands)).toBe(index);
        expect(getMasteryBandClass(score, 'sedaliaA', bands)).toBe(getBandClassName('sedaliaA', index));
    });

    it('returns null for non-numeric scores', () => {
        expect(getMasteryBandClass(NaN, 'sedaliaA', bands)).toBeNull();
        expect(getMasteryBandClass(undefined, 'sedaliaA', bands)).toBeNull();
    });
});

describe('mastery color CSS', () => {
    const { bands } = getOptInPalette('sedaliaA');

    beforeEach(() => { document.head.innerHTML = ''; });

    it('emits one rule per band', () => {
        const css = buildMasteryColorCss('sedaliaA', bands);
        bands.forEach((b, i) => {
            expect(css).toContain(`.${getBandClassName('sedaliaA', i)} {`);
            expect(css).toContain(`--cg-mastery-bg: ${b.bg};`);
        });
    });

    it('injects base + scheme styles once', () => {
        ensureMasteryColorStyles('sedaliaA', bands);
        ensureMasteryColorStyles('sedaliaA', bands);
        expect(document.head.querySelectorAll('style')).toHaveLength(2);
    });
});
