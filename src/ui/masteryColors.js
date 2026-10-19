// src/ui/masteryColors.js
/**
 * Mastery palette — single source of truth for score→color mapping.
 *
 * Two schemes:
 *   - 'canvas': 5-level (bold) palette matching Canvas mastery colors.
 *   - 'soft':   4-level (pastel) palette used by Mastery Outlook by default.
 *
 * Each band has four semantic slots:
 *   - bg           — filled background (chips, badges, large fills)
 *   - fg           — text/icon color when sitting on `bg`
 *   - accent       — borders, bullets, dots — sits alone on a neutral surface
 *   - fgOnSurface  — readable text color on a white/near-white surface
 *
 * For most bands `accent === bg`. The yellow band is the only exception:
 * its bright `accent` (#FAB901) is used for decorative dots/borders, while
 * the slightly darker `bg` (#EF9F27) is paired with white text for chip
 * backgrounds, and `fgOnSurface` (#a86700) is the WCAG-AA-safe body color.
 */

export const MASTERY_PALETTES = {
    canvas: [
        { min: 4.0, bg: '#02672D', fg: '#FFFFFF', accent: '#02672D', fgOnSurface: '#02672D' },
        { min: 3.0, bg: '#03893D', fg: '#FFFFFF', accent: '#03893D', fgOnSurface: '#03893D' },
        { min: 2.0, bg: '#EF9F27', fg: '#FFFFFF', accent: '#FAB901', fgOnSurface: '#a86700' },
        { min: 1.0, bg: '#FD5D10', fg: '#FFFFFF', accent: '#FD5D10', fgOnSurface: '#db3b00' },
        { min: 0.0, bg: '#E62429', fg: '#FFFFFF', accent: '#E62429', fgOnSurface: '#E62429' },
    ],
    soft: [
        { min: 3.5, bg: '#C0DD97', fg: '#27500A', accent: '#C0DD97', fgOnSurface: '#27500A' },
        { min: 3.0, bg: '#9FE1CB', fg: '#085041', accent: '#9FE1CB', fgOnSurface: '#085041' },
        { min: 2.0, bg: '#FAC775', fg: '#633806', accent: '#FAC775', fgOnSurface: '#633806' },
        { min: 0.0, bg: '#F7C1C1', fg: '#791F1F', accent: '#F7C1C1', fgOnSurface: '#791F1F' },
    ],
};

/** Neutral color for cells/rows with no evidence (NE) in heatmap-style views. */
export const NE_HEATMAP_COLOR = Object.freeze({ bg: '#f0f0f0', text: '#999' });

/**
 * Resolve the palette band for a given score.
 *
 * Null/NaN scores fall through to the lowest band (treated as 0). Callers
 * that want a distinct "no evidence" rendering should check for null
 * themselves before calling this and use {@link NE_HEATMAP_COLOR} or similar.
 *
 * @param {number|null|undefined} score
 * @param {Object} [opts]
 * @param {'canvas'|'soft'} [opts.scheme='soft']
 * @returns {{ bg:string, fg:string, accent:string, fgOnSurface:string, min:number }}
 */
export function getMasteryColor(score, opts = {}) {
    const scheme = opts.scheme === 'canvas' ? 'canvas' : 'soft';
    const palette = MASTERY_PALETTES[scheme];
    const v = (score == null || isNaN(score)) ? 0 : Number(score);
    for (const band of palette) {
        if (v >= band.min) return band;
    }
    return palette[palette.length - 1];
}

/* ------------------------------------------------------------------
   Tone helpers (used by studentSyncTable's chip styling).
   These use midpoint thresholds and CSS custom properties defined in
   plOutlookStyles.js (--s-hi, --s-good, --s-dev, --s-low and *-ink),
   so they intentionally diverge from the band thresholds above.
   ------------------------------------------------------------------ */

/**
 * Map a 0–4 score to a tone key.
 * @param {number|null|undefined} v
 * @returns {'hi'|'good'|'dev'|'low'|'ne'}
 */
export function scoreTone(v) {
    if (v == null) return 'ne';
    const c = Math.max(0, Math.min(4, v));
    if (c >= 3.25) return 'hi';
    if (c >= 2.5)  return 'good';
    if (c >= 1.75) return 'dev';
    return 'low';
}

/**
 * Inline background+color style string for a score tone.
 * @param {'hi'|'good'|'dev'|'low'|'ne'} tone
 * @returns {string}
 */
