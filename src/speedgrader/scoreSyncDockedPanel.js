// src/speedgrader/scoreSyncDockedPanel.js
/**
 * ScoreSync Docked Edge Panel
 * 
 * Provides a stable, Canvas-independent UI for ScoreSync that works across
 * all SpeedGrader variants (classic, enhanced, etc.)
 * 
 * Features:
 * - Fixed position panel attached to document.body
 * - Draggable vertically along screen edge
 * - Expandable/collapsible
 * - Side selection (left/right)
 * - Text orientation options (horizontal/vertical/rotated)
 * - Persistent user preferences
 */

import { logger } from '../utils/logger.js';

// Storage keys
const STORAGE_KEYS = {
    SIDE: 'cg_scoresync_side',
    TEXT_ORIENTATION: 'cg_scoresync_text_orientation',
    POSITION: 'cg_scoresync_position'
};

const SESSION_KEYS = {
    HIDDEN: 'cg_scoresync_hidden',
    EXPANDED: 'cg_scoresync_expanded'
};

// Default settings
const DEFAULTS = {
    SIDE: 'right',
    TEXT_ORIENTATION: 'horizontal',
    POSITION: 50, // percentage from top
    HIDDEN: false,
    EXPANDED: false
};

// Color constants
const COLORS = {
    GREEN: '#0B874B',
    GREEN_DARK: '#097A3E',
    WHITE: '#FFFFFF',
    TEXT_DARK: '#2D3B45',
    TEXT_MEDIUM: '#6B7780',
    BORDER_LIGHT: '#E5E5E5',
    BORDER_MEDIUM: '#C7CDD1',
    GRAY_LIGHT: '#F5F5F5'
};

// State
let panelState = {
    side: DEFAULTS.SIDE,
    textOrientation: DEFAULTS.TEXT_ORIENTATION,
    position: DEFAULTS.POSITION,
    hidden: DEFAULTS.HIDDEN,
    expanded: DEFAULTS.EXPANDED,
    isDragging: false,
    dragStartY: 0,
    dragStartTop: 0
};

// DOM references
let rootElement = null;
let tabElement = null;
let panelElement = null;

/**
 * Inject CSS styles into document head
 */
