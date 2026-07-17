// src/masteryOutlook/masteryOutlookHeatmapStyles.js
/**
 * Heatmap Grid — injected CSS
 *
 * Static styles for buildHeatmapGrid() DOM.
 * Injected once via injectStyles(HEATMAP_CSS, 'mo-heatmap-styles').
 *
 * Dynamic values (sort-active color/border, cell bg/color, cellWidth/cellHeight)
 * remain as inline styles in masteryOutlookHeatmap.js.
 */

export const HEATMAP_CSS = `

/* Container — font stack (FONT constant retired) */
.heatmap-container {
  font-family: LatoWeb, 'Lato Extended', Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

/* Header row: details toggle + full-screen link */
.hm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

/* Details toggle label */
.hm-toggle-label {
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hm-toggle-checkbox { cursor: pointer; }

/* Full-screen link */
.hm-fullscreen-link {
  font-size: 12px;
  color: #0374B5;
  text-decoration: none;
}
.hm-fullscreen-link:hover { text-decoration: underline; }

/* Scrollable grid wrapper */
.hm-grid-wrapper {
  overflow-x: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

/* Table */
.hm-table {
  border-collapse: collapse;
  background: #fff;
}

/* Thead row */
.hm-header-row { border-bottom: 2px solid #e0e0e0; }

/* Sort column header — static parts shared by both name and outcome headers.
   Dynamic: color and border-bottom set inline to reflect sort state.         */
.hm-sort-header {
  padding: 8px;
  cursor: pointer;
  background: #f9f9f9;
}
.hm-sort-header--name {
  width: 80px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  position: sticky;
  left: 0;
  z-index: 2;
}
.hm-sort-header--outcome {
  padding: 4px;
  font-size: 11px;
  font-weight: 500;
  position: relative;
  height: 100px;
  vertical-align: bottom;
}

/* Sort direction indicator appended inside th */
.hm-sort-indicator { font-size: 10px; }

/* Rotated outcome label inside th */
.hm-label-container {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%) rotate(-45deg);
  transform-origin: left bottom;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  font-size: 11px;
}

/* Corner sort indicator (absolute inside outcome th) */
.hm-sort-indicator-corner {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
}

/* Data rows */
.hm-data-row { border-bottom: 1px solid #f0f0f0; }

/* Sticky student-name cell */
.hm-name-cell {
  width: 80px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 500;
  background: #fff;
  border-right: 1px solid #e0e0e0;
  position: sticky;
  left: 0;
  z-index: 1;
}

/* Student name link (hover handled in CSS; no JS mouseenter/mouseleave needed) */
.hm-name-link {
  color: #333;
  text-decoration: none;
  font-weight: 500;
}
.hm-name-link:hover {
  text-decoration: underline;
  color: #0374B5;
}

/* Outcome data cell — static parts only.
   Dynamic: width, height, background, color set inline per cell.             */
.hm-cell {
  text-align: center;
  vertical-align: middle;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #fff;
  cursor: default;
}
`;
