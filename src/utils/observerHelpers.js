// src/utils/observerHelpers.js
/**
 * MutationObserver Helper Utilities
 *
 * Shared utilities for setting up and managing MutationObservers across the application.
 * Provides consistent patterns for observer creation, configuration, and cleanup.
 *
 * Common Use Cases:
 * - Watching for DOM changes to apply customizations
 * - Detecting when specific elements are added to the page
 * - Auto-disconnecting observers after a timeout or condition is met
 */

import { logger } from './logger.js';

/**
 * Standard MutationObserver configuration presets
 */
export const OBSERVER_CONFIGS = {
    /**
     * Watch for child elements being added/removed in entire subtree
     * Use for: Detecting new content, lazy-loaded elements
     */
    CHILD_LIST: {
        childList: true,
        subtree: true
    },

    /**
     * Watch for child elements and attribute changes in entire subtree
     * Use for: Comprehensive DOM monitoring
     */
    CHILD_LIST_AND_ATTRIBUTES: {
        childList: true,
        subtree: true,
        attributes: true
    },

    /**
     * Watch for specific attributes only
     * Use for: Monitoring state changes on specific elements
     * @param {string[]} attributeFilter - Array of attribute names to watch
     */
    ATTRIBUTES_ONLY: (attributeFilter = []) => ({
        attributes: true,
        attributeFilter
    }),

    /**
     * Full monitoring - child list, attributes, and character data
     * Use for: Comprehensive change detection (use sparingly - performance impact)
     */
    FULL: {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    }
};

/**
 * Create a MutationObserver that automatically disconnects after a timeout
 *
 * Useful for observers that should only run temporarily (e.g., waiting for lazy-loaded content)
 *
 * @param {Function} callback - Observer callback function (receives mutations array)
 * @param {Object} options - Configuration options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds (default: 30 seconds)
 * @param {Object} [options.config=OBSERVER_CONFIGS.CHILD_LIST] - MutationObserver config
 * @param {HTMLElement} [options.target=document.body] - Element to observe
 * @param {string} [options.name='Observer'] - Name for logging purposes
 * @returns {MutationObserver} The created observer (already observing)
 */
export function createAutoDisconnectObserver(callback, options = {}) {
    const {
        timeout = 30000,
        config = OBSERVER_CONFIGS.CHILD_LIST,
        target = document.body,
        name = 'Observer'
    } = options;

    const observer = new MutationObserver(callback);
    observer.observe(target, config);

    logger.trace(`${name} started, will auto-disconnect after ${timeout}ms`);

    // Auto-disconnect after timeout
    setTimeout(() => {
        observer.disconnect();
        logger.trace(`${name} auto-disconnected (timeout)`);
    }, timeout);

    return observer;
}

/**
 * Create a MutationObserver that disconnects after a condition is met
 *
 * The callback should return true when the observer should disconnect.
 *
 * @param {Function} callback - Observer callback (receives mutations, should return true to disconnect)
 * @param {Object} options - Configuration options
 * @param {number} [options.timeout=30000] - Maximum timeout in milliseconds
 * @param {Object} [options.config=OBSERVER_CONFIGS.CHILD_LIST] - MutationObserver config
 * @param {HTMLElement} [options.target=document.body] - Element to observe
 * @param {string} [options.name='Observer'] - Name for logging purposes
 * @returns {MutationObserver} The created observer (already observing)
 */
export function createConditionalObserver(callback, options = {}) {
    const {
        timeout = 30000,
        config = OBSERVER_CONFIGS.CHILD_LIST,
        target = document.body,
        name = 'Observer'
    } = options;

    let disconnected = false;

    const observer = new MutationObserver((mutations) => {
        if (disconnected) return;

        const shouldDisconnect = callback(mutations);
        if (shouldDisconnect) {
            observer.disconnect();
            disconnected = true;
            logger.trace(`${name} disconnected (condition met)`);
        }
    });

    observer.observe(target, config);
    logger.trace(`${name} started, will auto-disconnect after ${timeout}ms or when condition met`);

    // Safety timeout
    setTimeout(() => {
        if (!disconnected) {
            observer.disconnect();
            disconnected = true;
            logger.trace(`${name} auto-disconnected (timeout)`);
        }
    }, timeout);

    return observer;
}

