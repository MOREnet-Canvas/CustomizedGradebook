// src/admin/loaderGeneratorPanel.js
/**
 * Loader Generator Panel Module
 *
 * Renders the loader generator panel with:
 * - Auto-load current Theme JS (other theme scripts - preserved)
 * - Textarea locking/unlocking
 * - CG-managed block generation (CONFIG-ONLY)
 * - Combined loader output with copy/download
 */

import { logger } from '../utils/logger.js';
import { getAccountId, getInstalledThemeJsUrl } from './pageDetection.js';
import { createElement, createPanel, escapeHtml, downloadText } from './domHelpers.js';
import { fetchTextWithTimeout } from './fetchHelpers.js';
import { buildCGManagedBlock, upsertCGBlockIntoLoader, validateLoaderOutput, extractSections } from './loaderGenerator.js';
import { CG_LOADER_TEMPLATE } from './templates/cgLoaderTemplate.js';

/**
 * Parse configuration settings from Section B (CG_MANAGED block)
 *
 * @param {string} sectionB - Section B content
 * @returns {Object} Parsed configuration settings
 */
function parseConfigFromSectionB(sectionB) {
    if (!sectionB) {
        throw new Error('Section B is empty');
    }

    // Execute Section B in a sandboxed context to extract window.CG_MANAGED
    const sandbox = { window: { CG_MANAGED: null, CG_CONFIG: {} } };

    try {
        // Create a function that executes the Section B code
        const func = new Function('window', sectionB);
        func(sandbox.window);
    } catch (err) {
        logger.error('[LoaderGeneratorPanel] Failed to execute Section B', err);
        throw new Error('Failed to parse Section B: ' + err.message);
    }

    const managed = sandbox.window.CG_MANAGED;

    if (!managed || !managed.release || !managed.config) {
        throw new Error('Section B does not contain valid CG_MANAGED structure');
    }

    // Extract all settings
    return {
        version: managed.release.version || 'v1.0.3',
        channel: managed.release.channel || 'prod',
        source: managed.release.source || 'github_release',
        versionTrack: managed.release.versionTrack || null,
        enableStudentGradeCustomization: managed.config.ENABLE_STUDENT_GRADE_CUSTOMIZATION !== false,
        enableGradeOverride: managed.config.ENABLE_GRADE_OVERRIDE !== false,
        enforceCourseOverride: managed.config.ENFORCE_COURSE_OVERRIDE === true,
        updateAvgButtonLabel: managed.config.UPDATE_AVG_BUTTON_LABEL || 'Update Avg',
        avgOutcomeName: managed.config.AVG_OUTCOME_NAME || 'Average',
        avgAssignmentName: managed.config.AVG_ASSIGNMENT_NAME || 'Average Assignment',
        avgRubricName: managed.config.AVG_RUBRIC_NAME || 'Average Rubric',
        defaultMaxPoints: managed.config.DEFAULT_MAX_POINTS || 4,
        defaultMasteryThreshold: managed.config.DEFAULT_MASTERY_THRESHOLD || 3,
        outcomeAndRubricRatings: managed.config.OUTCOME_AND_RUBRIC_RATINGS || [],
        excludedOutcomeKeywords: managed.config.EXCLUDED_OUTCOME_KEYWORDS || []
    };
}

/**
 * Map channel and version to dropdown value
 *
 * @param {string} channel - Release channel (prod, auto-patch, beta, dev)
 * @param {string} version - Version string (e.g., "v1.0.3")
 * @param {string|null} versionTrack - Version track for auto-patch (e.g., "v1.0-latest")
 * @returns {string} Dropdown value
 */
function mapChannelToDropdownValue(channel, version, versionTrack = null) {
    if (channel === 'auto-patch') {
        return versionTrack || 'v1.0-latest';
    } else if (channel === 'beta') {
        return 'latest';
    } else if (channel === 'dev') {
        return 'dev';
    } else {
        // prod or any other channel - use specific version
        return version;
    }
}

/**
 * Update version dropdown to highlight and select the currently installed version
 *
 * @param {HTMLSelectElement} dropdown - Version dropdown element
 * @param {string} installedValue - The dropdown value that matches the installed version
 */
function updateVersionDropdownWithInstalled(dropdown, installedValue) {
    if (!dropdown || !installedValue) return;

    // Update all options to add/remove the "Currently Installed" indicator
    Array.from(dropdown.options).forEach(option => {
        const baseLabel = option.getAttribute('data-base-label') || option.text.replace(' ✓ Currently Installed', '');

        // Store the base label if not already stored
        if (!option.getAttribute('data-base-label')) {
            option.setAttribute('data-base-label', baseLabel);
        }

        if (option.value === installedValue) {
            // Mark as currently installed
            option.text = baseLabel + ' ✓ Currently Installed';
            option.style.fontWeight = 'bold';
            option.style.color = '#0374B5';
        } else {
            // Remove installed indicator
            option.text = baseLabel;
            option.style.fontWeight = 'normal';
            option.style.color = '';
        }
    });

    // Set the dropdown to the installed version
    dropdown.value = installedValue;

    logger.debug('[LoaderGeneratorPanel] Version dropdown updated to show installed version:', installedValue);
}

/**
 * Populate configuration controls with parsed settings from installed loader
 *
 * @param {Object} controls - Configuration panel controls object
 * @param {Object} parsedSettings - Parsed settings from Section B
 */
