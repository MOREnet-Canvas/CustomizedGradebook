// src/dashboard/cardRendererStyles.js
/**
 * Dashboard grade badge styles.
 *
 * Static styling for the grade badge rendered on Canvas dashboard cards.
 * Extracted from the inline cssText that cardRenderer.js previously set on
 * each badge so the visual rules live in one place.
 *
 * Consumed by: cardRenderer.js → injectStyles(CARD_RENDERER_CSS, 'cg-dashboard-grade-styles')
 *
 * Note: the badge background colour is derived per-card from the hero/header
 * colour at render time, so it stays an inline style on the element. Everything
 * else is static and lives here.
 */

export const CARD_RENDERER_CSS = `
.cg-dashboard-grade {
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 0.875rem;
    line-height: 1.4;
    border-radius: 8px;
    color: #fff;
    display: inline-block;
    text-align: center;
    box-sizing: border-box;
    padding: 6px 10px;
    font-weight: 600;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
}
`;
