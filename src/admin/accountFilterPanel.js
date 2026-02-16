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
 *
 * Refactored to use:
 * - Canvas ic-* UI classes
 * - Collapsible panel helper from canvasFormHelpers.js
 * - Status message classes from dashboardStyles.css
 */

import { logger } from '../utils/logger.js';
import { createElement } from './domHelpers.js';
import { createCollapsiblePanel, createCheckbox } from './canvasFormHelpers.js';
import { triggerConfigChangeNotification } from './loaderGeneratorPanel.js';
import { getAccountId } from './pageDetection.js';

const CACHE_KEY = 'cg_admin_accounts_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

/**
 * Fetch all accounts with pagination
 * @param {string} url - API URL
 * @returns {Promise<Array>} Array of items
 */
async function fetchAllPages(url) {
    logger.trace('[AccountFilter] fetchAllPages called with URL:', url);
    const out = [];
    let next = url;
    let pageCount = 0;
    while (next) {
        pageCount++;
        logger.trace(`[AccountFilter] Fetching page ${pageCount}: ${next}`);
        const res = await fetch(next, { credentials: "include" });
        if (!res.ok) {
            logger.error(`[AccountFilter] HTTP ${res.status} for ${next}`);
            throw new Error(`HTTP ${res.status} for ${next}`);
        }
        const data = await res.json();
        logger.trace(`[AccountFilter] Page ${pageCount} returned ${data.length} items`);
        out.push(...data);
        const link = res.headers.get("Link");
        next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    logger.trace(`[AccountFilter] fetchAllPages complete: ${out.length} total items from ${pageCount} pages`);
    return out;
}

/**
 * Fetch all accounts recursively
 * @returns {Promise<Array>} Array of all accounts
 */
async function fetchAllAccounts() {
    logger.debug('[AccountFilter] fetchAllAccounts() called');

    // Check cache first
    logger.trace('[AccountFilter] Checking sessionStorage cache...');
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
        logger.trace('[AccountFilter] Cache entry found, validating...');
        try {
            const { timestamp, data } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            const ageMinutes = Math.floor(age / 1000 / 60);

            if (age < CACHE_DURATION) {
                logger.debug(`[AccountFilter] Cache HIT - Using cached data (age: ${ageMinutes} minutes, ${data.length} accounts)`);
                return data;
            } else {
                logger.debug(`[AccountFilter] Cache EXPIRED - Age: ${ageMinutes} minutes (max: 30 minutes)`);
            }
        } catch (e) {
            logger.warn('[AccountFilter] Cache INVALID - Failed to parse cached data:', e);
        }
    } else {
        logger.trace('[AccountFilter] Cache MISS - No cached data found');
    }

    const BASE = location.origin;
    logger.debug(`[AccountFilter] Fetching accounts from API (base: ${BASE})`);

    // 1) Get top accounts
    logger.debug('[AccountFilter] Step 1: Fetching top-level accounts...');
    const topAccounts = await fetchAllPages(`${BASE}/api/v1/accounts?per_page=100`);
    logger.debug(`[AccountFilter] Found ${topAccounts.length} top-level accounts`);

    // 2) Recursively get all subaccounts
    logger.debug('[AccountFilter] Step 2: Crawling sub-accounts recursively...');
    const seen = new Map();
    for (const a of topAccounts) {
        logger.trace(`[AccountFilter] Adding top account to map: ${a.name} (ID: ${a.id})`);
        seen.set(a.id, a);
    }

    let crawlCount = 0;
    async function crawl(accountId) {
        crawlCount++;
        logger.trace(`[AccountFilter] Crawling account ${accountId} (crawl #${crawlCount})`);
        const subs = await fetchAllPages(
            `${BASE}/api/v1/accounts/${accountId}/sub_accounts?recursive=false&per_page=100`
        );

        logger.trace(`[AccountFilter] Account ${accountId} has ${subs.length} direct sub-accounts`);
        for (const sa of subs) {
            if (!seen.has(sa.id)) {
                logger.trace(`[AccountFilter] Found new sub-account: ${sa.name} (ID: ${sa.id}, parent: ${sa.parent_account_id})`);
                seen.set(sa.id, sa);
                await crawl(sa.id);
            } else {
                logger.trace(`[AccountFilter] Skipping duplicate account: ${sa.name} (ID: ${sa.id})`);
            }
        }
    }

    for (const a of topAccounts) {
        logger.trace(`[AccountFilter] Starting crawl from top account: ${a.name} (ID: ${a.id})`);
        await crawl(a.id);
    }

    const allAccounts = Array.from(seen.values());
    logger.debug(`[AccountFilter] Crawl complete: ${allAccounts.length} total accounts found (${crawlCount} crawl operations)`);

    // Cache the results
    logger.trace('[AccountFilter] Caching results to sessionStorage...');
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: allAccounts
    }));
    logger.trace('[AccountFilter] Cache saved successfully');

    logger.debug(`[AccountFilter] fetchAllAccounts() complete: ${allAccounts.length} accounts`);
    return allAccounts;
}

