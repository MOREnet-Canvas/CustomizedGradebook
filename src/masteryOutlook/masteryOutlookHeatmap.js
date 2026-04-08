// src/masteryOutlook/masteryOutlookHeatmap.js
/**
 * Mastery Outlook Heatmap Grid Builder
 *
 * Builds heatmap grid DOM for both in-dashboard and full-screen views.
 * Displays students (rows) × outcomes (columns) with PL prediction colors.
 */

import { logger } from '../utils/logger.js';
import { AVG_OUTCOME_NAME, EXCLUDED_OUTCOME_KEYWORDS } from '../config.js';

const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";

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
 * Get color for PL prediction value
 * Supports two color schemes: 'soft' (default pastel) or 'canvas' (Canvas mastery colors)
 */
function getCellColor(plPrediction, status, colorScheme = 'soft') {
    if (status === 'NE' || plPrediction === null) {
        return { bg: '#f0f0f0', text: '#999' };
    }

    if (colorScheme === 'canvas') {
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
    container.style.cssText = `${FONT}`;

    // Header (details toggle + full screen link)
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';

    // Details toggle
    const toggleLabel = document.createElement('label');
    toggleLabel.style.cssText = 'font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px;';
    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.id = 'heatmap-details-toggle';
    toggleCheckbox.style.cursor = 'pointer';
    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(document.createTextNode('Show details'));

    // Full screen link
    const fullScreenLink = document.createElement('a');
    fullScreenLink.href = '#';
    fullScreenLink.textContent = 'Open full screen ↗';
    fullScreenLink.style.cssText = 'font-size:12px; color:#0374B5; text-decoration:none;';
    fullScreenLink.addEventListener('mouseenter', () => {
        fullScreenLink.style.textDecoration = 'underline';
    });
    fullScreenLink.addEventListener('mouseleave', () => {
        fullScreenLink.style.textDecoration = 'none';
    });
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
    gridWrapper.style.cssText = 'overflow-x:auto; border:1px solid #e0e0e0; border-radius:8px;';

    // Table
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse; background:#fff;';

    // Function to render grid
    const renderGrid = () => {
        table.innerHTML = '';

        // Thead
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.borderBottom = '2px solid #e0e0e0';

        // Name column header
        const nameHeader = document.createElement('th');
        nameHeader.style.cssText = `
            width:80px; padding:8px; text-align:left; cursor:pointer;
            background:#f9f9f9; font-size:12px; font-weight:600;
            color:${sortState.column === 'name' ? '#333' : '#666'};
            border-bottom:${sortState.column === 'name' ? '2px solid #0374B5' : '2px solid #e0e0e0'};
            position:sticky; left:0; z-index:2;
        `;
        nameHeader.textContent = 'Name ';
        if (sortState.column === 'name') {
            const indicator = document.createElement('span');
            indicator.textContent = sortState.direction === 'asc' ? '▲' : '▼';
            indicator.style.fontSize = '10px';
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
            outcomeHeader.style.cssText = `
                width:${cellWidth}px; padding:4px; cursor:pointer;
                background:#f9f9f9; font-size:11px; font-weight:500;
                color:${sortState.column === String(outcome.id) ? '#333' : '#666'};
                border-bottom:${sortState.column === String(outcome.id) ? '2px solid #0374B5' : '2px solid #e0e0e0'};
                position:relative; height:100px; vertical-align:bottom;
            `;

            // Rotated label container
            const labelContainer = document.createElement('div');
            labelContainer.style.cssText = `
                position:absolute; bottom:8px; left:50%;
                transform:translateX(-50%) rotate(-45deg); transform-origin:left bottom;
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                max-width:120px; font-size:11px;
            `;
            labelContainer.textContent = outcome.title.length > 30
                ? outcome.title.substring(0, 30) + '...'
                : outcome.title;
            labelContainer.title = outcome.title;

            outcomeHeader.appendChild(labelContainer);

            // Sort indicator
            if (sortState.column === String(outcome.id)) {
                const indicator = document.createElement('span');
                indicator.textContent = sortState.direction === 'asc' ? '▲' : '▼';
                indicator.style.cssText = 'position:absolute; top:4px; right:4px; font-size:10px;';
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
            row.style.borderBottom = '1px solid #f0f0f0';

            // Name cell with link to individual mastery dashboard
            const nameCell = document.createElement('td');
            nameCell.style.cssText = `
                width:80px; padding:6px 8px; font-size:12px; font-weight:500;
                background:#fff; border-right:1px solid #e0e0e0;
                position:sticky; left:0; z-index:1;
            `;

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
            link.style.cssText = 'color:#333; text-decoration:none; font-weight:500;';
            link.addEventListener('mouseenter', () => {
                link.style.textDecoration = 'underline';
                link.style.color = '#0374B5';
            });
            link.addEventListener('mouseleave', () => {
                link.style.textDecoration = 'none';
                link.style.color = '#333';
            });

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
                cell.style.cssText = `
                    width:${cellWidth}px; height:${cellHeight}px;
                    text-align:center; vertical-align:middle;
                    font-size:11px; font-weight:500;
                    background:${colors.bg}; color:${colors.text};
                    border:1px solid #fff; cursor:default;
                `;
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