function populateConfigurationControls(controls, parsedSettings) {
    if (!controls || !parsedSettings) return;

    logger.debug('[LoaderGeneratorPanel] Populating configuration controls with parsed settings', parsedSettings);

    // Feature flags
    if (parsedSettings.enableStudentGradeCustomization !== undefined) {
        controls.enableStudentGrade.checked = parsedSettings.enableStudentGradeCustomization;
    }
    if (parsedSettings.enableGradeOverride !== undefined) {
        controls.enableGradeOverride.checked = parsedSettings.enableGradeOverride;
    }
    if (parsedSettings.enforceCourseOverride !== undefined) {
        controls.enforceCourseOverride.checked = parsedSettings.enforceCourseOverride;
    }

    // UI labels
    if (parsedSettings.updateAvgButtonLabel) {
        controls.updateAvgButtonLabel.value = parsedSettings.updateAvgButtonLabel;
    }
    if (parsedSettings.avgOutcomeName) {
        controls.avgOutcomeName.value = parsedSettings.avgOutcomeName;
    }
    if (parsedSettings.avgAssignmentName) {
        controls.avgAssignmentName.value = parsedSettings.avgAssignmentName;
    }
    if (parsedSettings.avgRubricName) {
        controls.avgRubricName.value = parsedSettings.avgRubricName;
    }

    // Outcome configuration
    if (parsedSettings.defaultMaxPoints !== undefined) {
        controls.defaultMaxPoints.value = parsedSettings.defaultMaxPoints.toString();
    }
    if (parsedSettings.defaultMasteryThreshold !== undefined) {
        controls.defaultMasteryThreshold.value = parsedSettings.defaultMasteryThreshold.toString();
    }

    // Rating scale (JSON array)
    if (parsedSettings.outcomeAndRubricRatings && Array.isArray(parsedSettings.outcomeAndRubricRatings)) {
        try {
            controls.ratingsTextarea.value = JSON.stringify(parsedSettings.outcomeAndRubricRatings, null, 2);
        } catch (err) {
            logger.warn('[LoaderGeneratorPanel] Failed to stringify outcomeAndRubricRatings', err);
        }
    }

    // Excluded keywords (array to comma-separated string)
    if (parsedSettings.excludedOutcomeKeywords && Array.isArray(parsedSettings.excludedOutcomeKeywords)) {
        controls.keywordsInput.value = parsedSettings.excludedOutcomeKeywords.join(', ');
    }

    logger.debug('[LoaderGeneratorPanel] Configuration controls populated successfully');
}

/**
 * Render loader generator panel
 *
 * @param {HTMLElement} root - Root container element
 */