function injectStyles() {
    if (document.getElementById('cg-scoresync-styles')) {
        logger.trace('[DockedPanel] Styles already injected');
        return;
    }
    
    logger.trace('[DockedPanel] Injecting CSS styles');
    const style = document.createElement('style');
    style.id = 'cg-scoresync-styles';
    style.textContent = `
        /* Root container */
        #cg-scoresync-root {
            position: fixed;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            transition: top 0.1s ease-out;
        }
        
        #cg-scoresync-root.side-right {
            right: 0;
        }
        
        #cg-scoresync-root.side-left {
            left: 0;
        }
        
        /* Collapsed tab - GREEN BACKGROUND, WHITE TEXT */
        #cg-scoresync-tab {
            background: ${COLORS.GREEN};
            color: ${COLORS.WHITE};
            padding: 0.75rem 0.5rem;
            cursor: grab;
            user-select: none;
            font-weight: 600;
            font-size: 0.875rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: background 0.2s ease;
        }
        
        #cg-scoresync-tab:hover {
            background: ${COLORS.GREEN_DARK};
        }
        
        #cg-scoresync-tab:active {
            cursor: grabbing;
        }
        
        #cg-scoresync-tab.side-right {
            border-radius: 0.5rem 0 0 0.5rem;
        }
        
        #cg-scoresync-tab.side-left {
            border-radius: 0 0.5rem 0.5rem 0;
        }
        
        /* Horizontal tab layout */
        #cg-scoresync-tab.orientation-horizontal {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            min-width: 150px;
        }
        
        .cg-scoresync-tab-label {
            font-weight: 600;
            font-size: 0.875rem;
            color: ${COLORS.WHITE};
            flex-shrink: 0;
        }
        
        .cg-scoresync-tab-score {
            background: ${COLORS.GREEN_DARK};
            color: ${COLORS.WHITE};
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 700;
            white-space: nowrap;
            line-height: 1;
            flex-shrink: 0;
        }

        /* Vertical tab */
        #cg-scoresync-tab.orientation-vertical {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            padding: 0.75rem 0.5rem;
        }

        #cg-scoresync-tab.orientation-vertical .cg-scoresync-tab-score {
            display: none;
        }

        /* Rotated tab */
        #cg-scoresync-tab.orientation-rotated {
            padding: 0.5rem 0.75rem;
        }

        #cg-scoresync-tab.orientation-rotated .cg-scoresync-tab-score {
            display: none;
        }

        #cg-scoresync-root.side-right #cg-scoresync-tab.orientation-rotated {
            transform: rotate(-90deg) translateX(50%);
        }

        #cg-scoresync-root.side-left #cg-scoresync-tab.orientation-rotated {
            transform: rotate(90deg) translateX(-50%);
        }

        /* Expanded panel - WHITE BACKGROUND, GREEN BORDER */
        #cg-scoresync-panel {
            position: absolute;
            top: 0;
            background: ${COLORS.WHITE};
            border: 2px solid ${COLORS.GREEN};
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 1rem;
            min-width: 350px;
            max-width: 400px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }

        #cg-scoresync-root.side-right #cg-scoresync-panel {
            right: 100%;
            margin-right: 0.5rem;
            transform: translateX(10px);
        }

        #cg-scoresync-root.side-left #cg-scoresync-panel {
            left: 100%;
            margin-left: 0.5rem;
            transform: translateX(-10px);
        }

        #cg-scoresync-panel.expanded {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0);
        }

        /* Panel header */
        .cg-scoresync-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
        }

        .cg-scoresync-panel-title {
            font-size: 1rem;
            font-weight: 600;
            color: ${COLORS.TEXT_DARK};
        }

        .cg-scoresync-close-btn {
            background: none;
            border: none;
            color: ${COLORS.TEXT_MEDIUM};
            cursor: pointer;
            padding: 0.25rem;
            font-size: 1.25rem;
            line-height: 1;
            transition: color 0.2s ease;
        }

        .cg-scoresync-close-btn:hover {
            color: ${COLORS.GREEN};
        }

        /* Panel sections */
        .cg-scoresync-section {
            margin-bottom: 1rem;
        }

        .cg-scoresync-section-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            color: ${COLORS.TEXT_MEDIUM};
            margin-bottom: 0.5rem;
            letter-spacing: 0.5px;
        }

        /* Controls */
        .cg-scoresync-control {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }

        .cg-scoresync-control label {
            font-size: 0.875rem;
            color: ${COLORS.TEXT_DARK};
            cursor: pointer;
        }

        .cg-scoresync-control input[type="checkbox"] {
            cursor: pointer;
        }

        .cg-scoresync-control select {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid ${COLORS.BORDER_MEDIUM};
            border-radius: 0.25rem;
            font-size: 0.875rem;
            background: ${COLORS.WHITE};
            cursor: pointer;
        }

        /* Score display in panel - WHITE BACKGROUND WITH GREEN BORDER */
        .cg-scoresync-score-display {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            padding: 0.75rem;
            background: ${COLORS.WHITE};
            border: 2px solid ${COLORS.GREEN};
            border-radius: 0.25rem;
        }

        .cg-scoresync-score-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: ${COLORS.TEXT_DARK};
        }

        .cg-scoresync-score-value {
            font-size: 1.125rem;
            font-weight: 700;
            color: ${COLORS.GREEN};
        }

        /* Settings section */
        .cg-scoresync-settings {
            padding-top: 0.75rem;
            border-top: 1px solid ${COLORS.BORDER_LIGHT};
        }

        /* Hide button */
        .cg-scoresync-hide-btn {
            width: 100%;
            padding: 0.5rem;
            background: ${COLORS.GRAY_LIGHT};
            border: 1px solid ${COLORS.BORDER_MEDIUM};
            border-radius: 0.25rem;
            color: ${COLORS.TEXT_MEDIUM};
            font-size: 0.875rem;
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease;
        }

        .cg-scoresync-hide-btn:hover {
            background: #E5E5E5;
            color: ${COLORS.TEXT_DARK};
        }
    `;

    document.head.appendChild(style);
    logger.info('[DockedPanel] ✅ CSS styles injected');
}

/**
 * Load settings from storage
 */
function loadSettings() {
    logger.trace('[DockedPanel] Loading settings from storage');

    panelState.side = localStorage.getItem(STORAGE_KEYS.SIDE) || DEFAULTS.SIDE;
    panelState.textOrientation = localStorage.getItem(STORAGE_KEYS.TEXT_ORIENTATION) || DEFAULTS.TEXT_ORIENTATION;
    panelState.position = parseFloat(localStorage.getItem(STORAGE_KEYS.POSITION)) || DEFAULTS.POSITION;
    panelState.hidden = sessionStorage.getItem(SESSION_KEYS.HIDDEN) === 'true';
    panelState.expanded = sessionStorage.getItem(SESSION_KEYS.EXPANDED) === 'true';

    logger.trace('[DockedPanel] Settings loaded:', panelState);
}

