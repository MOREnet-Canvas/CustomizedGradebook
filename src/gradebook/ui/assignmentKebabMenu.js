// src/gradebook/ui/assignmentKebabMenu.js
/**
 * Assignment Kebab Menu Injection
 *
 * Injects "Refresh Mastery" menu item into assignment column kebab menus (⋮)
 * in the Canvas Gradebook.
 */

import { logger } from '../../utils/logger.js';
import { getCourseId } from '../../utils/canvas.js';
import { refreshMasteryForAssignment } from '../../services/masteryRefreshService.js';
import { MASTERY_REFRESH_ENABLED } from '../../config.js';

/**
 * Track which assignment IDs have already been injected to avoid duplicates
 */
const injectedAssignments = new Set();

/**
 * Extract assignment ID from kebab menu element
 *
 * Canvas kebab menus typically have data attributes or are within elements
 * that contain the assignment ID. This function attempts multiple strategies.
 *
 * @param {HTMLElement} menuElement - The kebab menu element
 * @returns {string|null} Assignment ID or null if not found
 */
function extractAssignmentId(menuElement) {
    // Strategy 1: Look for data-assignment-id attribute on menu or parent
    let element = menuElement;
    for (let i = 0; i < 5; i++) {
        if (!element) break;

        const assignmentId = element.getAttribute('data-assignment-id') ||
                           element.getAttribute('data-id') ||
                           element.dataset?.assignmentId ||
                           element.dataset?.id;

        if (assignmentId) {
            return assignmentId;
        }

        element = element.parentElement;
    }

    // Strategy 2: Look for assignment ID in menu item hrefs or onclick handlers
    const menuItems = menuElement.querySelectorAll('a, button');
    for (const item of menuItems) {
        const href = item.getAttribute('href') || '';
        const onclick = item.getAttribute('onclick') || '';

        // Match patterns like /assignments/12345 or assignment_id=12345
        const match = (href + onclick).match(/assignments?[\/=](\d+)/);
        if (match) {
            return match[1];
        }
    }

    // Strategy 3: Look in parent column header
    let column = menuElement.closest('[data-assignment-id]');
    if (column) {
        return column.getAttribute('data-assignment-id');
    }

    logger.warn('[RefreshMastery] Could not extract assignment ID from kebab menu');
    return null;
}

/**
 * Create "Refresh Mastery" menu item
 *
 * @param {string} assignmentId - Assignment ID
 * @param {string} courseId - Course ID
 * @returns {HTMLElement} Menu item element
 */
function createRefreshMasteryMenuItem(assignmentId, courseId) {
    const menuItem = document.createElement('li');
    menuItem.className = 'ui-menu-item';
    menuItem.setAttribute('role', 'presentation');

    const link = document.createElement('a');
    link.className = 'ui-corner-all';
    link.setAttribute('role', 'menuitem');
    link.setAttribute('tabindex', '-1');
    link.textContent = 'Refresh Mastery';
    link.style.cursor = 'pointer';

    // Click handler
    link.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Disable the menu item during execution
        link.style.opacity = '0.5';
        link.style.pointerEvents = 'none';
        link.textContent = 'Refreshing...';

        try {
            await refreshMasteryForAssignment(courseId, assignmentId);

            // Show success feedback
            link.textContent = '✓ Mastery refreshed';

            // Optional: Show toast notification
            showToast('Mastery refreshed successfully');

            // Reset after 2 seconds
            setTimeout(() => {
                link.textContent = 'Refresh Mastery';
                link.style.opacity = '1';
                link.style.pointerEvents = 'auto';
            }, 2000);

        } catch (error) {
            logger.error('[RefreshMastery] Failed to refresh mastery:', error);

            // Show error feedback
            link.textContent = '✗ Failed';

            // Show error message to user
            alert('Failed to refresh mastery. Please try again.');

            // Reset after 2 seconds
            setTimeout(() => {
                link.textContent = 'Refresh Mastery';
                link.style.opacity = '1';
                link.style.pointerEvents = 'auto';
            }, 2000);
        }
    });

    menuItem.appendChild(link);
    return menuItem;
}

/**
 * Show a toast notification
 *
 * @param {string} message - Message to display
 */
function showToast(message) {
    // Check if Canvas has a flash message system we can use
    if (typeof window.$.flashMessage === 'function') {
        window.$.flashMessage(message);
        return;
    }

    // Fallback: Create simple toast
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2d3b45;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 14px;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Inject "Refresh Mastery" menu item into a kebab menu
 *
 * @param {HTMLElement} menuElement - The kebab menu element (ul.ui-menu)
 */
function injectRefreshMasteryMenuItem(menuElement) {
    const courseId = getCourseId();
    if (!courseId) {
        logger.warn('[RefreshMastery] Cannot inject menu item - course ID not found');
        return;
    }

    const assignmentId = extractAssignmentId(menuElement);
    if (!assignmentId) {
        return; // Already logged warning in extractAssignmentId
    }

    // Check if already injected
    const lockKey = `${courseId}_${assignmentId}`;
    if (injectedAssignments.has(lockKey)) {
        return;
    }

    // Check if menu item already exists
    const existingItem = Array.from(menuElement.querySelectorAll('a')).find(
        a => a.textContent.includes('Refresh Mastery')
    );
    if (existingItem) {
        injectedAssignments.add(lockKey);
        return;
    }

    // Create and inject menu item
    const menuItem = createRefreshMasteryMenuItem(assignmentId, courseId);
    menuElement.appendChild(menuItem);
    injectedAssignments.add(lockKey);

    logger.debug(`[RefreshMastery] Injected menu item for assignment ${assignmentId}`);
}

/**
 * Initialize kebab menu injection
 *
 * Sets up a MutationObserver to detect when kebab menus are rendered
 * and injects the "Refresh Mastery" menu item.
 */
export function initAssignmentKebabMenuInjection() {
    if (!MASTERY_REFRESH_ENABLED) {
        logger.debug('[RefreshMastery] Feature disabled via config');
        return;
    }

    logger.info('[RefreshMastery] Initializing kebab menu injection');

    // Inject into any existing kebab menus
    const existingMenus = document.querySelectorAll('.gradebook-header-menu ul.ui-menu, .assignment-menu ul.ui-menu');
    existingMenus.forEach(menu => {
        if (menu.offsetParent !== null) { // Check if visible
            injectRefreshMasteryMenuItem(menu);
        }
    });

    // Set up observer for dynamically created menus
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Check if the added node is a kebab menu
                if (node.matches && node.matches('ul.ui-menu')) {
                    injectRefreshMasteryMenuItem(node);
                }

                // Check if the added node contains kebab menus
                if (node.querySelectorAll) {
                    const menus = node.querySelectorAll('ul.ui-menu');
                    menus.forEach(menu => {
                        if (menu.offsetParent !== null) { // Check if visible
                            injectRefreshMasteryMenuItem(menu);
                        }
                    });
                }
            }
        }
    });

    // Observe the entire document for kebab menu creation
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    logger.debug('[RefreshMastery] Kebab menu observer initialized');
}