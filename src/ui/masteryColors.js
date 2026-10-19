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