export function renderLoaderGeneratorPanel(root) {
    logger.debug('[LoaderGeneratorPanel] Rendering loader generator panel');

    const panel = createPanel(root, 'Generate Combined Loader (A+B+C Model)');
    const installedUrl = getInstalledThemeJsUrl();

    // State management for change tracking and revert functionality
    const state = {
        currentCanvasSettings: null,
        hasUnsavedChanges: false,
        isGenerated: false
    };

    // Version selector
    const { versionSelector, versionDropdown } = createVersionSelector();

    // Top note - explain A/B/C model (will be moved below config panel)
    const topNote = createElement('div', {
        html: `
            <div style="color:#444; margin-bottom:10px; padding:12px; background:#f9f9f9; border-left:3px solid #0374B5; border-radius:6px;">
                This tool generates a combined loader using the <strong>A+B+C model</strong>:
                <ul style="margin:8px 0; padding-left:20px; font-size:13px;">
                    <li><strong>A</strong> = Other Theme Scripts (preserved exactly as-is)</li>
                    <li><strong>B</strong> = Managed config block (generated fresh from your settings)</li>
                    <li><strong>C</strong> = CG loader template (stable logic from codebase)</li>
                </ul>
            </div>
        `
    });

    // Installed URL display (will be moved below config panel)
    const installedLine = createElement('div', {
        html: `
            <div style="font-size:13px; color:#666; margin-bottom:10px; padding:10px; background:#f5f5f5; border-radius:6px;">
                <strong>Detected installed Theme JS URL:</strong>
                <div style="margin-top:4px; word-break:break-all; font-family:monospace; font-size:12px;">${escapeHtml(installedUrl || '(none)')}</div>
            </div>
        `
    });

    // Load status display (will be moved below config panel)
    const loadStatus = createElement('div', {
        style: { marginBottom: '10px' }
    });

    // Configuration panel with all settings
    const { container: configPanel, controls } = createConfigurationPanel();

    // Textarea A: Other Theme Scripts (editable)
    const { baseLabel, baseTA, helperText, lockRow, unlockBtn, relockBtn, reloadBtn } = createOtherScriptsTextarea(installedUrl);

    // Textarea B: Managed Config Preview (read-only)
    const { configLabel, configTA } = createConfigTextarea();

    // Textarea C: CG Loader Template (read-only, collapsible)
    const { templateTA, templateCollapsible } = createTemplateTextarea();

    // Sticky action panel (right side)
    const { changeNotification, genBtn, dlBtn, copyBtn } = createStickyActionPanel();

    // Legacy inline actions (hidden, for compatibility)
    const { actions } = createActionButtons();
    actions.style.display = 'none';

    // Textarea 4: Combined Output (read-only)
    const { outLabel, outTA, hint } = createOutputTextarea();

    // Auto-load function
    async function tryAutoLoad(reason) {
        loadStatus.innerHTML = '';

        if (!installedUrl) {
            loadStatus.appendChild(createElement('div', {
                text: '⚠️ No installed Theme JS URL detected. Paste the loader manually.',
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #f3d19e',
                    background: '#fff7e6'
                }
            }));
            setLoaderText(baseTA, '', false, unlockBtn, relockBtn);
            return;
        }

        loadStatus.appendChild(createElement('div', {
            html: `⏳ Loading current Theme JavaScript from installed URL… <span style="color:#666">(${escapeHtml(reason || 'auto')})</span>`,
            style: {
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d9d9d9',
                background: '#fafafa'
            }
        }));

        try {
            // Try twice: 1s then 3s timeout
            let text;
            try {
                text = await fetchTextWithTimeout(installedUrl, 1000);
            } catch {
                text = await fetchTextWithTimeout(installedUrl, 3000);
            }

            // Success - extract sections
            const { A, B, C } = extractSections(text);
            logger.debug('[LoaderGeneratorPanel] Extracted sections - A length:', A?.length, 'B length:', B?.length, 'C length:', C?.length);

            // Parse Section B to extract current Canvas settings
            try {
                const parsedSettings = parseConfigFromSectionB(B);
                state.currentCanvasSettings = parsedSettings;
                logger.debug('[LoaderGeneratorPanel] Stored current Canvas settings', parsedSettings);
                logger.debug('[LoaderGeneratorPanel] Rating scale data:', parsedSettings.outcomeAndRubricRatings);

                // Auto-select and highlight the currently installed version
                if (parsedSettings.channel && parsedSettings.version) {
                    const dropdownValue = mapChannelToDropdownValue(
                        parsedSettings.channel,
                        parsedSettings.version,
                        parsedSettings.versionTrack
                    );
                    updateVersionDropdownWithInstalled(versionDropdown, dropdownValue);
                }

                // Populate configuration controls with current settings
                populateConfigurationControls(controls, parsedSettings);

                // Reset change tracking state (no unsaved changes after auto-load)
                state.hasUnsavedChanges = false;
            } catch (err) {
                logger.warn('[LoaderGeneratorPanel] Failed to parse current Canvas settings', err);
                state.currentCanvasSettings = null;
            }

            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                html: `✅ Loaded current Theme JavaScript automatically.<br><span style="color:#666; font-size:13px;">Sections extracted. Textarea A is locked to prevent accidental edits. Click "Unlock to edit" if needed.</span>`,
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f',
                    background: '#f6ffed'
                }
            }));

            // Populate textareas with correct section assignments
            // A = Other Theme Scripts (external loader)
            setLoaderText(baseTA, A || text, true, unlockBtn, relockBtn);
            // B = Managed Config Block (generated config)
            configTA.value = B || '';
            // C = CG Loader Template (stable loader logic)
            templateTA.value = C || CG_LOADER_TEMPLATE;
        } catch (err) {
            logger.warn('[LoaderGeneratorPanel] Auto-load failed', err);

            loadStatus.innerHTML = '';
            loadStatus.appendChild(createElement('div', {
                html: `⚠️ Could not auto-load the current Theme JavaScript (likely CORS).<br><span style="color:#666; font-size:13px;">Please copy/paste the loader contents manually from the Theme Editor.</span>`,
                style: {
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #f3d19e',
                    background: '#fff7e6'
                }
            }));

            setLoaderText(baseTA, '', false, unlockBtn, relockBtn);
        }
    }

    // Event handlers
    unlockBtn.addEventListener('click', () => setLocked(baseTA, false, unlockBtn, relockBtn));
    relockBtn.addEventListener('click', () => setLocked(baseTA, true, unlockBtn, relockBtn));
    reloadBtn.addEventListener('click', () => tryAutoLoad('manual reload'));

    genBtn.addEventListener('click', () => {
        generateCombinedLoader(baseTA, controls, configTA, outTA, dlBtn, copyBtn, versionDropdown);

        // After successful generation:
        state.isGenerated = true;
        state.hasUnsavedChanges = false;
        changeNotification.style.display = 'none';
    });

    dlBtn.addEventListener('click', () => {
        if (!outTA.value.trim()) return;
        const filename = generateDownloadFilename(versionDropdown.value);
        downloadText(filename, outTA.value);
    });

    copyBtn.addEventListener('click', async () => {
        if (!outTA.value.trim()) return;
        try {
            await navigator.clipboard.writeText(outTA.value);
            alert('Copied combined loader to clipboard.');
        } catch (e) {
            logger.error('[LoaderGeneratorPanel] Copy failed', e);
            alert('Copy failed (clipboard permissions). You can still manually select + copy.');
        }
    });

    // Change tracking - add listeners to all form controls
    function markAsChanged() {
        if (!state.hasUnsavedChanges) {
            state.hasUnsavedChanges = true;
            changeNotification.style.display = 'block';
        }
    }

    // Track changes on all configuration controls
    controls.enableStudentGrade.addEventListener('change', markAsChanged);
    controls.enableGradeOverride.addEventListener('change', markAsChanged);
    controls.enforceCourseOverride.addEventListener('change', markAsChanged);
    controls.updateAvgButtonLabel.addEventListener('input', markAsChanged);
    controls.avgOutcomeName.addEventListener('input', markAsChanged);
    controls.avgAssignmentName.addEventListener('input', markAsChanged);
    controls.avgRubricName.addEventListener('input', markAsChanged);
    controls.defaultMaxPoints.addEventListener('input', markAsChanged);
    controls.defaultMasteryThreshold.addEventListener('input', markAsChanged);
    controls.ratingsTextarea.addEventListener('input', markAsChanged);
    controls.keywordsInput.addEventListener('input', markAsChanged);
    versionDropdown.addEventListener('change', markAsChanged);

    // Append all elements in new order:
    // 1. Version selector
    panel.appendChild(versionSelector);

    // 2. Configuration panel (all settings)
    panel.appendChild(configPanel);

    // 3. Status messages (moved here from top)
    panel.appendChild(topNote);
    panel.appendChild(installedLine);
    panel.appendChild(loadStatus);

    // 4. Textarea A (Other Theme Scripts)
    panel.appendChild(baseLabel);
    panel.appendChild(helperText);
    panel.appendChild(baseTA);
    panel.appendChild(lockRow);

    // 5. Textarea B (Managed Config Preview)
    panel.appendChild(configLabel);
    panel.appendChild(configTA);

    // 6. Textarea C (CG Loader Template - collapsible)
    panel.appendChild(templateCollapsible);

    // 7. Action buttons (will be moved to sticky panel)
    panel.appendChild(actions);

    // 8. Output textarea
    panel.appendChild(outLabel);
    panel.appendChild(outTA);
    panel.appendChild(hint);

    // Auto-load on first render
    tryAutoLoad('auto');
}

// Cache for fetched versions (avoid repeated API calls during same session)
let cachedVersionData = null;

/**
 * Fetch available versions from GitHub Pages manifest
 *
 * @returns {Promise<Object>} Version data with latest version and all v1.0.x releases
 */
