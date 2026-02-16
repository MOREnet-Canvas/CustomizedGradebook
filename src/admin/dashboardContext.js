// src/admin/dashboardContext.js
/**
 * Dashboard Shared Context
 * 
 * Provides a shared context object for all dashboard panels to:
 * - Read/update configuration
 * - Listen to config changes
 * - Access Canvas API client
 * - Access logger
 * 
 * This decouples panels from each other and centralizes state management.
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';

/**
 * Create dashboard context
 * 
 * @returns {Object} Dashboard context with methods and properties
 */
export function createDashboardContext() {
    // Config change listeners
    const configChangeListeners = [];
    
    // Canvas API client instance
    const api = new CanvasApiClient();
    
    return {
        /**
         * Get current configuration from window.CG_MANAGED.config
         * 
         * @returns {Object} Current configuration object
         */
        getConfig() {
            if (!window.CG_MANAGED) {
                window.CG_MANAGED = { config: {}, release: {} };
            }
            if (!window.CG_MANAGED.config) {
                window.CG_MANAGED.config = {};
            }
            return window.CG_MANAGED.config;
        },
        
        /**
         * Get current release info from window.CG_MANAGED.release
         * 
         * @returns {Object} Current release object
         */
        getRelease() {
            if (!window.CG_MANAGED) {
                window.CG_MANAGED = { config: {}, release: {} };
            }
            if (!window.CG_MANAGED.release) {
                window.CG_MANAGED.release = {};
            }
            return window.CG_MANAGED.release;
        },
        
        /**
         * Update configuration with partial update
         * 
         * @param {Object} partialUpdate - Partial configuration update
         */
        updateConfig(partialUpdate) {
            const config = this.getConfig();
            Object.assign(config, partialUpdate);
            logger.debug('[DashboardContext] Config updated:', partialUpdate);
            
            // Notify all listeners
            this.triggerConfigChangeNotification();
        },
        
        /**
         * Update release info with partial update
         * 
         * @param {Object} partialUpdate - Partial release update
         */
        updateRelease(partialUpdate) {
            const release = this.getRelease();
            Object.assign(release, partialUpdate);
            logger.debug('[DashboardContext] Release updated:', partialUpdate);
            
            // Notify all listeners
            this.triggerConfigChangeNotification();
        },
        
        /**
         * Register a config change listener
         * 
         * @param {Function} listener - Callback function to call when config changes
         * @returns {Function} Unsubscribe function
         */
        onConfigChange(listener) {
            configChangeListeners.push(listener);
            
            // Return unsubscribe function
            return () => {
                const index = configChangeListeners.indexOf(listener);
                if (index > -1) {
                    configChangeListeners.splice(index, 1);
                }
            };
        },
        
        /**
         * Trigger config change notification to all listeners
         */
        triggerConfigChangeNotification() {
            logger.debug('[DashboardContext] Triggering config change notification to', configChangeListeners.length, 'listeners');
            configChangeListeners.forEach(listener => {
                try {
                    listener();
                } catch (err) {
                    logger.error('[DashboardContext] Error in config change listener:', err);
                }
            });
        },
        
        /**
         * Canvas API client instance
         */
        api,
        
        /**
         * Logger instance
         */
        logger
    };
}

