// src/admin/loaderGeneratorPanel.js
/**
 * Loader Generator Panel Module
 * 
 * Renders the loader generator panel with:
 * - Auto-load current Theme JS (district loader)
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
 * Render loader generator panel
 * 
 * @param {HTMLElement} root - Root container element
 */
export function renderLoaderGeneratorPanel(root) {
    logger.debug('[LoaderGeneratorPanel] Rendering loader generator panel');

    const panel = createPanel(root, 'Generate Combined Loader (A+B+C Model)');
    const installedUrl = getInstalledThemeJsUrl();

    // Top note - explain A/B/C model
    const topNote = createElement('div', {
        html: `
            <div style="color:#444; margin-bottom:10px;">
                This tool generates a combined loader using the <strong>A+B+C model</strong>:
                <ul style="margin:8px 0; padding-left:20px; font-size:13px;">
                    <li><strong>A</strong> = External loader (district's Theme JS from textarea below)</li>
                    <li><strong>B</strong> = CG loader template (stable logic from codebase)</li>
                    <li><strong>C</strong> = Managed config block (generated fresh from your settings)</li>
                </ul>
            </div>
        `
    });

    // Installed URL display
    const installedLine = createElement('div', {
        html: `
            <div style="font-size:13px; color:#666; margin-bottom:10px;">
                Detected installed Theme JS URL:
                <div style="margin-top:4px; word-break:break-all;"><code>${escapeHtml(installedUrl || '(none)')}</code></div>
            </div>
        `
    });

    // Load status display
    const loadStatus = createElement('div', {
        style: { marginBottom: '10px' }
    });

    // Settings row (checkbox + label input)
    const { settingsRow, enableDashboard, labelInput } = createSettingsRow();

    // Textarea A: External Loader (editable)
    const { baseLabel, baseTA, lockRow, unlockBtn, relockBtn, reloadBtn } = createBaseLoaderTextarea(installedUrl);

    // Textarea B: CG Loader Template (read-only)
    const { templateLabel, templateTA } = createTemplateTextarea();

    // Textarea C: Managed Config Preview (read-only)
    const { configLabel, configTA } = createConfigTextarea();

    // Actions (generate, download, copy)
    const { actions, genBtn, dlBtn, copyBtn } = createActionButtons();

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

            // Populate textareas
            setLoaderText(baseTA, A || text, true, unlockBtn, relockBtn);
            templateTA.value = B || CG_LOADER_TEMPLATE;
            configTA.value = C;
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
        generateCombinedLoader(baseTA, enableDashboard, labelInput, configTA, outTA, dlBtn, copyBtn);
    });

    dlBtn.addEventListener('click', () => {
        if (!outTA.value.trim()) return;
        downloadText('loader.js', outTA.value);
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

    // Append all elements
    panel.appendChild(topNote);
    panel.appendChild(installedLine);
    panel.appendChild(loadStatus);
    panel.appendChild(settingsRow);
    panel.appendChild(baseLabel);
    panel.appendChild(baseTA);
    panel.appendChild(lockRow);
    panel.appendChild(templateLabel);
    panel.appendChild(templateTA);
    panel.appendChild(configLabel);
    panel.appendChild(configTA);
    panel.appendChild(actions);
    panel.appendChild(outLabel);
    panel.appendChild(outTA);
    panel.appendChild(hint);

    // Auto-load on first render
    tryAutoLoad('auto');
}

/**
 * Create settings row (checkbox + label input)
 */
function createSettingsRow() {
    const settingsRow = createElement('div', {
        style: {
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '10px'
        }
    });

    const enableDashboard = createElement('input', {
        attrs: { type: 'checkbox', checked: 'true' }
    });

    const enableLabel = createElement('label', {
        style: {
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: '13px'
        }
    });
    enableLabel.appendChild(enableDashboard);
    enableLabel.appendChild(createElement('span', { text: 'Enable Admin Dashboard module' }));

    const labelInput = createElement('input', {
        attrs: {
            type: 'text',
            value: 'Open CG Admin Dashboard',
            spellcheck: 'false'
        },
        style: {
            flex: '1',
            minWidth: '320px',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '13px'
        }
    });

    settingsRow.appendChild(enableLabel);
    settingsRow.appendChild(createElement('div', {
        text: 'Button label:',
        style: { fontWeight: '600', fontSize: '13px' }
    }));
    settingsRow.appendChild(labelInput);

    return { settingsRow, enableDashboard, labelInput };
}

/**
 * Create base loader textarea with lock controls (A = External Loader)
 */
function createBaseLoaderTextarea(installedUrl) {
    const baseLabel = createElement('div', {
        html: '<strong>A</strong> = External Loader (District\'s Theme JavaScript):',
        style: { fontWeight: '700', marginTop: '6px' }
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

    return { baseLabel, baseTA, lockRow, unlockBtn, relockBtn, reloadBtn };
}

/**
 * Create CG Loader Template textarea (B = Read-only template from codebase)
 */
function createTemplateTextarea() {
    const templateLabel = createElement('div', {
        html: '<strong>B</strong> = CG Loader Template (Read-Only, from codebase):',
        style: { fontWeight: '700', marginTop: '16px' }
    });

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
            color: '#666'
        }
    });

    // Populate with template from codebase
    templateTA.value = CG_LOADER_TEMPLATE;

    return { templateLabel, templateTA };
}

/**
 * Create Managed Config Block textarea (C = Read-only preview of generated config)
 */
function createConfigTextarea() {
    const configLabel = createElement('div', {
        html: '<strong>C</strong> = Managed Config Block (Read-Only Preview):',
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
 * Create action buttons (generate, download, copy)
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
        text: 'Download loader.js',
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
                <strong>Structure:</strong> A (external loader) + B (CG template from codebase) + C (managed config)<br>
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
 * A = External loader (district's Theme JS from textarea)
 * B = CG_LOADER_TEMPLATE (from codebase)
 * C = Managed config block (generated fresh from UI state)
 */
function generateCombinedLoader(baseTA, enableDashboard, labelInput, configTA, outTA, dlBtn, copyBtn) {
    const baseText = baseTA.value || '';

    if (!baseText.trim()) {
        alert('No loader text found. Paste the current Theme JavaScript (district loader) first, or use Reload if available.');
        return;
    }

    // Generate managed config block (C) with release info
    const cgBlock = buildCGManagedBlock({
        accountId: getAccountId(),
        enableDashboard: !!enableDashboard.checked,
        dashboardLabel: labelInput.value || 'Open CG Admin Dashboard',
        channel: 'prod',
        version: 'v1.0.3',
        source: 'github_release'
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

    dlBtn.removeAttribute('disabled');
    copyBtn.removeAttribute('disabled');

    logger.info('[LoaderGeneratorPanel] A+B+C loader generated successfully');
}