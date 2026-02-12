// src/admin/accountFilterPanel.js
/**
 * Account Filter Panel Module
 *
 * Provides UI for selecting which accounts the script should run on.
 * Features:
 * - Hierarchical tree view with checkboxes
 * - Enable/disable toggle
 * - Caches account data in sessionStorage
 * - Stores selected account IDs in config
 */

import { logger } from '../utils/logger.js';
import { createElement, createPanel } from './domHelpers.js';
import { triggerConfigChangeNotification } from './loaderGeneratorPanel.js';

const CACHE_KEY = 'cg_admin_accounts_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Fetch all accounts with pagination
 * @param {string} url - API URL
 * @returns {Promise<Array>} Array of items
 */
async function fetchAllPages(url) {
    const out = [];
    let next = url;
    while (next) {
        const res = await fetch(next, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${next}`);
        out.push(...(await res.json()));
        const link = res.headers.get("Link");
        next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return out;
}

/**
 * Fetch all accounts recursively
 * @returns {Promise<Array>} Array of all accounts
 */
async function fetchAllAccounts() {
    logger.info('[AccountFilter] Fetching all accounts...');

    // Check cache first
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                logger.info('[AccountFilter] Using cached account data');
                return data;
            }
        } catch (e) {
            logger.warn('[AccountFilter] Failed to parse cached data:', e);
        }
    }

    const BASE = location.origin;

    // 1) Get top accounts
    const topAccounts = await fetchAllPages(`${BASE}/api/v1/accounts?per_page=100`);

    // 2) Recursively get all subaccounts
    const seen = new Map();
    for (const a of topAccounts) seen.set(a.id, a);

    async function crawl(accountId) {
        const subs = await fetchAllPages(
            `${BASE}/api/v1/accounts/${accountId}/sub_accounts?recursive=false&per_page=100`
        );

        for (const sa of subs) {
            if (!seen.has(sa.id)) {
                seen.set(sa.id, sa);
                await crawl(sa.id);
            }
        }
    }

    for (const a of topAccounts) {
        await crawl(a.id);
    }

    const allAccounts = Array.from(seen.values());

    // Cache the results
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: allAccounts
    }));

    logger.info(`[AccountFilter] Fetched ${allAccounts.length} accounts`);
    return allAccounts;
}

/**
 * Build account hierarchy tree
 * @param {Array} accounts - Flat array of accounts
 * @returns {Array} Tree structure
 */
function buildAccountTree(accounts) {
    const accountMap = new Map();
    const rootAccounts = [];

    // Create map and add children array
    accounts.forEach(acc => {
        accountMap.set(acc.id, { ...acc, children: [] });
    });

    // Build tree structure
    accounts.forEach(acc => {
        const node = accountMap.get(acc.id);
        if (acc.parent_account_id && accountMap.has(acc.parent_account_id)) {
            accountMap.get(acc.parent_account_id).children.push(node);
        } else {
            rootAccounts.push(node);
        }
    });

    // Sort children by name
    function sortChildren(node) {
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.children.forEach(sortChildren);
    }
    rootAccounts.forEach(sortChildren);

    return rootAccounts;
}

/**
 * Count sub-accounts recursively
 * @param {Object} node - Account tree node
 * @returns {number} Count of sub-accounts
 */
function countSubAccounts(node) {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.length + node.children.reduce((sum, child) => sum + countSubAccounts(child), 0);
}

/**
 * Render account tree node with checkbox
 * @param {Object} node - Account tree node
 * @param {Set} selectedIds - Set of selected account IDs
 * @param {Function} onChange - Callback when checkbox changes
 * @param {number} level - Indentation level
 * @returns {HTMLElement} Tree node element
 */
function renderAccountNode(node, selectedIds, onChange, level = 0) {
    const container = createElement('div', {
        style: `margin-left: ${level * 20}px; margin-bottom: 4px;`
    });

    const checkbox = createElement('input', {
        type: 'checkbox',
        id: `account-${node.id}`,
        checked: selectedIds.has(String(node.id)),
        style: 'margin-right: 8px;'
    });

    checkbox.addEventListener('change', () => {
        onChange(String(node.id), checkbox.checked);
    });

    const subCount = countSubAccounts(node);
    const label = createElement('label', {
        for: `account-${node.id}`,
        style: 'cursor: pointer; user-select: none;'
    });

    const labelText = subCount > 0
        ? `${node.name} (ID: ${node.id}) [${subCount} sub-account${subCount !== 1 ? 's' : ''}]`
        : `${node.name} (ID: ${node.id})`;

    label.textContent = labelText;

    container.appendChild(checkbox);
    container.appendChild(label);

    // Render children
    if (node.children && node.children.length > 0) {
        const childrenContainer = createElement('div', {
            style: 'margin-top: 4px;'
        });

        node.children.forEach(child => {
            childrenContainer.appendChild(renderAccountNode(child, selectedIds, onChange, level + 1));
        });

        container.appendChild(childrenContainer);
    }

    return container;
}

/**
 * Render account filter panel
 * @param {HTMLElement} root - Root container element
 * @param {Object} currentConfig - Current configuration
 */
export async function renderAccountFilterPanel(root, currentConfig = {}) {
    logger.debug('[AccountFilter] Rendering account filter panel');

    const panel = createPanel('Account Filter', 'Configure which accounts the script should run on');

    // Enable toggle
    const toggleContainer = createElement('div', {
        style: 'margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px;'
    });

    const enableCheckbox = createElement('input', {
        type: 'checkbox',
        id: 'enable-account-filter',
        checked: currentConfig.ENABLE_ACCOUNT_FILTER || false,
        style: 'margin-right: 8px;'
    });

    const enableLabel = createElement('label', {
        for: 'enable-account-filter',
        style: 'cursor: pointer; font-weight: 600;'
    });
    enableLabel.textContent = 'Enable Account Filtering';

    toggleContainer.appendChild(enableCheckbox);
    toggleContainer.appendChild(enableLabel);

    const helpText = createElement('div', {
        style: 'margin-top: 8px; font-size: 12px; color: #666;'
    });
    helpText.textContent = 'When enabled, the script will only run on selected accounts. When disabled, the script runs on all accounts.';
    toggleContainer.appendChild(helpText);

    panel.appendChild(toggleContainer);

    // Account tree container
    const treeContainer = createElement('div', {
        id: 'account-tree-container',
        style: 'margin-top: 16px; max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 12px; border-radius: 4px; background: #fafafa;'
    });

    // Loading state
    const loadingDiv = createElement('div', {
        style: 'text-align: center; padding: 20px; color: #666;'
    });
    loadingDiv.textContent = '⏳ Loading accounts...';
    treeContainer.appendChild(loadingDiv);

    panel.appendChild(treeContainer);

    // Status message
    const statusDiv = createElement('div', {
        id: 'account-filter-status',
        style: 'margin-top: 12px; padding: 8px; border-radius: 4px; display: none;'
    });
    panel.appendChild(statusDiv);

    root.appendChild(panel);

    // Fetch and render accounts
    try {
        const accounts = await fetchAllAccounts();
        const tree = buildAccountTree(accounts);

        // Get selected account IDs from config
        const selectedIds = new Set(
            (currentConfig.ALLOWED_ACCOUNT_IDS || []).map(id => String(id))
        );

        // Clear loading state
        treeContainer.innerHTML = '';

        // Render tree
        tree.forEach(rootNode => {
            treeContainer.appendChild(renderAccountNode(rootNode, selectedIds, (accountId, checked) => {
                if (checked) {
                    selectedIds.add(accountId);
                } else {
                    selectedIds.delete(accountId);
                }

                // Update config
                updateAccountFilterConfig(enableCheckbox.checked, Array.from(selectedIds));
            }));
        });

        // Handle enable toggle
        enableCheckbox.addEventListener('change', () => {
            updateAccountFilterConfig(enableCheckbox.checked, Array.from(selectedIds));
        });

    } catch (error) {
        logger.error('[AccountFilter] Error loading accounts:', error);
        treeContainer.innerHTML = '';
        const errorDiv = createElement('div', {
            style: 'text-align: center; padding: 20px; color: #cf1322;'
        });
        errorDiv.textContent = `❌ Error loading accounts: ${error.message}`;
        treeContainer.appendChild(errorDiv);
    }
}

/**
 * Update account filter configuration
 * @param {boolean} enabled - Whether account filtering is enabled
 * @param {Array<string>} accountIds - Array of allowed account IDs
 */
function updateAccountFilterConfig(enabled, accountIds) {
    logger.debug('[AccountFilter] Updating config:', { enabled, accountIds });

    // Update global config
    if (!window.CG_MANAGED) window.CG_MANAGED = {};
    if (!window.CG_MANAGED.config) window.CG_MANAGED.config = {};

    window.CG_MANAGED.config.ENABLE_ACCOUNT_FILTER = enabled;
    window.CG_MANAGED.config.ALLOWED_ACCOUNT_IDS = accountIds;

    // Trigger notification
    triggerConfigChangeNotification();

    // Show status message
    const statusDiv = document.getElementById('account-filter-status');
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#e6f7ff';
        statusDiv.style.border = '1px solid #91d5ff';
        statusDiv.style.color = '#0050b3';

        if (enabled) {
            statusDiv.textContent = `✅ Account filtering enabled for ${accountIds.length} account${accountIds.length !== 1 ? 's' : ''}`;
        } else {
            statusDiv.textContent = '✅ Account filtering disabled - script will run on all accounts';
        }

        // Hide after 3 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}