/**
 * Save settings to storage
 */
function saveSettings() {
    logger.trace('[DockedPanel] Saving settings to storage');

    localStorage.setItem(STORAGE_KEYS.SIDE, panelState.side);
    localStorage.setItem(STORAGE_KEYS.TEXT_ORIENTATION, panelState.textOrientation);
    localStorage.setItem(STORAGE_KEYS.POSITION, panelState.position.toString());
    sessionStorage.setItem(SESSION_KEYS.HIDDEN, panelState.hidden.toString());
    sessionStorage.setItem(SESSION_KEYS.EXPANDED, panelState.expanded.toString());
}

/**
 * Create the collapsed tab element
 */
function createTab(score = null) {
    logger.trace('[DockedPanel] Creating tab element');

    const tab = document.createElement('div');
    tab.id = 'cg-scoresync-tab';
    tab.className = `orientation-${panelState.textOrientation} side-${panelState.side}`;

    const label = document.createElement('span');
    label.className = 'cg-scoresync-tab-label';
    label.textContent = 'ScoreSync';

    const scoreBox = document.createElement('span');
    scoreBox.className = 'cg-scoresync-tab-score';
    scoreBox.textContent = score !== null ? `${score} pts` : '--';

    tab.appendChild(label);
    tab.appendChild(scoreBox);

    // Click to expand/collapse
    tab.addEventListener('click', (e) => {
        if (!panelState.isDragging) {
            togglePanel();
        }
    });

    return tab;
}

/**
 * Create the expanded panel element
 */
function createPanel() {
    logger.trace('[DockedPanel] Creating panel element');

    const panel = document.createElement('div');
    panel.id = 'cg-scoresync-panel';
    if (panelState.expanded) {
        panel.classList.add('expanded');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'cg-scoresync-panel-header';

    const title = document.createElement('div');
    title.className = 'cg-scoresync-panel-title';
    title.textContent = 'ScoreSync';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cg-scoresync-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => togglePanel());

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Content will be added by other functions
    const content = document.createElement('div');
    content.id = 'cg-scoresync-panel-content';
    panel.appendChild(content);

    return panel;
}

/**
 * Create the root container
 */
function createRoot() {
    logger.trace('[DockedPanel] Creating root container');

    const root = document.createElement('div');
    root.id = 'cg-scoresync-root';
    root.className = `side-${panelState.side}`;
    root.style.top = `${panelState.position}%`;
    root.style.transform = 'translateY(-50%)';

    if (panelState.hidden) {
        root.style.display = 'none';
    }

    return root;
}

/**
 * Toggle panel expanded/collapsed
 */
function togglePanel() {
    panelState.expanded = !panelState.expanded;

    if (panelState.expanded) {
        panelElement.classList.add('expanded');
        logger.trace('[DockedPanel] Panel expanded');
    } else {
        panelElement.classList.remove('expanded');
        logger.trace('[DockedPanel] Panel collapsed');
    }

    saveSettings();
}

/**
 * Setup drag behavior for vertical movement
 */
function setupDragBehavior() {
    logger.trace('[DockedPanel] Setting up drag behavior');

    tabElement.addEventListener('mousedown', (e) => {
        // Only drag if clicking directly on tab (not score box)
        if (e.target === tabElement || e.target.classList.contains('cg-scoresync-tab-label')) {
            panelState.isDragging = true;
            panelState.dragStartY = e.clientY;
            panelState.dragStartTop = panelState.position;
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!panelState.isDragging) return;

        const deltaY = e.clientY - panelState.dragStartY;
        const deltaPercent = (deltaY / window.innerHeight) * 100;
        const newTop = panelState.dragStartTop + deltaPercent;

        // Constrain to 10% - 90%
        panelState.position = Math.max(10, Math.min(90, newTop));
        rootElement.style.top = `${panelState.position}%`;
    });

    document.addEventListener('mouseup', () => {
        if (panelState.isDragging) {
            panelState.isDragging = false;
            saveSettings();
            logger.trace('[DockedPanel] Drag ended, position saved:', panelState.position);
        }
    });
}

/**
 * Update tab score display
 */
function updateTabScore(score) {
    const scoreElement = tabElement?.querySelector('.cg-scoresync-tab-score');
    if (!scoreElement) return;

    scoreElement.textContent = score !== null ? `${score} pts` : '--';
    logger.trace('[DockedPanel] Tab score updated:', score);
}

