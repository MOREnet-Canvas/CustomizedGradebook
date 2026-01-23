// src/gradebook/ui/assignmentKebabMenu.js
/**
 * Assignment Kebab Menu Injection
 *
 * Injects "Refresh Mastery" menu item into assignment column kebab menus (⋮)
 * in the Canvas Gradebook.
 */

import { logger } from '../../utils/logger.js';
import { getCourseId } from '../../utils/canvas.js';
import { CanvasApiClient } from '../../utils/canvasApiClient.js';
import { refreshMasteryForAssignment } from '../../services/masteryRefreshService.js';
import { MASTERY_REFRESH_ENABLED } from '../../config.js';

/**
 * Constants
 */
const MENU_ITEM_ID = 'cg-refresh-mastery-menuitem';
const STYLE_ID = 'cg-refresh-mastery-style';

/**
 * Track the last clicked kebab button to extract assignment ID
 */
let lastKebabButton = null;

/**
 * Check if an element is visible
 *
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if element is visible
 */
function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

/**
 * Check if a menu is an assignment actions menu
 *
 * Validates by checking for "SpeedGrader" menu item which is unique to assignment menus
 *
 * @param {HTMLElement} menuElement - The menu element to check
 * @returns {boolean} True if this is an assignment actions menu
 */
function isAssignmentActionsMenu(menuElement) {
    const menuItems = [...menuElement.querySelectorAll('[role="menuitem"]')];
    const texts = menuItems.map(item => (item.innerText || item.textContent || '').trim());
    return texts.includes('SpeedGrader');
}

/**
 * Extract assignment ID from the kebab button's parent column header
 *
 * @param {HTMLElement} kebabButton - The kebab button element
 * @returns {number|null} Assignment ID or null if not found
 */
function extractAssignmentIdFromHeader(kebabButton) {
    if (!kebabButton) {
        logger.warn('[RefreshMastery] No kebab button reference available');
        return null;
    }

    // Find the parent column header
    const headerColumn = kebabButton.closest('.slick-header-column.assignment');
    if (!headerColumn) {
        logger.warn('[RefreshMastery] Could not find parent .slick-header-column.assignment');
        return null;
    }

    // Strategy 1: Extract from class name (e.g., "assignment_12345")
    const classMatch = headerColumn.className.match(/\bassignment_(\d+)\b/);
    if (classMatch) {
        return Number(classMatch[1]);
    }

    // Strategy 2: Extract from assignment link href
    const assignmentLink = headerColumn.querySelector('a[href*="/assignments/"]');
    if (assignmentLink) {
        const hrefMatch = assignmentLink.getAttribute('href')?.match(/\/assignments\/(\d+)/);
        if (hrefMatch) {
            return Number(hrefMatch[1]);
        }
    }

    logger.warn('[RefreshMastery] Could not extract assignment ID from header column');
    return null;
}

/**
 * Reset menu focus to prevent stale active highlights
 *
 * @param {HTMLElement} menuElement - The menu element
 */
function resetMenuFocus(menuElement) {
    try {
        menuElement.setAttribute('tabindex', '-1');
        menuElement.focus({ preventScroll: true });
    } catch (error) {
        // Ignore focus errors
    }

    const firstMenuItem = menuElement.querySelector('[role="menuitem"]');
    if (firstMenuItem) {
        try {
            firstMenuItem.focus({ preventScroll: true });
        } catch (error) {
            // Ignore focus errors
        }
    }
}

/**
 * Create "Refresh Mastery" menu item by cloning an existing menu item
 *
 * This approach inherits Canvas's styles automatically
 *
 * @param {HTMLElement} menuElement - The menu element to clone from
 * @returns {HTMLElement|null} Menu item element or null if template not found
 */
function createMenuItemLike(menuElement) {
    // Find a template menu item to clone (try multiple selectors)
    const template =
        menuElement.querySelector('a[role="menuitem"].css-1kq4kmj-menuItem') ||
        menuElement.querySelector('button[role="menuitem"].css-1kq4kmj-menuItem') ||
        menuElement.querySelector('span[role="menuitem"].css-1kq4kmj-menuItem');

    if (!template) {
        logger.warn('[RefreshMastery] Could not find menu item template to clone');
        return null;
    }

    // Clone the template
    const menuItem = template.cloneNode(true);
    menuItem.id = MENU_ITEM_ID;

    // Remove href if it's a link, or set to #
    menuItem.removeAttribute('href');
    if (menuItem.tagName.toLowerCase() === 'a') {
        menuItem.setAttribute('href', '#');
    }
    if (menuItem.tagName.toLowerCase() === 'button') {
        menuItem.type = 'button';
    }

    // Find and replace the text content
    const walker = document.createTreeWalker(menuItem, NodeFilter.SHOW_TEXT);
    let textNode = null;
    while (walker.nextNode()) {
        const text = walker.currentNode.nodeValue;
        if (text && text.trim().length > 0) {
            textNode = walker.currentNode;
            break;
        }
    }

    if (textNode) {
        textNode.nodeValue = 'Refresh Mastery';
    }

    return menuItem;
}

/**
 * Show a toast notification
 *
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds (default: 2500)
 */
function showToast(message, duration = 2500) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 999999;
        padding: 10px 12px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        background: rgba(0,0,0,0.85);
        color: white;
        font-size: 14px;
        max-width: 320px;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

/**
 * Update gradebook settings to configure the assignment for grading scheme display
 *
 * This is a "belt and suspenders" approach: we update the settings via API to ensure
 * they're correct, even though this alone won't trigger a UI refresh (which is why
 * we still prompt for manual page refresh).
 *
 * @param {string} courseId - Course ID
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<void>}
 */
