// src/masteryOutlook/masteryOutlookHeatmapFullScreen.js
/**
 * Mastery Outlook Full-Screen Heatmap Generator
 *
 * Opens a new browser window and writes a self-contained HTML page
 * with the heatmap grid. All data, CSS, and JS are embedded inline.
 */

import { logger } from '../utils/logger.js';

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}

/**
 * Format date for display
 */
function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Open full-screen heatmap in new window
 *
 * @param {Object} cache - Mastery outlook cache data
 * @param {Object} options - Configuration options
 * @param {string} options.courseName - Course name for header
 * @param {string} options.colorScheme - 'soft' or 'canvas' (default: 'soft')
 */
export function openFullScreenHeatmap(cache, options = {}) {
    const {
        courseName = window.ENV?.COURSE?.name || 'Course',
        colorScheme = 'soft'
    } = options;

    logger.info('[HeatmapFullScreen] Opening full-screen heatmap');

    // Serialize cache data
    const cacheJSON = JSON.stringify(cache);
    const lastUpdated = formatDate(cache.meta?.computedAt);
    const threshold = cache.outcomes[0]?.classStats?.computedThreshold || 2.2;

    // Open new window
    const win = window.open('', '_blank', 'width=1200,height=800');
    
    if (!win) {
        alert('Popup blocked! Please allow popups for this site.');
        logger.warn('[HeatmapFullScreen] Popup blocked');
        return;
    }

    // Build self-contained HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mastery Outlook - Class Heatmap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: LatoWeb, 'Lato Extended', Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }
        
        #header {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        h1 {
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 8px;
        }
        
        .meta {
            color: #888;
            font-size: 0.9rem;
            margin-bottom: 16px;
        }
        
        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding: 12px;
            background: #f9f9f9;
            border-radius: 6px;
        }
        
        .controls label {
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .threshold-display {
            font-size: 13px;
            color: #666;
        }
        
        .threshold-display strong {
            color: #333;
            font-size: 14px;
        }
        
        #legend {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            font-size: 12px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .legend-color {
            width: 40px;
            height: 20px;
            border-radius: 4px;
            border: 1px solid rgba(0,0,0,0.1);
        }
        
        #heatmap-container {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow-x: auto;
        }
        
        table {
            border-collapse: collapse;
            background: #fff;
        }

        thead tr {
            border-bottom: 2px solid #e0e0e0;
        }

        th {
            background: #f9f9f9;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
        }

        th:hover {
            background: #f0f0f0;
        }

        th.active {
            color: #333;
            border-bottom: 2px solid #0374B5;
        }

        th.name-header {
            width: 80px;
            padding: 8px;
            text-align: left;
            font-size: 12px;
            position: sticky;
            left: 0;
            z-index: 2;
        }

        th.outcome-header {
            width: 90px;
            padding: 4px;
            font-size: 11px;
            position: relative;
            height: 100px;
            vertical-align: bottom;
        }

        .rotated-label {
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

        .sort-indicator {
            position: absolute;
            top: 4px;
            right: 4px;
            font-size: 10px;
        }

        tbody tr {
            border-bottom: 1px solid #f0f0f0;
        }

        tbody tr:hover {
            background: #fafafa;
        }

        td.name-cell {
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

        td.data-cell {
            width: 90px;
            height: 32px;
            text-align: center;
            vertical-align: middle;
            font-size: 11px;
            font-weight: 500;
            border: 1px solid #fff;
            cursor: default;
        }
    </style>
</head>
<body>
    <div id="header">
        <h1>${escapeHtml(courseName)} - Mastery Outlook: Class Heatmap</h1>
        <div class="meta">Last updated: ${escapeHtml(lastUpdated)}</div>

        <div class="controls">
            <label>
                <input type="checkbox" id="details-toggle">
                Show details
            </label>
            <div class="threshold-display">
                Threshold: <strong>${threshold.toFixed(1)}</strong>
            </div>
        </div>

        <div id="legend">
            <div class="legend-item">
                <div class="legend-color" style="background:#C0DD97;"></div>
                <span>Advanced (≥3.5)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#9FE1CB;"></div>
                <span>Proficient (≥3.0)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#FAC775;"></div>
                <span>Developing (≥2.0)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#F7C1C1;"></div>
                <span>Beginning (&lt;2.0)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:#f0f0f0;"></div>
                <span>NE (Not Enough data)</span>
            </div>
        </div>
    </div>

    <div id="heatmap-container"></div>

    <script>
        // Embedded cache data
        const cache = ${cacheJSON};

        // Configuration
        const AVG_OUTCOME_NAME = ${JSON.stringify(window.CG_CONFIG?.AVG_OUTCOME_NAME || 'Current Score')};
        const EXCLUDED_OUTCOME_KEYWORDS = ${JSON.stringify(window.CG_CONFIG?.EXCLUDED_OUTCOME_KEYWORDS || [])};
        const COLOR_SCHEME = ${JSON.stringify(colorScheme)};

        // State
        let sortState = { column: 'name', direction: 'asc' };
        let showDetails = false;

        // Helper functions
        function isExcludedOutcome(title) {
            return title === AVG_OUTCOME_NAME ||
                   EXCLUDED_OUTCOME_KEYWORDS.some(kw => title.includes(kw));
        }

        function formatStudentName(student) {
            const parts = (student.sortableName || student.name || '').split(',');
            if (parts.length >= 2) {
                const lastName = parts[0].trim();
                const firstName = parts[1].trim();
                const initial = firstName.charAt(0).toUpperCase();
                return lastName + ' ' + initial + '.';
            }
            return student.name || student.sortableName || 'Student ' + student.id;
        }

        function getCellColor(plPrediction, status) {
            if (status === 'NE' || plPrediction === null) {
                return { bg: '#f0f0f0', text: '#999' };
            }

            if (COLOR_SCHEME === 'canvas') {
                // Canvas mastery colors (5-level, bold)
                if (plPrediction >= 4.0) return { bg: '#02672D', text: '#FFFFFF' };
                if (plPrediction >= 3.0) return { bg: '#03893D', text: '#FFFFFF' };
                if (plPrediction >= 2.0) return { bg: '#FAB901', text: '#a86700' };
                if (plPrediction >= 1.0) return { bg: '#FD5D10', text: '#db3b00' };
                return { bg: '#E62429', text: '#FFFFFF' };
            } else {
                // Soft colors (4-level, pastel) - default
                if (plPrediction >= 3.5) return { bg: '#C0DD97', text: '#27500A' };
                if (plPrediction >= 3.0) return { bg: '#9FE1CB', text: '#085041' };
                if (plPrediction >= 2.0) return { bg: '#FAC775', text: '#633806' };
                return { bg: '#F7C1C1', text: '#791F1F' };
            }
        }

        function getCellContent(outcomeData, showDetails) {
            if (!showDetails) return '';
            if (outcomeData.status === 'NE' || outcomeData.plPrediction === null) {
                return 'NE';
            }
            return outcomeData.plPrediction.toFixed(2);
        }

        function buildTooltip(student, outcome, outcomeData) {
            const studentName = student.name || student.sortableName;
            const outcomeTitle = outcome.title;

            if (outcomeData.status === 'NE' || outcomeData.plPrediction === null) {
                return studentName + ' • ' + outcomeTitle + ' • NE — fewer than 3 attempts';
            }

            const pl = outcomeData.plPrediction.toFixed(2);
            return studentName + ' • ' + outcomeTitle + ' • PL: ' + pl;
        }

        function sortStudents(students, sortState) {
            const sorted = students.slice();

            if (sortState.column === 'name') {
                sorted.sort(function(a, b) {
                    const cmp = (a.sortableName || a.name).localeCompare(b.sortableName || b.name);
                    return sortState.direction === 'asc' ? cmp : -cmp;
                });
            } else {
                const outcomeId = sortState.column;
                sorted.sort(function(a, b) {
                    const aData = a.outcomes.find(function(o) { return String(o.outcomeId) === String(outcomeId); });
                    const bData = b.outcomes.find(function(o) { return String(o.outcomeId) === String(outcomeId); });

                    const aIsNE = !aData || aData.status === 'NE' || aData.plPrediction === null;
                    const bIsNE = !bData || bData.status === 'NE' || bData.plPrediction === null;

                    if (aIsNE && !bIsNE) return 1;
                    if (!aIsNE && bIsNE) return -1;
                    if (aIsNE && bIsNE) return 0;

                    const aPL = aData.plPrediction || 0;
                    const bPL = bData.plPrediction || 0;
                    const cmp = aPL - bPL;

                    return sortState.direction === 'asc' ? cmp : -cmp;
                });
            }

            return sorted;
        }

        // Filter outcomes
        const heatmapOutcomes = cache.outcomes
            .filter(function(o) { return !isExcludedOutcome(o.title); })
            .sort(function(a, b) { return (a.displayOrder || 0) - (b.displayOrder || 0); });

        // Render grid
        function renderGrid() {
            const container = document.getElementById('heatmap-container');
            container.innerHTML = '';

            const table = document.createElement('table');

            // Header row
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');

            // Name header
            const nameHeader = document.createElement('th');
            nameHeader.className = 'name-header' + (sortState.column === 'name' ? ' active' : '');
            nameHeader.textContent = 'Name ';
            if (sortState.column === 'name') {
                const indicator = document.createElement('span');
                indicator.textContent = sortState.direction === 'asc' ? '▲' : '▼';
                indicator.style.fontSize = '10px';
                nameHeader.appendChild(indicator);
            }
            nameHeader.onclick = function() {
                if (sortState.column === 'name') {
                    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    sortState.column = 'name';
                    sortState.direction = 'asc';
                }
                renderGrid();
            };
            headerRow.appendChild(nameHeader);

            // Outcome headers
            heatmapOutcomes.forEach(function(outcome) {
                const th = document.createElement('th');
                th.className = 'outcome-header' + (sortState.column === String(outcome.id) ? ' active' : '');

                const label = document.createElement('div');
                label.className = 'rotated-label';
                label.textContent = outcome.title.length > 30 ? outcome.title.substring(0, 30) + '...' : outcome.title;
                label.title = outcome.title;
                th.appendChild(label);

                if (sortState.column === String(outcome.id)) {
                    const indicator = document.createElement('span');
                    indicator.className = 'sort-indicator';
                    indicator.textContent = sortState.direction === 'asc' ? '▲' : '▼';
                    th.appendChild(indicator);
                }

                th.onclick = function() {
                    if (sortState.column === String(outcome.id)) {
                        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.column = String(outcome.id);
                        sortState.direction = 'asc';
                    }
                    renderGrid();
                };

                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Body rows
            const tbody = document.createElement('tbody');
            const sortedStudents = sortStudents(cache.students, sortState);

            sortedStudents.forEach(function(student) {
                const row = document.createElement('tr');

                // Name cell with link to individual mastery dashboard
                const nameCell = document.createElement('td');
                nameCell.className = 'name-cell';

                // Use cached masteryDashboardUrl or fallback to default
                const masteryDashboardUrl = cache.meta.masteryDashboardUrl || 'mastery-dashboard';

                // Create link (opens in parent window)
                const link = document.createElement('a');
                link.href = '/courses/' + cache.meta.courseId + '/pages/' + masteryDashboardUrl + '?cg_web=1&student_id=' + student.id;
                link.textContent = formatStudentName(student);
                link.title = "View " + (student.name || student.sortableName) + "'s individual mastery dashboard";
                link.style.cssText = 'color:#333; text-decoration:none; font-weight:500;';
                link.target = '_blank';  // Open in new tab from full-screen window
                link.onmouseenter = function() {
                    this.style.textDecoration = 'underline';
                    this.style.color = '#0374B5';
                };
                link.onmouseleave = function() {
                    this.style.textDecoration = 'none';
                    this.style.color = '#333';
                };

                nameCell.appendChild(link);
                row.appendChild(nameCell);

                // Outcome cells
                heatmapOutcomes.forEach(function(outcome) {
                    const outcomeData = student.outcomes.find(function(o) {
                        return String(o.outcomeId) === String(outcome.id);
                    }) || { status: 'NE', plPrediction: null };

                    const colors = getCellColor(outcomeData.plPrediction, outcomeData.status);
                    const content = getCellContent(outcomeData, showDetails);
                    const tooltip = buildTooltip(student, outcome, outcomeData);

                    const cell = document.createElement('td');
                    cell.className = 'data-cell';
                    cell.style.background = colors.bg;
                    cell.style.color = colors.text;
                    cell.textContent = content;
                    cell.title = tooltip;

                    row.appendChild(cell);
                });

                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            container.appendChild(table);
        }

        // Initial render
        renderGrid();

        // Wire details toggle
        document.getElementById('details-toggle').addEventListener('change', function(e) {
            showDetails = e.target.checked;
            renderGrid();
        });
    </script>
</body>
</html>
    `;

    // Write to window
    win.document.open();
    win.document.write(html);
    win.document.close();

    logger.info('[HeatmapFullScreen] Full-screen heatmap opened successfully');
}