async function fetchAvailableVersions() {
    // Return cached data if available
    if (cachedVersionData) {
        logger.debug('[LoaderGeneratorPanel] Using cached version data');
        return cachedVersionData;
    }

    const manifestUrl = 'https://morenet-canvas.github.io/CustomizedGradebook/versions.json';
    const githubApiUrl = 'https://api.github.com/repos/MOREnet-Canvas/CustomizedGradebook/releases';

    try {
        logger.debug('[LoaderGeneratorPanel] Fetching versions from manifest:', manifestUrl);

        // Fetch from GitHub Pages manifest (preferred - fast and already exists)
        const response = await fetch(manifestUrl, {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const manifest = await response.json();
        logger.debug('[LoaderGeneratorPanel] Manifest fetched:', manifest);

        // Extract latest version from manifest
        const latestVersion = manifest['v1.0-latest'] || manifest.latest || 'v1.0.6';

        // Fetch all releases from GitHub API to get full list of v1.0.x versions
        logger.debug('[LoaderGeneratorPanel] Fetching releases from GitHub API:', githubApiUrl);
        const releasesResponse = await fetch(githubApiUrl, {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store'
        });

        if (!releasesResponse.ok) {
            throw new Error(`HTTP ${releasesResponse.status}`);
        }

        const releases = await releasesResponse.json();

        // Filter to v1.0.x releases and sort by version (newest first)
        const v10Releases = releases
            .filter(r => r.tag_name && r.tag_name.startsWith('v1.0.'))
            .map(r => r.tag_name)
            .sort((a, b) => {
                // Extract patch numbers (e.g., "v1.0.6" → 6)
                const patchA = parseInt(a.split('.')[2] || '0', 10);
                const patchB = parseInt(b.split('.')[2] || '0', 10);
                return patchB - patchA; // Descending order
            });

        logger.info('[LoaderGeneratorPanel] Found v1.0.x releases:', v10Releases);

        cachedVersionData = {
            latestVersion,
            v10Releases
        };

        return cachedVersionData;
    } catch (err) {
        logger.warn('[LoaderGeneratorPanel] Failed to fetch versions from manifest/API:', err);

        // Fallback to hardcoded versions
        logger.info('[LoaderGeneratorPanel] Using fallback hardcoded versions');
        cachedVersionData = {
            latestVersion: 'v1.0.6',
            v10Releases: ['v1.0.6', 'v1.0.5', 'v1.0.4', 'v1.0.3', 'v1.0.2', 'v1.0.1', 'v1.0.0']
        };

        return cachedVersionData;
    }
}

/**
 * Create version selector dropdown (fetches versions dynamically via async IIFE)
 */
function createVersionSelector() {
    const container = createElement('div', {
        style: {
            marginBottom: '16px',
            padding: '12px',
            border: '1px solid #0374B5',
            borderRadius: '8px',
            background: '#f0f7ff'
        }
    });

    const label = createElement('label', {
        html: '<strong>Customized Gradebook Version:</strong>',
        style: {
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            color: '#2D3B45'
        }
    });

    const dropdown = createElement('select', {
        style: {
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #0374B5',
            borderRadius: '6px',
            fontSize: '13px',
            background: '#fff',
            cursor: 'pointer'
        }
    });

    // Show loading indicator
    const loadingOption = createElement('option', {
        text: 'Loading versions...',
        attrs: { disabled: 'true', selected: 'true' }
    });
    dropdown.appendChild(loadingOption);

    container.appendChild(label);
    container.appendChild(dropdown);

    // Fetch versions asynchronously
    (async () => {
        try {
            const { latestVersion, v10Releases } = await fetchAvailableVersions();

            // Clear loading indicator
            dropdown.innerHTML = '';

            // Build version options array
            const versions = [];

            // Add all v1.0.x releases (newest first)
            v10Releases.forEach((version, index) => {
                const isLatest = version === latestVersion;
                versions.push({
                    value: version,
                    label: isLatest ? `${version} (Latest Production)` : version,
                    channel: 'prod'
                });
            });

            // Add special options
            versions.push(
                { value: 'v1.0-latest', label: 'Auto-Patch v1.0.x (Recommended)', channel: 'auto-patch', track: 'v1.0-latest' },
                { value: 'latest', label: 'Beta - Latest Release (Any Version)', channel: 'beta' },
                { value: 'dev', label: 'Dev - Unstable Builds', channel: 'dev' }
            );

            // Populate dropdown
            versions.forEach(v => {
                const option = createElement('option', {
                    text: v.label,
                    attrs: {
                        value: v.value,
                        'data-channel': v.channel,
                        'data-track': v.track || ''
                    }
                });
                dropdown.appendChild(option);
            });

            logger.debug('[LoaderGeneratorPanel] Version dropdown populated with', versions.length, 'options');
        } catch (err) {
            logger.error('[LoaderGeneratorPanel] Failed to populate version dropdown:', err);

            // Fallback: populate with hardcoded versions
            dropdown.innerHTML = '';
            const fallbackVersions = [
                { value: 'v1.0.6', label: 'v1.0.6 (Latest Production)', channel: 'prod' },
                { value: 'v1.0.5', label: 'v1.0.5', channel: 'prod' },
                { value: 'v1.0.4', label: 'v1.0.4', channel: 'prod' },
                { value: 'v1.0.3', label: 'v1.0.3', channel: 'prod' },
                { value: 'v1.0.2', label: 'v1.0.2', channel: 'prod' },
                { value: 'v1.0.1', label: 'v1.0.1', channel: 'prod' },
                { value: 'v1.0.0', label: 'v1.0.0', channel: 'prod' },
                { value: 'v1.0-latest', label: 'Auto-Patch v1.0.x (Recommended)', channel: 'auto-patch', track: 'v1.0-latest' },
                { value: 'latest', label: 'Beta - Latest Release (Any Version)', channel: 'beta' },
                { value: 'dev', label: 'Dev - Unstable Builds', channel: 'dev' }
            ];

            fallbackVersions.forEach(v => {
                const option = createElement('option', {
                    text: v.label,
                    attrs: {
                        value: v.value,
                        'data-channel': v.channel,
                        'data-track': v.track || ''
                    }
                });
                dropdown.appendChild(option);
            });
        }
    })();

    return { versionSelector: container, versionDropdown: dropdown };
}

/**
 * Generate download filename based on version and current date
 * Format: theme_loader_<version>_<YYYY-MM-DD>.js
 */
function generateDownloadFilename(version) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Sanitize version for filename
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');

    return `theme_loader_${sanitizedVersion}_${dateStr}.js`;
}

/**
 * Create configuration panel with all settings
 */
function createConfigurationPanel() {
    const container = createElement('details', {
        attrs: { open: 'true' },
        style: {
            marginBottom: '16px',
            padding: '16px',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            background: '#f9f9f9'
        }
    });

    const title = createElement('summary', {
        html: '<strong>⚙️ Configuration Settings</strong>',
        style: {
            marginBottom: '12px',
            fontSize: '14px',
            cursor: 'pointer'
        }
    });

    // Feature Flags Section
    const featureSection = createElement('div', {
        style: {
            marginBottom: '12px',
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '6px'
        }
    });
    const featureTitle = createElement('div', {
        html: '<strong>Feature Flags</strong>',
        style: {
            marginBottom: '8px',
            fontSize: '13px',
            color: '#2D3B45',
            paddingLeft: '8px',
            borderLeft: '3px solid #0374B5'
        }
    });

    const enableStudentGrade = createCheckbox('Enable Student Grade Page Customization', 'cfg_enableStudentGrade', true);
    const enableGradeOverride = createCheckbox('Enable Grade Override', 'cfg_enableGradeOverride', true);
    const enforceCourseOverride = createCheckbox('Enforce Course Override Setting', 'cfg_enforceCourseOverride', false);

    featureSection.appendChild(featureTitle);
    featureSection.appendChild(enableStudentGrade.label);
    featureSection.appendChild(enableGradeOverride.label);
    featureSection.appendChild(enforceCourseOverride.label);

    // Excluded Keywords Section
    const keywordsSection = createElement('div', {
        style: {
            marginBottom: '12px',
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '6px'
        }
    });
    const keywordsTitle = createElement('div', {
        html: '<strong>Excluded Outcomes from average calcuation (Keywords, comma separated)</strong>',
        style: {
            marginBottom: '8px',
            fontSize: '13px',
            color: '#2D3B45',
            paddingLeft: '8px',
            borderLeft: '3px solid #0374B5'
        }
    });

    const keywordsInput = createElement('input', {
        attrs: { type: 'text', value: 'Homework Completion', spellcheck: 'false' },
        style: { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }
    });

    keywordsSection.appendChild(keywordsTitle);
    keywordsSection.appendChild(keywordsInput);

    // UI Labels Section
    const labelsSection = createElement('div', {
        style: {
            marginBottom: '12px',
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '6px'
        }
    });
    const labelsTitle = createElement('div', {
        html: '<strong>UI Labels</strong>',
        style: {
            marginBottom: '8px',
            fontSize: '13px',
            color: '#2D3B45',
            paddingLeft: '8px',
            borderLeft: '3px solid #0374B5'
        }
    });

    const updateAvgButtonLabel = createTextInput('Update Button Label', 'Update Current Score');
    const avgOutcomeName = createTextInput('Outcome Name', 'Current Score');
    const avgAssignmentName = createTextInput('Assignment Name', 'Current Score Assignment');
    const avgRubricName = createTextInput('Rubric Name', 'Current Score Rubric');

    const labelsGrid = createElement('div', {
        style: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
        }
    });

    labelsGrid.appendChild(updateAvgButtonLabel.container);
    labelsGrid.appendChild(avgOutcomeName.container);
    labelsGrid.appendChild(avgAssignmentName.container);
    labelsGrid.appendChild(avgRubricName.container);

    labelsSection.appendChild(labelsTitle);
    labelsSection.appendChild(labelsGrid);

    // Outcome Configuration Section
    const outcomeSection = createElement('div', {
        style: {
            marginBottom: '12px',
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '6px'
        }
    });
    const outcomeTitle = createElement('div', {
        html: '<strong>Outcome Configuration</strong>',
        style: {
            marginBottom: '8px',
            fontSize: '13px',
            color: '#2D3B45',
            paddingLeft: '8px',
            borderLeft: '3px solid #0374B5'
        }
    });

    const defaultMaxPoints = createNumberInput('Default Max Points', 4);
    const defaultMasteryThreshold = createNumberInput('Default Mastery Threshold', 3);

    const outcomeGrid = createElement('div', {
        style: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
        }
    });

    outcomeGrid.appendChild(defaultMaxPoints.container);
    outcomeGrid.appendChild(defaultMasteryThreshold.container);

    outcomeSection.appendChild(outcomeTitle);
    outcomeSection.appendChild(outcomeGrid);

    // Rating Scale Section
    const ratingsSection = createElement('div', {
        style: {
            marginBottom: '12px',
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '6px'
        }
    });
    const ratingsTitle = createElement('div', {
        html: '<strong>Rating Scale (JSON)</strong>',
        style: {
            marginBottom: '8px',
            fontSize: '13px',
            color: '#2D3B45',
            paddingLeft: '8px',
            borderLeft: '3px solid #0374B5'
        }
    });

    const defaultRatings = [
        { description: "Exemplary", points: 4 },
        { description: "Beyond Target", points: 3.5 },
        { description: "Target", points: 3 },
        { description: "Approaching Target", points: 2.5 },
        { description: "Developing", points: 2 },
        { description: "Beginning", points: 1.5 },
        { description: "Needs Partial Support", points: 1 },
        { description: "Needs Full Support", points: 0.5 },
        { description: "No Evidence", points: 0 }
    ];

    const ratingsTextarea = createElement('textarea', {
        attrs: { rows: '6', spellcheck: 'false' },
        style: {
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }
    });
    ratingsTextarea.value = JSON.stringify(defaultRatings, null, 2);

    ratingsSection.appendChild(ratingsTitle);
    ratingsSection.appendChild(ratingsTextarea);

    // Assemble container
    container.appendChild(title);
    container.appendChild(featureSection);
    container.appendChild(keywordsSection);
    container.appendChild(labelsSection);
    container.appendChild(outcomeSection);
    container.appendChild(ratingsSection);

    return {
        container,
        controls: {
            enableStudentGrade: enableStudentGrade.checkbox,
            enableGradeOverride: enableGradeOverride.checkbox,
            enforceCourseOverride: enforceCourseOverride.checkbox,
            updateAvgButtonLabel: updateAvgButtonLabel.input,
            avgOutcomeName: avgOutcomeName.input,
            avgAssignmentName: avgAssignmentName.input,
            avgRubricName: avgRubricName.input,
            defaultMaxPoints: defaultMaxPoints.input,
            defaultMasteryThreshold: defaultMasteryThreshold.input,
            ratingsTextarea,
            keywordsInput
        }
    };
}

