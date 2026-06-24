// src/gradebook/ui/debugPanel.js
/**
 * Debug Panel UI
 * 
 * Displays a debug panel showing state machine status in real-time
 * Only visible when debug mode is enabled
 */

import { logger } from "../../utils/logger.js";
import { injectStyles } from "../../ui/styles.js";

const DEBUG_PANEL_CSS = `
#state-machine-debug-panel {
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    padding: 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    z-index: 10000;
    min-width: 250px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid #00ff00;
}
.cg-debug-title   { font-weight: bold; margin-bottom: 8px; color: #ffff00; }
.cg-debug-row     { margin-bottom: 4px; }
.cg-debug-value   { color: #00ffff; }
.cg-debug-history { margin-bottom: 8px; font-size: 10px; color: #888; }
.cg-debug-close   { font-size: 10px; color: #666; cursor: pointer; }
`;

/**
 * Create or update debug UI panel showing current state
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance
 */
export function updateDebugUI(stateMachine) {
    // Only show debug UI if debug mode is enabled
    if (!logger.isDebugEnabled()) return;

    let debugPanel = document.getElementById('state-machine-debug-panel');

    // Inject styles once (idempotent)
    injectStyles(DEBUG_PANEL_CSS, 'cg-debug-panel-styles');

    // Create panel if it doesn't exist
    if (!debugPanel) {
        debugPanel = document.createElement('div');
        debugPanel.id = 'state-machine-debug-panel';
        document.body.appendChild(debugPanel);
    }

    // Update panel content
    const context = stateMachine.getContext();
    const history = stateMachine.getStateHistory();
    const currentState = stateMachine.getCurrentState();

    debugPanel.innerHTML = `
        <div class="cg-debug-title">🔧 STATE MACHINE DEBUG</div>
        <div class="cg-debug-row"><strong>Current State:</strong> <span class="cg-debug-value">${currentState}</span></div>
        <div class="cg-debug-row"><strong>Transitions:</strong> ${history.length - 1}</div>
        <div class="cg-debug-row"><strong>Update Mode:</strong> ${context.updateMode || 'N/A'}</div>
        <div class="cg-debug-row"><strong>Updates:</strong> ${context.numberOfUpdates || 0}</div>
        <div class="cg-debug-history">Last 3: ${history.slice(-3).join(' → ')}</div>
        <div class="cg-debug-close" onclick="this.parentElement.remove()">[Click to close]</div>
    `;
}

/**
 * Remove debug UI panel
 */
export function removeDebugUI() {
    const debugPanel = document.getElementById('state-machine-debug-panel');
    if (debugPanel) {
        debugPanel.remove();
    }
}