/**
 * Build account hierarchy tree
 * @param {Array} accounts - Flat array of accounts
 * @returns {Array} Tree structure
 */
function buildAccountTree(accounts) {
    logger.debug(`[AccountFilter] buildAccountTree() called with ${accounts.length} accounts`);
    const accountMap = new Map();
    const rootAccounts = [];

    // Create map and add children array
    logger.trace('[AccountFilter] Creating account map...');
    accounts.forEach(acc => {
        accountMap.set(acc.id, { ...acc, children: [] });
    });
    logger.trace(`[AccountFilter] Account map created with ${accountMap.size} entries`);

    // Build tree structure
    logger.trace('[AccountFilter] Building tree structure...');
    let rootCount = 0;
    let childCount = 0;
    accounts.forEach(acc => {
        const node = accountMap.get(acc.id);
        if (acc.parent_account_id && accountMap.has(acc.parent_account_id)) {
            accountMap.get(acc.parent_account_id).children.push(node);
            childCount++;
        } else {
            rootAccounts.push(node);
            rootCount++;
            logger.trace(`[AccountFilter] Root account: ${acc.name} (ID: ${acc.id})`);
        }
    });
    logger.trace(`[AccountFilter] Tree structure built: ${rootCount} root accounts, ${childCount} child accounts`);

    // Sort children by name
    logger.trace('[AccountFilter] Sorting children by name...');
    function sortChildren(node) {
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.children.forEach(sortChildren);
    }
    rootAccounts.forEach(sortChildren);
    logger.trace('[AccountFilter] Sorting complete');

    logger.debug(`[AccountFilter] buildAccountTree() complete: ${rootAccounts.length} root nodes`);
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
 * @param {string|null} currentAccountId - Current account ID (where dashboard is running)
 * @returns {HTMLElement} Tree node element
 */
function renderAccountNode(node, selectedIds, onChange, level = 0, currentAccountId = null) {
    logger.trace(`[AccountFilter] Rendering node: ${node.name} (ID: ${node.id}, level: ${level})`);

    const isChecked = selectedIds.has(String(node.id));
    logger.trace(`[AccountFilter] Node ${node.id} checked state: ${isChecked}`);

    // Create container for this node and its children
    const nodeContainer = createElement('div', {
        style: {
            marginBottom: '0px'
        }
    });

    // Create indentation wrapper with proper margin-left as object
    const indentMargin = level * 24;
    logger.trace(`[AccountFilter] Creating indent wrapper for level ${level} with margin-left: ${indentMargin}px`);
    const indentWrapper = createElement('div', {
        style: {
            marginLeft: `${indentMargin}px`
        }
    });
    logger.trace(`[AccountFilter] Indent wrapper created, marginLeft style: ${indentWrapper.style.marginLeft}`);

    // Build label text with account info
    const subCount = countSubAccounts(node);
    let labelText = subCount > 0
        ? `${node.name} (ID: ${node.id}) [${subCount} sub-account${subCount !== 1 ? 's' : ''}]`
        : `${node.name} (ID: ${node.id})`;

    // Track if we need HTML for colored text
    let needsHtml = false;
    let htmlLabelText = labelText;

    // Add recommendation label for root account (ID 1) in red
    if (node.id === 1) {
        htmlLabelText += ' <span style="color: #cf1322; font-weight: 600;">(Required for student dashboard & grades page customizations)</span>';
        needsHtml = true;
    }

    // Add current account indicator
    if (currentAccountId && String(node.id) === String(currentAccountId)) {
        const currentAccountText = ' (Current account - this dashboard is running on this account)';
        if (needsHtml) {
            htmlLabelText += currentAccountText;
        } else {
            labelText += currentAccountText;
        }
    }

    // Create checkbox manually to support HTML labels
    const checkboxId = `account-checkbox-${node.id}`;
    const checkbox = createElement('input', {
        attrs: { type: 'checkbox', checked: isChecked ? 'true' : undefined, id: checkboxId }
    });

    const label = createElement('label', {
        attrs: { for: checkboxId },
        style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginBottom: '6px' }
    });

    label.appendChild(checkbox);

    // Use HTML or text depending on whether we need colored text
    if (needsHtml) {
        const span = createElement('span', { html: htmlLabelText });
        label.appendChild(span);
    } else {
        const span = createElement('span', { text: labelText });
        label.appendChild(span);
    }

    // Set the checkbox state
    checkbox.checked = isChecked;

    // Add change event listener
    checkbox.addEventListener('change', () => {
        const newCheckedState = checkbox.checked;
        logger.debug(`[AccountFilter] Checkbox changed for account ${node.id} (${node.name}): ${!newCheckedState} -> ${newCheckedState}`);

        // Update the selected state
        if (newCheckedState) {
            selectedIds.add(String(node.id));
        } else {
            selectedIds.delete(String(node.id));
        }

        // Trigger the onChange callback
        onChange(String(node.id), newCheckedState);
    });

    // Append checkbox label to indent wrapper
    indentWrapper.appendChild(label);
    nodeContainer.appendChild(indentWrapper);

    // Render children
    if (node.children && node.children.length > 0) {
        logger.trace(`[AccountFilter] Node ${node.id} has ${node.children.length} children, rendering...`);

        node.children.forEach(child => {
            nodeContainer.appendChild(renderAccountNode(child, selectedIds, onChange, level + 1, currentAccountId));
        });
    }

    return nodeContainer;
}

