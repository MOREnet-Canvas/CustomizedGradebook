// src/masteryOutlook/masteryOutlookHeatmap.js
/**
 * Mastery Outlook Heatmap Grid Builder
 *
 * Builds heatmap grid DOM for both in-dashboard and full-screen views.
 * Displays students (rows) × outcomes (columns) with PL prediction colors.
 */

import { logger } from '../utils/logger.js';
import { AVG_OUTCOME_NAME, EXCLUDED_OUTCOME_KEYWORDS } from '../config.js';
import { getMasteryColor, NE_HEATMAP_COLOR } from '../ui/masteryColors.js';
import { injectStyles } from '../ui/styles.js';
import { HEATMAP_CSS } from './masteryOutlookHeatmapStyles.js';

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if outcome should be excluded from heatmap
 */
function isExcludedOutcome(outcomeTitle) {
    return outcomeTitle === AVG_OUTCOME_NAME || 
           EXCLUDED_OUTCOME_KEYWORDS.some(kw => outcomeTitle.includes(kw));
}

/**
 * Format student name: "Smith, Jane" → "Smith J."
 */
function formatStudentName(student) {
    const parts = (student.sortableName || student.name || '').split(',');
    if (parts.length >= 2) {
        const lastName = parts[0].trim();
        const firstName = parts[1].trim();
        const initial = firstName.charAt(0).toUpperCase();
        return `${lastName} ${initial}.`;
    }
    return student.name || student.sortableName || `Student ${student.id}`;
}

/**
 * Get color for PL prediction value.
 * Delegates to the shared mastery palette in src/ui/masteryColors.js.
 */
function getCellColor(plPrediction, status, colorScheme = 'soft') {
    if (status === 'NE' || plPrediction === null) {
        return { bg: NE_HEATMAP_COLOR.bg, text: NE_HEATMAP_COLOR.text };
    }
    const c = getMasteryColor(plPrediction, { scheme: colorScheme });
    return { bg: c.bg, text: c.fg };
}

/**
 * Get cell content based on details mode
 */
function getCellContent(outcomeData, showDetails) {
    if (!showDetails) return '';
    
    if (outcomeData.status === 'NE' || outcomeData.plPrediction === null) {
        return 'NE';
    }
    return outcomeData.plPrediction.toFixed(2);
}

/**
 * Build tooltip text
 */
function buildTooltip(student, outcome, outcomeData) {
    const studentName = student.name || student.sortableName;
    const outcomeTitle = outcome.title;
    
    if (outcomeData.status === 'NE' || outcomeData.plPrediction === null) {
        return `${studentName} • ${outcomeTitle} • NE — fewer than 3 attempts`;
    }
    
    const pl = outcomeData.plPrediction.toFixed(2);
    return `${studentName} • ${outcomeTitle} • PL: ${pl}`;
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}

/**
 * Sort students based on sort state
 */
