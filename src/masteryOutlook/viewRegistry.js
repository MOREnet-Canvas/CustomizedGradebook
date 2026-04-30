// src/masteryOutlook/viewRegistry.js
/**
 * Mastery Outlook view registry.
 *
 * Each tabbed view in the dashboard (Outcomes, Heatmap, Stoplight, …) is a
 * peer module that exports a `mount(shell, cache, ctx) → ViewController`
 * function. The registry below names them, gives them a tab label, and
 * declares whether the shared sidebar should be visible while they're active.
 *
 * The host (masteryOutlookView.js) drives the tab bar off this list:
 * switching views calls `teardown()` on the outgoing view and `mount()` on
 * the incoming one; shared chrome (color toggle, threshold slider) calls
 * `refresh()` on the active controller to re-render in place.
 *
 * Adding a new view = export a `mount*View` function and add one entry below.
 */

import { mountHeatmapView } from './heatmapView.js';
import { mountOutcomeSyncView, initOutcomeSyncContainer } from './outcomeSyncView.js';

/**
 * @typedef {Object} ViewContext
 * @property {string}   courseId
 * @property {Object}   apiClient
 * @property {Function} onRefresh        - () => Promise<void>; full data refresh
 * @property {Function} getColorScheme   - () => 'soft' | 'canvas'
 * @property {Function} getThreshold     - () => number
 *
 * @typedef {Object} ViewController
 * @property {Function} teardown - tear down listeners + DOM owned by this view
 * @property {Function} refresh  - re-render in place against current cache + ctx
 *
 * @typedef {Object} ViewDescriptor
 * @property {string}   id              - stable identifier (also tab dataset key)
 * @property {string}   label           - tab button label
 * @property {boolean}  hasSidebar      - whether the shared sidebar should show
 * @property {(containerEl: HTMLElement) => void} [initContainer] - optional
 *           one-time DOM scaffolding for the view's container; runs during
 *           shell construction before the first mount
 * @property {(shell: Object, cache: Object, ctx: ViewContext) => ViewController} mount
 */

/**
 * Registered peer views. Listed in tab-bar display order.
 *
 * @type {ViewDescriptor[]}
 */
export const VIEWS = [
    {
        id: 'outcomes',
        label: 'Outcomes',
        hasSidebar: true,
        initContainer: initOutcomeSyncContainer,
        mount: mountOutcomeSyncView,
    },
    {
        id: 'heatmap',
        label: '🔥 Heatmap',
        hasSidebar: false,
        mount: mountHeatmapView,
    },
];

/**
 * Look up a registered view descriptor by id.
 *
 * @param {string} id
 * @returns {ViewDescriptor | undefined}
 */
export function getView(id) {
    return VIEWS.find(v => v.id === id);
}