/**
 * Update text orientation
 */
function setTextOrientation(orientation) {
    if (!['horizontal', 'vertical', 'rotated'].includes(orientation)) {
        logger.warn('[DockedPanel] Invalid orientation:', orientation);
        return;
    }

    panelState.textOrientation = orientation;
    tabElement.className = `orientation-${orientation} side-${panelState.side}`;
    saveSettings();
    logger.info('[DockedPanel] Text orientation changed to:', orientation);
}

/**
 * Update side (left/right)
 */
function setSide(side) {
    if (!['left', 'right'].includes(side)) {
        logger.warn('[DockedPanel] Invalid side:', side);
        return;
    }

    panelState.side = side;
    rootElement.className = `side-${side}`;
    tabElement.className = `orientation-${panelState.textOrientation} side-${side}`;
    saveSettings();
    logger.info('[DockedPanel] Side changed to:', side);
}

/**
 * Hide panel for this session
 */
function hideForSession() {
    panelState.hidden = true;
    rootElement.style.display = 'none';
    saveSettings();
    logger.info('[DockedPanel] Hidden for session');
}

/**
 * Show panel
 */
function showPanel() {
    panelState.hidden = false;
    rootElement.style.display = 'block';
    saveSettings();
    logger.info('[DockedPanel] Panel shown');
}

/**
 * Get panel content container for adding controls
 */
function getPanelContent() {
    return document.getElementById('cg-scoresync-panel-content');
}

/**
 * Add ScoreSync controls section to panel
 */
function addSyncControlsSection(settings, onEnabledChange, onMethodChange) {
    const content = getPanelContent();
    if (!content) return;

    const section = document.createElement('div');
    section.className = 'cg-scoresync-section';

    const title = document.createElement('div');
    title.className = 'cg-scoresync-section-title';
    title.textContent = 'Sync Controls';
    section.appendChild(title);

    // Enable checkbox
    const enableControl = document.createElement('div');
    enableControl.className = 'cg-scoresync-control';

    const enableCheckbox = document.createElement('input');
    enableCheckbox.type = 'checkbox';
    enableCheckbox.id = 'cg-scoresync-enable';
    enableCheckbox.checked = settings.enabled;
    enableCheckbox.addEventListener('change', (e) => {
        if (onEnabledChange) onEnabledChange(e.target.checked);
    });

    const enableLabel = document.createElement('label');
    enableLabel.htmlFor = 'cg-scoresync-enable';
    enableLabel.textContent = 'Enable Score Sync';

    enableControl.appendChild(enableCheckbox);
    enableControl.appendChild(enableLabel);
    section.appendChild(enableControl);

    // Method selector
    const methodControl = document.createElement('div');
    methodControl.className = 'cg-scoresync-control';

    const methodLabel = document.createElement('label');
    methodLabel.htmlFor = 'cg-scoresync-method';
    methodLabel.textContent = 'Method:';

    const methodSelect = document.createElement('select');
    methodSelect.id = 'cg-scoresync-method';
    methodSelect.innerHTML = `
        <option value="min">MIN (Lowest)</option>
        <option value="avg">AVG (Average)</option>
        <option value="max">MAX (Highest)</option>
        <option value="sum">SUM (Total)</option>
    `;
    methodSelect.value = settings.method;
    methodSelect.addEventListener('change', (e) => {
        if (onMethodChange) onMethodChange(e.target.value);
    });

    methodControl.appendChild(methodLabel);
    methodControl.appendChild(methodSelect);
    section.appendChild(methodControl);

    content.appendChild(section);
}

/**
 * Add score display section to panel
 */
function addScoreDisplaySection(score = null) {
    const content = getPanelContent();
    if (!content) return;

    const section = document.createElement('div');
    section.className = 'cg-scoresync-section';

    const title = document.createElement('div');
    title.className = 'cg-scoresync-section-title';
    title.textContent = 'Current Score';
    section.appendChild(title);

    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'cg-scoresync-score-display';
    scoreDisplay.id = 'cg-scoresync-panel-score';

    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'cg-scoresync-score-label';
    scoreLabel.textContent = 'Assignment Score:';

    const scoreValue = document.createElement('span');
    scoreValue.className = 'cg-scoresync-score-value';
    scoreValue.textContent = score !== null ? `${score} pts` : '--';

    scoreDisplay.appendChild(scoreLabel);
    scoreDisplay.appendChild(scoreValue);
    section.appendChild(scoreDisplay);

    content.appendChild(section);
}