/**
 * Render account filter panel
 * @param {HTMLElement} root - Root container element
 * @param {Object} currentConfig - Current configuration
 */
export async function renderAccountFilterPanel(root, currentConfig = {}) {
    logger.debug('[AccountFilter] ========================================');
    logger.debug('[AccountFilter] renderAccountFilterPanel() CALLED');
    logger.debug('[AccountFilter] ========================================');
    logger.debug('[AccountFilter] Root element:', root);
    logger.debug('[AccountFilter] Current config:', currentConfig);

    if (!root) {
        logger.error('[AccountFilter] ERROR: Root element is null or undefined!');
        return;
    }

    logger.trace('[AccountFilter] Creating collapsible panel...');
    const { panel, body } = createCollapsiblePanel('Account Filter');
    logger.trace('[AccountFilter] Panel created:', panel);

    // Add description at the top
    logger.trace('[AccountFilter] Adding description...');
    const description = createElement('div', {
        style: 'margin-bottom: 8px; color: #666; font-size: 14px;'
    });
    description.textContent = 'Configure which accounts the script should run on';
    body.appendChild(description);
    logger.trace('[AccountFilter] Description added');

    // Add help text at the top
    const helpText = createElement('div', {
        style: 'margin-bottom: 16px; font-size: 12px; color: #666;'
    });
    helpText.textContent = 'When enabled, the script will only run on selected accounts. When disabled, the script runs on all accounts.';
    body.appendChild(helpText);

    // Enable toggle (after all descriptive text)
    logger.trace('[AccountFilter] Creating enable toggle...');
    // Read directly from window.CG_MANAGED.config to get the latest values
    const enabledState = window.CG_MANAGED?.config?.ENABLE_ACCOUNT_FILTER || false;
    logger.debug(`[AccountFilter] Enable toggle initial state: ${enabledState}`);

    // Use Canvas checkbox helper
    const { container: enableCheckboxContainer, checkbox: enableCheckbox } = createCheckbox({
        label: 'Enable Account Filtering',
        id: 'enable-account-filter',
        checked: enabledState
    });

    logger.trace('[AccountFilter] Appending enable toggle to panel...');
    body.appendChild(enableCheckboxContainer);
    logger.trace('[AccountFilter] Enable toggle appended');

    // Create warning message container (initially hidden) - placed after enable toggle
    const warningDiv = createElement('div', {
        id: 'account-filter-warning',
        attrs: { class: 'cg-status cg-status--warning' },
        style: {
            display: 'none',
            marginBottom: '12px'
        }
    });
    warningDiv.textContent = '⚠️ Warning: The admin dashboard is currently running on this account. If this account is not enabled in the filter, the admin dashboard will not work after you upload the generated loader.';
    body.appendChild(warningDiv);

    // Account tree container
    logger.trace('[AccountFilter] Creating tree container...');
    const treeContainer = createElement('div', {
        id: 'account-tree-container',
        style: {
            marginTop: '0px',
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '12px',
            borderRadius: '4px',
            background: '#fafafa',
            display: enabledState ? 'block' : 'none',
            fontFamily: '"Courier New", monospace'
        }
    });

    // Function to update tree container visibility
    const updateTreeVisibility = (enabled) => {
        logger.debug(`[AccountFilter] updateTreeVisibility called with enabled=${enabled}`);
        treeContainer.style.display = enabled ? 'block' : 'none';
        logger.debug(`[AccountFilter] Tree container display set to: ${treeContainer.style.display}`);
    };

    // Loading state
    logger.trace('[AccountFilter] Creating loading indicator...');
    const loadingDiv = createElement('div', {
        style: { textAlign: 'center', padding: '20px', color: '#666' }
    });
    loadingDiv.textContent = '⏳ Loading accounts...';
    treeContainer.appendChild(loadingDiv);

    logger.trace('[AccountFilter] Appending tree container to panel body...');
    body.appendChild(treeContainer);

    // Status message
    logger.trace('[AccountFilter] Creating status div...');
    const statusDiv = createElement('div', {
        id: 'account-filter-status',
        attrs: { class: 'cg-status' },
        style: { marginTop: '12px', display: 'none' }
    });
    body.appendChild(statusDiv);

    // Append panel to root
    root.appendChild(panel);
    logger.debug('[AccountFilter] Panel appended to root');

    // Fetch and render accounts
    logger.debug('[AccountFilter] Starting account fetch and render...');
    try {
        logger.debug('[AccountFilter] Calling fetchAllAccounts()...');
        const accounts = await fetchAllAccounts();
        logger.debug(`[AccountFilter] fetchAllAccounts() returned ${accounts.length} accounts`);

        logger.debug('[AccountFilter] Building account tree...');
        const tree = buildAccountTree(accounts);
        logger.debug(`[AccountFilter] Tree built with ${tree.length} root nodes`);

        // Get selected account IDs from config - read directly from window.CG_MANAGED.config
        const allowedIds = window.CG_MANAGED?.config?.ALLOWED_ACCOUNT_IDS || [];
        logger.debug(`[AccountFilter] Allowed account IDs from config: ${JSON.stringify(allowedIds)}`);
        const selectedIds = new Set(allowedIds.map(id => String(id)));
        logger.debug(`[AccountFilter] Selected IDs set size: ${selectedIds.size}`);

        // Clear loading state
        logger.trace('[AccountFilter] Clearing loading state...');
        treeContainer.innerHTML = '';
        logger.trace('[AccountFilter] Loading state cleared');

        // Get current account ID
        const currentAccountId = getAccountId();
        logger.debug(`[AccountFilter] Current account ID: ${currentAccountId}`);

        // Function to update warning visibility
        const updateWarningVisibility = () => {
            if (currentAccountId && enableCheckbox.checked && !selectedIds.has(String(currentAccountId))) {
                warningDiv.style.display = 'block';
                logger.debug('[AccountFilter] Warning displayed: current account not in allowed list');
            } else {
                warningDiv.style.display = 'none';
                logger.debug('[AccountFilter] Warning hidden');
            }
        };

        // Render tree
        logger.debug('[AccountFilter] Rendering tree nodes...');
        tree.forEach((rootNode, index) => {
            logger.trace(`[AccountFilter] Rendering root node ${index + 1}/${tree.length}: ${rootNode.name}`);
            treeContainer.appendChild(renderAccountNode(rootNode, selectedIds, (accountId, checked) => {
                logger.debug(`[AccountFilter] onChange callback fired: accountId=${accountId}, checked=${checked}`);
                if (checked) {
                    selectedIds.add(accountId);
                    logger.trace(`[AccountFilter] Added ${accountId} to selectedIds (new size: ${selectedIds.size})`);
                } else {
                    selectedIds.delete(accountId);
                    logger.trace(`[AccountFilter] Removed ${accountId} from selectedIds (new size: ${selectedIds.size})`);
                }

                // Update config
                logger.debug(`[AccountFilter] Calling updateAccountFilterConfig with ${selectedIds.size} selected accounts`);
                updateAccountFilterConfig(enableCheckbox.checked, Array.from(selectedIds));

                // Update warning visibility
                updateWarningVisibility();
            }, 0, currentAccountId));
        });
        logger.debug('[AccountFilter] Tree rendering complete');

        // Initial warning visibility check
        updateWarningVisibility();

        // Handle enable toggle
        logger.trace('[AccountFilter] Attaching enable toggle event listener...');
        enableCheckbox.addEventListener('change', () => {
            logger.debug(`[AccountFilter] Enable toggle changed: ${enableCheckbox.checked}`);
            updateTreeVisibility(enableCheckbox.checked);
            updateAccountFilterConfig(enableCheckbox.checked, Array.from(selectedIds));
            updateWarningVisibility();
        });
        logger.trace('[AccountFilter] Enable toggle event listener attached');

        logger.debug('[AccountFilter] renderAccountFilterPanel() COMPLETE - Panel rendered successfully');

    } catch (error) {
        logger.error('[AccountFilter] ❌ ERROR loading accounts:', error);
        logger.error('[AccountFilter] Error stack:', error.stack);
        treeContainer.innerHTML = '';
        const errorDiv = createElement('div', {
            style: 'text-align: center; padding: 20px; color: #cf1322;'
        });
        errorDiv.textContent = `❌ Error loading accounts: ${error.message}`;
        treeContainer.appendChild(errorDiv);
        logger.error('[AccountFilter] Error UI displayed to user');
    }
}

