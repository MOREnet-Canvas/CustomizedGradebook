// src/masteryOutlook/heatmapView.js
/**
 * Mastery Outlook — Heatmap view (peer of the Outcomes view).
 *
 * Renders the class-wide heatmap grid into shell.heatmapView and wires up
 * the "open in full screen" button. Conforms to the view-registry contract
 * (see viewRegistry.js): `mount(shell, cache, ctx) → { teardown, refresh }`.
 *
 * Color scheme is read from `ctx.getColorScheme()` on every render so that
 * the host's color-scheme toggle can call `refresh()` and pick up the change
 * without re-mounting the view.
 */

import { logger } from '../utils/logger.js';
import { buildHeatmapGrid } from './masteryOutlookHeatmap.js';
import { openFullScreenHeatmap } from './masteryOutlookHeatmapFullScreen.js';

/**
 * Mount the heatmap view.
 *
 * @param {Object} shell - shell handle from buildShell() in masteryOutlookView.js
 * @param {Object} cache - enriched mastery-outlook cache
 * @param {import('./viewRegistry.js').ViewContext} ctx
 * @returns {import('./viewRegistry.js').ViewController}
 */
export function mountHeatmapView(shell, cache, ctx) {
    const render = () => {
        shell.heatmapView.innerHTML = '';

        if (!cache || !cache.students || cache.students.length === 0) {
            shell.heatmapView.innerHTML = `
                <div class="od-heatmap-empty">
                    <div class="he-icon">🔥</div>
                    <div class="he-title">No heatmap data yet</div>
                    <div class="he-body">
                        Hit <strong>Refresh Data</strong> to calculate Power Law
                        predictions and generate the class heatmap.
                    </div>
                </div>
            `;
            return;
        }

        const colorScheme = ctx.getColorScheme();
        const heatmapGrid = buildHeatmapGrid(cache, {
            cellWidth: 80,
            cellHeight: 28,
            colorScheme,
            onFullScreen: () => {
                const courseName = window.ENV?.COURSE?.name || 'Course';
                openFullScreenHeatmap(cache, { courseName, colorScheme: ctx.getColorScheme() });
            }
        });

        shell.heatmapView.appendChild(heatmapGrid);
        logger.info('[MasteryOutlook] Heatmap rendered');
    };

    render();

    return {
        teardown: () => {
            shell.heatmapView.innerHTML = '';
        },
        refresh: render,
    };
}