export function scoreToneStyle(tone) {
    if (tone === 'ne') return 'background:var(--bg-secondary);color:var(--text-tertiary);';
    return `background:var(--s-${tone});color:var(--s-${tone}-ink);`;
}

/* ------------------------------------------------------------------
   Opt-in palettes.
   Not offered by Mastery Outlook / Mastery View. A district enables one
   by naming its key in config (e.g. LMGB_MASTERY_SCHEME: 'sedaliaA').
   Bands use { min, bg, fg, accent, label } — sorted high → low.
   ------------------------------------------------------------------ */

export const OPT_IN_MASTERY_PALETTES = {
    sedaliaA: {
        label: 'Sedalia Mastery Color Scheme A',
        bands: [
            { min: 4.0, bg: '#6A4AA5', fg: '#FFFFFF', accent: '#6A4AA5', label: 'Exemplary' },
            { min: 3.5, bg: '#963C9F', fg: '#FFFFFF', accent: '#963C9F', label: 'Beyond Target' },
            { min: 3.0, bg: '#009B14', fg: '#000000', accent: '#009B14', label: 'Target' },
            { min: 2.5, bg: '#8A9B00', fg: '#000000', accent: '#8A9B00', label: 'Approaching Target' },
            { min: 2.0, bg: '#485BB0', fg: '#FFFFFF', accent: '#485BB0', label: 'Developing' },
            { min: 1.5, bg: '#1979AE', fg: '#FFFFFF', accent: '#1979AE', label: 'Beginning' },
            { min: 1.0, bg: '#1199DA', fg: '#000000', accent: '#1199DA', label: 'Needs Partial Support' },
            { min: 0.5, bg: '#DA7600', fg: '#000000', accent: '#DA7600', label: 'Needs Full Support' },
            { min: 0.1, bg: '#EB5A83', fg: '#000000', accent: '#EB5A83', label: 'Insufficient Evidence' },
            { min: 0.0, bg: '#F43F38', fg: '#000000', accent: '#F43F38', label: 'No Evidence' },
        ],
    },
};

/**
 * Pick black or white text for a hex background using WCAG relative
 * luminance (whichever gives the higher contrast ratio).
 *
 * @param {string} hex - '#RRGGBB'
 * @returns {'#000000'|'#FFFFFF'}
 */
export function getReadableTextColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#000000';
    const [r, g, b] = [0, 2, 4].map(i => {
        const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? '#FFFFFF' : '#000000';
}

/**
 * Resolve an opt-in palette by key.
 *
 * District palettes (`customPalettes`, from CG_CONFIG.CUSTOM_MASTERY_PALETTES)
 * override built-ins with the same key. Bands are validated, sorted high → low,
 * and missing `fg`/`accent` are filled in. Returns null for an unknown key or
 * a palette with no valid bands.
 *
 * @param {string|null|undefined} key
 * @param {Object<string, {label?:string, bands:Array}>} [customPalettes]
 * @returns {{ key:string, label:string, bands:Array<{min:number,bg:string,fg:string,accent:string,label:string}> }|null}
 */
export function getOptInPalette(key, customPalettes = {}) {
    if (!key) return null;
    const source = (customPalettes && customPalettes[key]) || OPT_IN_MASTERY_PALETTES[key];
    if (!source || !Array.isArray(source.bands)) return null;

    const bands = source.bands
        .filter(b => b && Number.isFinite(Number(b.min)) && typeof b.bg === 'string')
        .map(b => ({
            min: Number(b.min),
            bg: b.bg,
            fg: b.fg || getReadableTextColor(b.bg),
            accent: b.accent || b.bg,
            label: b.label || '',
        }))
        .sort((a, b) => b.min - a.min);

    if (!bands.length) return null;
    return { key, label: source.label || key, bands };
}

/**
 * Index of the band a score falls into (first band whose `min` ≤ score).
 * Scores below every band fall into the lowest band.
 *
 * @param {number} score
 * @param {Array<{min:number}>} bands - sorted high → low
 * @returns {number} band index, or -1 if score is not a finite number
 */
export function getBandIndex(score, bands) {
    if (typeof score !== 'number' || !Number.isFinite(score) || !bands?.length) return -1;
    const i = bands.findIndex(b => score >= b.min);
    return i === -1 ? bands.length - 1 : i;
}