/**
 * Helper: Create checkbox with label
 */
function createCheckbox(labelText, id, checked) {
    const checkbox = createElement('input', {
        attrs: { type: 'checkbox', checked: checked ? 'true' : undefined, id }
    });
    const label = createElement('label', {
        attrs: { for: id },
        style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginBottom: '6px' }
    });
    label.appendChild(checkbox);
    label.appendChild(createElement('span', { text: labelText }));
    return { checkbox, label };
}

/**
 * Helper: Create text input with label
 */
function createTextInput(labelText, defaultValue) {
    const container = createElement('div', { style: { marginBottom: '8px' } });
    const label = createElement('div', {
        text: labelText + ':',
        style: { fontSize: '12px', marginBottom: '4px', color: '#555' }
    });
    const input = createElement('input', {
        attrs: { type: 'text', value: defaultValue, spellcheck: 'false' },
        style: { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }
    });
    container.appendChild(label);
    container.appendChild(input);
    return { container, input };
}

/**
 * Helper: Create number input with label
 */
function createNumberInput(labelText, defaultValue) {
    const container = createElement('div', { style: { marginBottom: '8px' } });
    const label = createElement('div', {
        text: labelText + ':',
        style: { fontSize: '12px', marginBottom: '4px', color: '#555' }
    });
    const input = createElement('input', {
        attrs: { type: 'number', value: defaultValue.toString(), min: '0', step: '0.5' },
        style: { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }
    });
    container.appendChild(label);
    container.appendChild(input);
    return { container, input };
}