async function updateGradebookSettings(courseId, assignmentId) {
    try {
        logger.debug(`[RefreshMastery] Updating gradebook settings for assignment ${assignmentId}`);

        const apiClient = new CanvasApiClient();

        // Prepare the settings payload in the format Canvas expects
        // The payload should be nested under 'gradebook_settings' key
        const payload = {
            gradebook_settings: {
                enter_grades_as: {
                    [assignmentId]: 'gradingScheme'
                }
            }
        };

        logger.debug('[RefreshMastery] Sending gradebook settings update:', payload);

        // Send PUT request to update gradebook settings
        // Note: CanvasApiClient.put signature is: put(url, data, options, context)
        await apiClient.put(
            `/api/v1/courses/${courseId}/gradebook_settings`,
            payload,
            {},  // options
            'updateGradebookSettings'  // context
        );

        logger.info(`[RefreshMastery] Successfully updated gradebook settings for assignment ${assignmentId}`);

    } catch (error) {
        // Log error but don't fail the overall refresh operation
        logger.warn('[RefreshMastery] Failed to update gradebook settings (non-critical):', error);
    }
}

/**
 * Inject "Refresh Mastery" menu item into a kebab menu
 *
 * @param {HTMLElement} menuElement - The menu element
 */
function injectRefreshMasteryMenuItem(menuElement) {
    // Validate this is an assignment actions menu
    if (!menuElement || !isAssignmentActionsMenu(menuElement)) {
        return;
    }

    // Reset focus to prevent stale highlights
    resetMenuFocus(menuElement);

    // Check if already injected
    if (menuElement.querySelector(`#${MENU_ITEM_ID}`)) {
        return;
    }

    // Create menu item by cloning existing item
    const menuItem = createMenuItemLike(menuElement);
    if (!menuItem) {
        return;
    }

    // Set up menu item properties
    menuItem.setAttribute('tabindex', '0');

    // Focus on hover
    menuItem.addEventListener('mouseenter', () => {
        try {
            menuItem.focus({ preventScroll: true });
        } catch (error) {
            menuItem.focus();
        }
    });

    // Click handler
    menuItem.addEventListener('click', async (e) => {
        e.preventDefault();

        const courseId = getCourseId();
        const assignmentId = extractAssignmentIdFromHeader(lastKebabButton);

        if (!courseId || !assignmentId) {
            logger.error('[RefreshMastery] Missing courseId or assignmentId', { courseId, assignmentId });
            showToast('Refresh Mastery failed (missing context)', 3000);
            return;
        }

        // Disable menu item during execution
        menuItem.setAttribute('aria-disabled', 'true');
        menuItem.style.pointerEvents = 'none';
        menuItem.style.opacity = '0.7';
        menuItem.title = 'Refreshing…';

        try {
            logger.info(`[RefreshMastery] Starting refresh for assignment ${assignmentId}`);

            // Step 1: Perform mastery refresh (update points_possible: 0 → temp → 0)
            await refreshMasteryForAssignment(courseId, assignmentId);

            logger.info(`[RefreshMastery] Successfully refreshed assignment ${assignmentId}`);

            // Step 2: Update gradebook settings to configure assignment for grading scheme display
            await updateGradebookSettings(courseId, assignmentId);

            // Step 3: Show success toast with guidance
            showToast('✓ Mastery refreshed - Canvas may still be updating; refresh page in a few seconds', 5000);

        } catch (error) {
            logger.error('[RefreshMastery] Refresh failed:', error);
            showToast('✗ Refresh Mastery failed - Please try again', 3500);
        } finally {
            // Re-enable menu item
            menuItem.removeAttribute('aria-disabled');
            menuItem.style.pointerEvents = '';
            menuItem.style.opacity = '';
            menuItem.title = '';
        }
    });

    // Append to menu
    menuElement.appendChild(menuItem);

    logger.debug('[RefreshMastery] Injected menu item');
}

/**
 * Inject CSS styles for hover contrast
 */
function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
        return; // Already injected
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${MENU_ITEM_ID}:hover,
        #${MENU_ITEM_ID}:focus {
            color: white !important;
        }
        #${MENU_ITEM_ID}:hover *,
        #${MENU_ITEM_ID}:focus * {
            color: white !important;
        }
    `;
    document.head.appendChild(style);

    logger.debug('[RefreshMastery] Injected CSS styles');
}

/**
 * Initialize kebab menu injection
 *
 * Sets up event listeners and MutationObserver to detect when kebab menus are opened
 * and injects the "Refresh Mastery" menu item.
 */
export function initAssignmentKebabMenuInjection() {
    if (!MASTERY_REFRESH_ENABLED) {
        logger.debug('[RefreshMastery] Feature disabled via config');
        return;
    }

    logger.info('[RefreshMastery] Initializing kebab menu injection');

    // Inject CSS styles
    injectStyles();

    // Track the kebab button that opened the menu
    // This allows us to extract the assignment ID from the column header
    document.addEventListener('click', (e) => {
        const kebabButton = e.target.closest('button[aria-haspopup="true"][data-popover-trigger="true"]');
        if (kebabButton) {
            lastKebabButton = kebabButton;
            logger.debug('[RefreshMastery] Tracked kebab button click');
        }
    }, true);

    // Observe portal menus opening
    const observer = new MutationObserver(() => {
        // Find all visible menus
        const allMenus = [...document.querySelectorAll('[role="menu"]')].filter(isVisible);

        // Get the most recently opened menu (last in the list)
        const menu = allMenus[allMenus.length - 1];

        if (menu) {
            injectRefreshMasteryMenuItem(menu);
        }
    });

    // Observe the entire document for menu creation
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    logger.info('[RefreshMastery] Kebab menu injection initialized');
}