/**
 * Update account filter configuration
 * @param {boolean} enabled - Whether account filtering is enabled
 * @param {Array<string>} accountIds - Array of allowed account IDs
 */
function updateAccountFilterConfig(enabled, accountIds) {
    logger.debug('[AccountFilter] ----------------------------------------');
    logger.debug('[AccountFilter] updateAccountFilterConfig() called');
    logger.debug('[AccountFilter] Enabled:', enabled);
    logger.debug('[AccountFilter] Account IDs:', accountIds);
    logger.debug('[AccountFilter] ----------------------------------------');

    // Update global config
    logger.trace('[AccountFilter] Updating window.CG_MANAGED.config...');
    if (!window.CG_MANAGED) {
        logger.trace('[AccountFilter] Creating window.CG_MANAGED');
        window.CG_MANAGED = {};
    }
    if (!window.CG_MANAGED.config) {
        logger.trace('[AccountFilter] Creating window.CG_MANAGED.config');
        window.CG_MANAGED.config = {};
    }

    window.CG_MANAGED.config.ENABLE_ACCOUNT_FILTER = enabled;
    window.CG_MANAGED.config.ALLOWED_ACCOUNT_IDS = accountIds;
    logger.debug('[AccountFilter] Config updated:', window.CG_MANAGED.config);

    // Trigger notification
    logger.trace('[AccountFilter] Triggering config change notification...');
    triggerConfigChangeNotification();
    logger.trace('[AccountFilter] Notification triggered');

    // Show status message
    logger.trace('[AccountFilter] Showing status message...');
    const statusDiv = document.getElementById('account-filter-status');
    if (statusDiv) {
        logger.trace('[AccountFilter] Status div found, updating...');
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#e6f7ff';
        statusDiv.style.border = '1px solid #91d5ff';
        statusDiv.style.color = '#0050b3';

        if (enabled) {
            statusDiv.textContent = `✅ Account filtering enabled for ${accountIds.length} account${accountIds.length !== 1 ? 's' : ''}`;
        } else {
            statusDiv.textContent = '✅ Account filtering disabled - script will run on all accounts';
        }
        logger.trace('[AccountFilter] Status message displayed');

        // Hide after 3 seconds
        setTimeout(() => {
            logger.trace('[AccountFilter] Hiding status message');
            statusDiv.style.display = 'none';
        }, 3000);
    } else {
        logger.warn('[AccountFilter] Status div not found in DOM');
    }

    logger.debug('[AccountFilter] updateAccountFilterConfig() complete');
}