/**
 * Create other theme scripts textarea with lock controls (A = Other Theme Scripts - Preserved)
 */
function createOtherScriptsTextarea(installedUrl) {
    const baseLabel = createElement('div', {
        html: '<strong>A</strong> = Other Theme Scripts (Preserved):',
        style: { fontWeight: '700', marginTop: '6px' }
    });

    const helperText = createElement('div', {
        html: `
            <div style="font-size:12px; color:#666; margin-top:4px; margin-bottom:6px; padding:8px; background:#f0f7ff; border-left:3px solid #0374B5; border-radius:4px;">
                This textarea holds all theme JavaScript <strong>not related to Customized Gradebook</strong>.
                It will be copied <strong>exactly as-is</strong> and is never rewritten by this tool.
                It is locked by default when auto-loaded (and can be unlocked for manual edits).
            </div>
        `
    });

    const baseTA = createElement('textarea', {
        attrs: { rows: '12', spellcheck: 'false' },
        style: {
            width: '100%',
            marginTop: '6px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            background: '#fafafa'
        }
    });

    const lockRow = createElement('div', {
        style: {
            display: 'flex',
            gap: '10px',
            marginTop: '10px',
            flexWrap: 'wrap',
            alignItems: 'center'
        }
    });

    const unlockBtn = createElement('button', {
        text: 'Unlock to edit',
        className: 'Button Button--small',
        attrs: { disabled: 'true' }
    });

    const relockBtn = createElement('button', {
        text: 'Re-lock',
        className: 'Button Button--small',
        attrs: { disabled: 'true' }
    });

    const reloadBtn = createElement('button', {
        text: 'Reload from installed Theme JS URL',
        className: 'Button Button--small',
        attrs: installedUrl ? {} : { disabled: 'true' }
    });

    lockRow.appendChild(unlockBtn);
    lockRow.appendChild(relockBtn);
    lockRow.appendChild(reloadBtn);

    return { baseLabel, baseTA, helperText, lockRow, unlockBtn, relockBtn, reloadBtn };
}

/**
 * Create Managed Config Block textarea (B = Read-only preview of generated config)
 */
function createConfigTextarea() {
    const configLabel = createElement('div', {
        html: '<strong>B</strong> = Managed Config Block (Read-Only Preview):',
        style: { fontWeight: '700', marginTop: '16px' }
    });

    const configTA = createElement('textarea', {
        attrs: { rows: '8', spellcheck: 'false', readonly: 'true' },
        style: {
            width: '100%',
            marginTop: '6px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            background: '#f5f5f5',
            color: '#666'
        }
    });

    return { configLabel, configTA };
}

/**
 * Create CG Loader Template textarea (C = Read-only template from codebase, collapsible)
 */
