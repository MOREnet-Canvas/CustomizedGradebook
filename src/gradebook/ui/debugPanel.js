// src/gradebook/ui/debugPanel.js
/**
 * Debug Panel UI
 * 
 * Displays a debug panel showing state machine status in real-time
 * Only visible when debug mode is enabled
 */

import { logger } from "../../utils/logger.js";

/**
 * Create or update debug UI panel showing current state
 * @param {UpdateFlowStateMachine} stateMachine - State machine instance
 */
export function updateDebugUI(stateMachine) {
    // Only show debug UI if debug mode is enabled
    if (!logger.isDebugEnabled()) return;

    let debugPanel = document.getElementById('state-machine-debug-panel');

    // Create panel if it doesn't exist
    if (!debugPanel) {
        debugPanel = document.createElement('div');
        debugPanel.id = 'state-machine-debug-panel';
        debugPanel.style.cssText = `
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
        `;
        document.body.appendChild(debugPanel);
    }

    // Update panel content
    const context = stateMachine.getContext();
    const history = stateMachine.getStateHistory();
    const currentState = stateMachine.getCurrentState();

    debugPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #ffff00;">
            🔧 STATE MACHINE DEBUG
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Current State:</strong> <span style="color: #00ffff;">${currentState}</span>
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Transitions:</strong> ${history.length - 1}
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Update Mode:</strong> ${context.updateMode || 'N/A'}
        </div>
        <div style="margin-bottom: 4px;">
            <strong>Updates:</strong> ${context.numberOfUpdates || 0}
        </div>
        <div style="margin-bottom: 8px; font-size: 10px; color: #888;">
            Last 3: ${history.slice(-3).join(' → ')}
        </div>
        <div style="font-size: 10px; color: #666; cursor: pointer;" onclick="this.parentElement.remove()">
            [Click to close]
        </div>
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