/**
 * Add panel settings section
 */
function addPanelSettingsSection() {
    const content = getPanelContent();
    if (!content) return;

    const section = document.createElement('div');
    section.className = 'cg-scoresync-section cg-scoresync-settings';

    const title = document.createElement('div');
    title.className = 'cg-scoresync-section-title';
    title.textContent = 'Panel Settings';
    section.appendChild(title);

    // Side selector
    const sideControl = document.createElement('div');
    sideControl.className = 'cg-scoresync-control';

    const sideLabel = document.createElement('label');
    sideLabel.htmlFor = 'cg-scoresync-side';
    sideLabel.textContent = 'Side:';

    const sideSelect = document.createElement('select');
    sideSelect.id = 'cg-scoresync-side';
    sideSelect.innerHTML = `
        <option value="right">Right</option>
        <option value="left">Left</option>
    `;
    sideSelect.value = panelState.side;
    sideSelect.addEventListener('change', (e) => setSide(e.target.value));

    sideControl.appendChild(sideLabel);
    sideControl.appendChild(sideSelect);
    section.appendChild(sideControl);

    // Text orientation selector
    const orientationControl = document.createElement('div');
    orientationControl.className = 'cg-scoresync-control';

    const orientationLabel = document.createElement('label');
    orientationLabel.htmlFor = 'cg-scoresync-orientation';
    orientationLabel.textContent = 'Text:';

    const orientationSelect = document.createElement('select');
    orientationSelect.id = 'cg-scoresync-orientation';
    orientationSelect.innerHTML = `
        <option value="horizontal">Horizontal</option>
        <option value="vertical">Vertical</option>
        <option value="rotated">Rotated</option>
    `;
    orientationSelect.value = panelState.textOrientation;
    orientationSelect.addEventListener('change', (e) => setTextOrientation(e.target.value));

    orientationControl.appendChild(orientationLabel);
    orientationControl.appendChild(orientationSelect);
    section.appendChild(orientationControl);

    // Hide for session button
    const hideBtn = document.createElement('button');
    hideBtn.className = 'cg-scoresync-hide-btn';
    hideBtn.textContent = 'Hide for This Session';
    hideBtn.addEventListener('click', hideForSession);
    section.appendChild(hideBtn);

    content.appendChild(section);
}

/**
 * Update panel score display
 */
function updatePanelScore(score) {
    const scoreElement = document.querySelector('#cg-scoresync-panel-score .cg-scoresync-score-value');
    if (scoreElement) {
        scoreElement.textContent = score !== null ? `${score} pts` : '--';
    }

    // Also update tab score
    updateTabScore(score);
}

/**
 * Initialize the docked panel
 */
function initDockedPanel(initialScore = null) {
    logger.info('[DockedPanel] ========== INITIALIZATION STARTED ==========');

    // Check if already initialized
    if (document.getElementById('cg-scoresync-root')) {
        logger.warn('[DockedPanel] Already initialized, skipping');
        return false;
    }

    try {
        // Inject CSS
        injectStyles();

        // Load settings
        loadSettings();

        // Create DOM elements
        rootElement = createRoot();
        tabElement = createTab(initialScore);
        panelElement = createPanel();

        // Assemble structure
        rootElement.appendChild(tabElement);
        rootElement.appendChild(panelElement);

        // Add to document
        document.body.appendChild(rootElement);

        // Setup behaviors
        setupDragBehavior();

        logger.info('[DockedPanel] ✅ Initialization complete');
        logger.trace('[DockedPanel] State:', panelState);

        return true;
    } catch (error) {
        logger.error('[DockedPanel] Initialization failed:', error);
        return false;
    }
}

/**
 * Destroy the docked panel
 */
function destroyDockedPanel() {
    logger.info('[DockedPanel] Destroying docked panel');

    const root = document.getElementById('cg-scoresync-root');
    if (root) {
        root.remove();
    }

    const styles = document.getElementById('cg-scoresync-styles');
    if (styles) {
        styles.remove();
    }

    rootElement = null;
    tabElement = null;
    panelElement = null;

    logger.info('[DockedPanel] ✅ Destroyed');
}

// Export public API
export {
    initDockedPanel,
    destroyDockedPanel,
    updateTabScore,
    updatePanelScore,
    setTextOrientation,
    setSide,
    hideForSession,
    showPanel,
    getPanelContent,
    togglePanel,
    addSyncControlsSection,
    addScoreDisplaySection,
    addPanelSettingsSection
};