function createTemplateTextarea() {
    // Container for collapsible section
    const templateCollapsible = createElement('div', {
        style: { marginTop: '16px' }
    });

    // Header with toggle button
    const templateLabel = createElement('div', {
        style: {
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '8px',
            background: '#f9f9f9',
            borderRadius: '6px',
            border: '1px solid #ddd'
        }
    });

    const labelText = createElement('span', {
        html: '<strong>C</strong> = CG Loader Template (Read-Only, from codebase)'
    });

    const toggleBtn = createElement('button', {
        text: 'Expand ▼',
        style: {
            padding: '4px 12px',
            fontSize: '12px',
            background: '#0374B5',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }
    });

    templateLabel.appendChild(labelText);
    templateLabel.appendChild(toggleBtn);

    // Textarea (initially hidden)
    const templateTA = createElement('textarea', {
        attrs: { rows: '10', spellcheck: 'false', readonly: 'true' },
        style: {
            width: '100%',
            marginTop: '6px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            background: '#f5f5f5',
            color: '#666',
            display: 'none'
        }
    });

    // Populate with template from codebase
    templateTA.value = CG_LOADER_TEMPLATE;

    // Toggle functionality
    let isExpanded = false;
    const toggle = () => {
        isExpanded = !isExpanded;
        templateTA.style.display = isExpanded ? 'block' : 'none';
        toggleBtn.textContent = isExpanded ? 'Collapse ▲' : 'Expand ▼';
    };

    templateLabel.addEventListener('click', toggle);

    templateCollapsible.appendChild(templateLabel);
    templateCollapsible.appendChild(templateTA);

    return { templateLabel, templateTA, templateCollapsible };
}

/**
 * Create sticky action buttons panel (right side)
 */