/**
 * Create a debounced MutationObserver
 *
 * Useful for expensive operations that shouldn't run on every DOM change.
 * The callback will be called at most once per debounce period.
 *
 * @param {Function} callback - Observer callback function
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @param {Object} options - Configuration options (same as createAutoDisconnectObserver)
 * @returns {MutationObserver} The created observer (already observing)
 */
export function createDebouncedObserver(callback, debounceMs, options = {}) {
    const {
        timeout = 30000,
        config = OBSERVER_CONFIGS.CHILD_LIST,
        target = document.body,
        name = 'Observer'
    } = options;

    let debounceTimer = null;

    const debouncedCallback = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            callback();
        }, debounceMs);
    };

    const observer = new MutationObserver(debouncedCallback);
    observer.observe(target, config);

    logger.trace(`${name} started (debounced ${debounceMs}ms), will auto-disconnect after ${timeout}ms`);

    // Auto-disconnect after timeout
    setTimeout(() => {
        clearTimeout(debounceTimer);
        observer.disconnect();
        logger.trace(`${name} auto-disconnected (timeout)`);
    }, timeout);

    return observer;
}

/**
 * Wait for an element to appear in the DOM
 *
 * Returns a promise that resolves when the element is found or rejects on timeout.
 *
 * @param {string} selector - CSS selector for the element to wait for
 * @param {Object} options - Configuration options
 * @param {number} [options.timeout=5000] - Maximum wait time in milliseconds
 * @param {HTMLElement} [options.target=document.body] - Element to observe
 * @param {string} [options.name='WaitForElement'] - Name for logging purposes
 * @returns {Promise<HTMLElement>} Promise that resolves with the found element
 */
export function waitForElement(selector, options = {}) {
    const {
        timeout = 5000,
        target = document.body,
        name = 'WaitForElement'
    } = options;

    return new Promise((resolve, reject) => {
        // Check if element already exists
        const existing = target.querySelector(selector);
        if (existing) {
            logger.trace(`${name}: Element ${selector} already exists`);
            resolve(existing);
            return;
        }

        logger.trace(`${name}: Waiting for element ${selector} (timeout: ${timeout}ms)`);

        const observer = createConditionalObserver((mutations) => {
            const element = target.querySelector(selector);
            if (element) {
                logger.trace(`${name}: Element ${selector} found`);
                resolve(element);
                return true; // Disconnect observer
            }
            return false; // Keep observing
        }, {
            timeout,
            config: OBSERVER_CONFIGS.CHILD_LIST,
            target,
            name: `${name}(${selector})`
        });

        // Timeout handler
        setTimeout(() => {
            observer.disconnect();
            logger.trace(`${name}: Timeout waiting for element ${selector}`);
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
}

/**
 * Create a persistent observer that runs indefinitely
 *
 * Use with caution - make sure to store the returned observer and disconnect it when no longer needed.
 *
 * @param {Function} callback - Observer callback function
 * @param {Object} options - Configuration options
 * @param {Object} [options.config=OBSERVER_CONFIGS.CHILD_LIST] - MutationObserver config
 * @param {HTMLElement} [options.target=document.body] - Element to observe
 * @param {string} [options.name='Observer'] - Name for logging purposes
 * @returns {MutationObserver} The created observer (already observing)
 */
export function createPersistentObserver(callback, options = {}) {
    const {
        config = OBSERVER_CONFIGS.CHILD_LIST,
        target = document.body,
        name = 'Observer'
    } = options;

    const observer = new MutationObserver(callback);
    observer.observe(target, config);

    logger.trace(`${name} started (persistent - remember to disconnect manually)`);

    return observer;
}