function sortStudents(students, sortState) {
    const sorted = [...students];
    
    if (sortState.column === 'name') {
        sorted.sort((a, b) => {
            const cmp = (a.sortableName || a.name).localeCompare(b.sortableName || b.name);
            return sortState.direction === 'asc' ? cmp : -cmp;
        });
    } else {
        // Outcome column
        const outcomeId = sortState.column;
        sorted.sort((a, b) => {
            const aData = a.outcomes.find(o => String(o.outcomeId) === String(outcomeId));
            const bData = b.outcomes.find(o => String(o.outcomeId) === String(outcomeId));
            
            const aIsNE = !aData || aData.status === 'NE' || aData.plPrediction === null;
            const bIsNE = !bData || bData.status === 'NE' || bData.plPrediction === null;
            
            // NE always to bottom regardless of direction
            if (aIsNE && !bIsNE) return 1;
            if (!aIsNE && bIsNE) return -1;
            if (aIsNE && bIsNE) return 0;
            
            const aPL = aData?.plPrediction || 0;
            const bPL = bData?.plPrediction || 0;
            const cmp = aPL - bPL;
            
            return sortState.direction === 'asc' ? cmp : -cmp;
        });
    }
    
    return sorted;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build heatmap grid DOM
 *
 * @param {Object} cache - Mastery outlook cache data
 * @param {Object} options - Configuration options
 * @param {number} options.cellWidth - Cell width in px (default: 80)
 * @param {number} options.cellHeight - Cell height in px (default: 28)
 * @param {string} options.colorScheme - 'soft' or 'canvas' (default: 'soft')
 * @param {Function} options.onFullScreen - Callback when full screen link clicked
 * @returns {HTMLElement} Heatmap container element
 */
export function buildHeatmapGrid(cache, options = {}) {
    const {
        cellWidth = 80,
        cellHeight = 28,
        colorScheme = 'soft',
        onFullScreen = null
    } = options;

    injectStyles(HEATMAP_CSS, 'mo-heatmap-styles');
    logger.debug('[Heatmap] Building grid');

    // Filter outcomes (exclude AVG and excluded keywords)
    const heatmapOutcomes = cache.outcomes
        .filter(o => !isExcludedOutcome(o.title))
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    logger.debug(`[Heatmap] Displaying ${heatmapOutcomes.length} outcomes, ${cache.students.length} students`);

    // Sort state (local to this heatmap instance)
    let sortState = { column: 'name', direction: 'asc' };
    let showDetails = false;

    // Container
    const container = document.createElement('div');
    container.className = 'heatmap-container';

    // Header (details toggle + full screen link)
    const header = document.createElement('div');
    header.className = 'hm-header';

    // Details toggle
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'hm-toggle-label';
    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.id = 'heatmap-details-toggle';
    toggleCheckbox.className = 'hm-toggle-checkbox';
    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(document.createTextNode('Show details'));

    // Full screen link (hover handled by .hm-fullscreen-link:hover in CSS)
    const fullScreenLink = document.createElement('a');
    fullScreenLink.href = '#';
    fullScreenLink.textContent = 'Open full screen ↗';
    fullScreenLink.className = 'hm-fullscreen-link';
    fullScreenLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (onFullScreen) {
            onFullScreen();
        }
    });

    header.appendChild(toggleLabel);
    header.appendChild(fullScreenLink);
    container.appendChild(header);

    // Grid wrapper (for horizontal scroll)
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'hm-grid-wrapper';

    // Table
    const table = document.createElement('table');
    table.className = 'hm-table';

    // Function to render grid
    const renderGrid = () => {
        table.innerHTML = '';

        // Thead
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.className = 'hm-header-row';

        // Name column header (static layout via class; sort-active color/border inline)
        const nameHeader = document.createElement('th');
        nameHeader.className = 'hm-sort-header hm-sort-header--name';
        nameHeader.style.color = sortState.column === 'name' ? '#333' : '#666';
        nameHeader.style.borderBottom = sortState.column === 'name' ? '2px solid #0374B5' : '2px solid #e0e0e0';
        nameHeader.textContent = 'Name ';
        if (sortState.column === 'name') {
            const indicator = document.createElement('span');
            indicator.textContent = sortState.direction === 'asc' ? '▲' : '▼';
            indicator.className = 'hm-sort-indicator';
            nameHeader.appendChild(indicator);
        }
        nameHeader.addEventListener('click', () => {
            if (sortState.column === 'name') {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.column = 'name';
                sortState.direction = 'asc';
            }
            renderGrid();
        });
        headerRow.appendChild(nameHeader);

        // Outcome column headers
        heatmapOutcomes.forEach(outcome => {
            const outcomeHeader = document.createElement('th');
            outcomeHeader.className = 'hm-sort-header hm-sort-header--outcome';
            outcomeHeader.style.width = `${cellWidth}px`;
            outcomeHeader.style.color = sortState.column === String(outcome.id) ? '#333' : '#666';
            outcomeHeader.style.borderBottom = sortState.column === String(outcome.id) ? '2px solid #0374B5' : '2px solid #e0e0e0';

            // Rotated label container
            const labelContainer = document.createElement('div');
            labelContainer.className = 'hm-label-container';
            labelContainer.textContent = outcome.title.length > 30
                ? outcome.title.substring(0, 30) + '...'
                : outcome.title;
            labelContainer.title = outcome.title;

            outcomeHeader.appendChild(labelContainer);

            // Sort indicator
            if (sortState.column === String(outcome.id)) {
                const indicator = document.createElement('span');
                indicator.textContent = sortState.direction === 'asc' ? '▲' : '▼';
                indicator.className = 'hm-sort-indicator-corner';
                outcomeHeader.appendChild(indicator);
            }

            outcomeHeader.addEventListener('click', () => {
                if (sortState.column === String(outcome.id)) {
                    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    sortState.column = String(outcome.id);
                    sortState.direction = 'asc';
                }
                renderGrid();
            });

            headerRow.appendChild(outcomeHeader);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Tbody - student rows
        const tbody = document.createElement('tbody');

        // Sort students
        const sortedStudents = sortStudents(cache.students, sortState);

        sortedStudents.forEach((student, rowIndex) => {
            const row = document.createElement('tr');
            row.className = 'hm-data-row';

            // Name cell with link to individual mastery dashboard
            const nameCell = document.createElement('td');
            nameCell.className = 'hm-name-cell';

            // Use cached masteryDashboardUrl or fallback to default
            const masteryDashboardUrl = cache.meta.masteryDashboardUrl || 'mastery-dashboard';
            if (!cache.meta.masteryDashboardUrl) {
                logger.warn('[Heatmap] masteryDashboardUrl not in cache, using fallback - links may be broken');
            }

            // Create link to mastery dashboard
            const link = document.createElement('a');
            link.href = `/courses/${cache.meta.courseId}/pages/${masteryDashboardUrl}?cg_web=1&student_id=${student.id}`;
            link.textContent = formatStudentName(student);
            link.title = `View ${student.name || student.sortableName}'s individual mastery dashboard`;
            link.className = 'hm-name-link';

            nameCell.appendChild(link);
            row.appendChild(nameCell);

            // Outcome cells
            heatmapOutcomes.forEach(outcome => {
                const outcomeData = student.outcomes.find(o =>
                    String(o.outcomeId) === String(outcome.id)
                ) || { status: 'NE', plPrediction: null };

                const colors = getCellColor(outcomeData.plPrediction, outcomeData.status, colorScheme);
                const content = getCellContent(outcomeData, showDetails);
                const tooltip = buildTooltip(student, outcome, outcomeData);

                const cell = document.createElement('td');
                cell.className = 'hm-cell';
                cell.style.width = `${cellWidth}px`;
                cell.style.height = `${cellHeight}px`;
                cell.style.background = colors.bg;
                cell.style.color = colors.text;
                cell.textContent = content;
                cell.title = tooltip;

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
    };

    // Wire details toggle
    toggleCheckbox.addEventListener('change', (e) => {
        showDetails = e.target.checked;
        logger.debug(`[Heatmap] Details mode: ${showDetails}`);
        renderGrid();
    });

    // Initial render
    renderGrid();

    gridWrapper.appendChild(table);
    container.appendChild(gridWrapper);

    logger.info('[Heatmap] Grid built successfully');
    return container;
}