function createStickyActionPanel() {
    // Add CSS animation keyframes for button activation
    if (!document.getElementById('cg-button-animations')) {
        const style = document.createElement('style');
        style.id = 'cg-button-animations';
        style.textContent = `
            @keyframes cg-pulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 2px 8px rgba(3, 116, 181, 0.3);
                }
                50% {
                    transform: scale(1.03);
                    box-shadow: 0 4px 16px rgba(3, 116, 181, 0.5);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Sticky container
    const stickyPanel = createElement('div', {
        style: {
            position: 'fixed',
            right: '20px',
            top: '100px',
            width: '220px',
            padding: '16px',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: '1000'
        }
    });

    // Change notification (initially hidden)
    const changeNotification = createElement('div', {
        style: {
            padding: '10px',
            background: '#fff7e6',
            border: '1px solid #f3d19e',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            display: 'none'
        }
    });

    const notificationContent = createElement('div', {
        style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start'
        }
    });

    const notificationText = createElement('div', {
        text: '⚠️ Settings changed. Generate and upload new loader to Canvas to apply changes.',
        style: { flex: '1' }
    });

    const dismissBtn = createElement('button', {
        text: '×',
        attrs: { title: 'Dismiss' },
        style: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 0 0 8px',
            color: '#666'
        }
    });

    dismissBtn.addEventListener('click', () => {
        changeNotification.style.display = 'none';
    });

    notificationContent.appendChild(notificationText);
    notificationContent.appendChild(dismissBtn);
    changeNotification.appendChild(notificationContent);

    // Buttons container
    const buttonsContainer = createElement('div', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        }
    });

    const genBtn = createElement('button', {
        text: 'Generate Loader File',
        className: 'Button Button--primary',
        style: {
            width: '100%',
            justifyContent: 'center'
        }
    });

    const dlBtn = createElement('button', {
        text: '⬇️ Download Loader File',
        className: 'Button',
        attrs: { disabled: 'true' },
        style: {
            width: '100%',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            position: 'relative'
        }
    });

    const copyBtn = createElement('button', {
        text: '📋 Copy Loader Code',
        className: 'Button',
        attrs: { disabled: 'true' },
        style: {
            width: '100%',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            position: 'relative'
        }
    });

    buttonsContainer.appendChild(genBtn);
    buttonsContainer.appendChild(dlBtn);
    buttonsContainer.appendChild(copyBtn);

    // Static informational message
    const revertInfoMessage = createElement('div', {
        text: 'To revert to current Canvas settings, refresh this page.',
        style: {
            fontSize: '12px',
            color: '#666',
            marginTop: '12px',
            textAlign: 'center',
            lineHeight: '1.4'
        }
    });

    buttonsContainer.appendChild(revertInfoMessage);

    stickyPanel.appendChild(changeNotification);
    stickyPanel.appendChild(buttonsContainer);

    // Append to body (not to panel, so it stays fixed)
    document.body.appendChild(stickyPanel);

    return { stickyPanel, changeNotification, genBtn, dlBtn, copyBtn };
}

/**
 * Create action buttons (legacy - for inline display, now replaced by sticky panel)
 */
function createActionButtons() {
    const actions = createElement('div', {
        style: {
            display: 'flex',
            gap: '10px',
            marginTop: '12px',
            flexWrap: 'wrap'
        }
    });

    const genBtn = createElement('button', {
        text: 'Generate Combined Loader',
        className: 'Button Button--primary'
    });

    const dlBtn = createElement('button', {
        text: 'Download Combined Loader',
        className: 'Button',
        attrs: { disabled: 'true' }
    });

    const copyBtn = createElement('button', {
        text: 'Copy Output',
        className: 'Button',
        attrs: { disabled: 'true' }
    });

    actions.appendChild(genBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(copyBtn);

    return { actions, genBtn, dlBtn, copyBtn };
}

/**
 * Create output textarea (A+B+C combined)
 */
function createOutputTextarea() {
    const outLabel = createElement('div', {
        html: '<strong>A+B+C</strong> Combined Output (copy/upload this to Canvas Theme Editor):',
        style: { fontWeight: '700', marginTop: '14px' }
    });

    const outTA = createElement('textarea', {
        attrs: { rows: '14', spellcheck: 'false', readonly: 'true' },
        style: {
            width: '100%',
            marginTop: '6px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px',
            background: '#fafafa',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        }
    });

    const hint = createElement('div', {
        html: `
            <div style="margin-top:10px; color:#666; font-size:13px;">
                <strong>Structure:</strong> A (other theme scripts - preserved) + B (managed config) + C (CG template from codebase)<br>
                Each section is wrapped with markers: <code>/* ========== BEGIN SECTION X: ... ========== */</code> … <code>/* ========== END SECTION X: ... ========== */</code>
            </div>
        `
    });

    return { outLabel, outTA, hint };
}

/**
 * Set loader text and lock state
 */
function setLoaderText(textarea, text, locked, unlockBtn, relockBtn) {
    textarea.value = text || '';
    setLocked(textarea, locked, unlockBtn, relockBtn);
}

/**
 * Set textarea lock state
 */
function setLocked(textarea, locked, unlockBtn, relockBtn) {
    if (locked) {
        textarea.setAttribute('readonly', 'true');
        textarea.style.background = '#fafafa';
        unlockBtn.removeAttribute('disabled');
        relockBtn.setAttribute('disabled', 'true');
    } else {
        textarea.removeAttribute('readonly');
        textarea.style.background = '#fff';
        unlockBtn.setAttribute('disabled', 'true');
        relockBtn.removeAttribute('disabled');
    }
}

/**
 * Generate combined loader (A+B+C)
 *
 * A = Other Theme Scripts (preserved exactly as-is from textarea)
 * B = CG_LOADER_TEMPLATE (from codebase)
 * C = Managed config block (generated fresh from UI state)
 */
function generateCombinedLoader(baseTA, controls, configTA, outTA, dlBtn, copyBtn, versionDropdown) {
    const baseText = baseTA.value || '';

    if (!baseText.trim()) {
        alert('No other theme scripts found. Paste the current Theme JavaScript first, or use Reload if available.');
        return;
    }

    // Parse ratings JSON
    let outcomeAndRubricRatings;
    try {
        outcomeAndRubricRatings = JSON.parse(controls.ratingsTextarea.value);
        if (!Array.isArray(outcomeAndRubricRatings)) {
            throw new Error('Ratings must be an array');
        }
    } catch (err) {
        alert('Invalid JSON in Rating Scale field. Please fix the JSON syntax.\n\nError: ' + err.message);
        return;
    }

    // Parse excluded keywords (comma-separated)
    const excludedOutcomeKeywords = controls.keywordsInput.value
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

    // Get version and channel from dropdown
    const selectedVersion = versionDropdown.value;
    const selectedOption = versionDropdown.options[versionDropdown.selectedIndex];
    const selectedChannel = selectedOption.getAttribute('data-channel') || 'prod';
    const selectedTrack = selectedOption.getAttribute('data-track') || null;

    // For auto-patch channel, extract fallback version from track (e.g., "v1.0-latest" → "v1.0.6")
    let fallbackVersion = selectedVersion;
    if (selectedChannel === 'auto-patch' && selectedTrack) {
        // Use the dynamically determined latest production version as fallback
        // If version data is cached, use it; otherwise fall back to v1.0.6
        fallbackVersion = cachedVersionData?.latestVersion || 'v1.0.6';
    }

    // Generate managed config block (C) with all configuration options
    const cgBlock = buildCGManagedBlock({
        accountId: getAccountId(),
        channel: selectedChannel,
        version: fallbackVersion,
        versionTrack: selectedTrack,
        source: 'github_release',
        enableStudentGradeCustomization: !!controls.enableStudentGrade.checked,
        enableGradeOverride: !!controls.enableGradeOverride.checked,
        enforceCourseOverride: !!controls.enforceCourseOverride.checked,
        updateAvgButtonLabel: controls.updateAvgButtonLabel.value,
        avgOutcomeName: controls.avgOutcomeName.value,
        avgAssignmentName: controls.avgAssignmentName.value,
        avgRubricName: controls.avgRubricName.value,
        defaultMaxPoints: parseFloat(controls.defaultMaxPoints.value) || 4,
        defaultMasteryThreshold: parseFloat(controls.defaultMasteryThreshold.value) || 3,
        outcomeAndRubricRatings,
        excludedOutcomeKeywords
    });

    // Update config preview textarea (C)
    configTA.value = cgBlock;

    // Assemble A+B+C
    const combined = upsertCGBlockIntoLoader({ baseLoaderText: baseText, cgBlock });

    // Validate output
    const validation = validateLoaderOutput(combined);

    if (!validation.valid) {
        const errorMsg = 'Generated loader failed validation:\n\n' + validation.errors.join('\n');
        alert(errorMsg);
        logger.error('[LoaderGeneratorPanel] Validation failed', validation.errors);
        return;
    }

    outTA.value = combined;

    // Enable buttons and add "activated" visual styling
    dlBtn.removeAttribute('disabled');
    copyBtn.removeAttribute('disabled');

    // Add prominent "ready to use" styling
    dlBtn.style.background = 'linear-gradient(135deg, #0374B5 0%, #0056b3 100%)';
    dlBtn.style.color = '#fff';
    dlBtn.style.fontWeight = '600';
    dlBtn.style.boxShadow = '0 2px 8px rgba(3, 116, 181, 0.3)';
    dlBtn.style.border = '1px solid #0056b3';

    copyBtn.style.background = 'linear-gradient(135deg, #0374B5 0%, #0056b3 100%)';
    copyBtn.style.color = '#fff';
    copyBtn.style.fontWeight = '600';
    copyBtn.style.boxShadow = '0 2px 8px rgba(3, 116, 181, 0.3)';
    copyBtn.style.border = '1px solid #0056b3';

    // Add subtle pulse animation on first activation
    dlBtn.style.animation = 'cg-pulse 1.5s ease-in-out 2';
    copyBtn.style.animation = 'cg-pulse 1.5s ease-in-out 2';

    // Add hover effect enhancement
    const addHoverEffect = (btn) => {
        btn.addEventListener('mouseenter', () => {
            if (!btn.hasAttribute('disabled')) {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(3, 116, 181, 0.4)';
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (!btn.hasAttribute('disabled')) {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 2px 8px rgba(3, 116, 181, 0.3)';
            }
        });
    };

    addHoverEffect(dlBtn);
    addHoverEffect(copyBtn);

    logger.info('[LoaderGeneratorPanel] A+B+C loader generated successfully');
}