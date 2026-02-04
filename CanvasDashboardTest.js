/* =====================================================
   BEGIN CG MANAGED CODE (TEST – Virtual Admin Page v5)
   Adds:
   - Auto-load current Theme JS (district loader) from ENV.active_brand_config.js_overrides
   - Locked textarea by default when auto-loaded (Unlock to edit)
   - End-of-file CG block insertion (append/replace) + download/copy output
   Safe: read-only operations only, no writes to Canvas
   ===================================================== */
(function () {
  const CG_FLAG = 'cg_admin_dashboard';

  const DEFAULT_EXPECTED_JS_URL =
      'https://instructure-uploads.s3.amazonaws.com/account_273830000000000001/attachments/21354/CanvasDashboardTest.js';

  const CG_BEGIN = '/* BEGIN CG MANAGED CODE */';
  const CG_END = '/* END CG MANAGED CODE */';

  /* ---------- helpers ---------- */
  function isThemeEditor() {
    return /^\/accounts\/\d+\/theme_editor/.test(window.location.pathname);
  }

  function isCGAdminPage() {
    return new URLSearchParams(window.location.search).has(CG_FLAG);
  }

  function getAccountId() {
    return window.ENV?.ACCOUNT_ID || null;
  }

  function getInstalledThemeJsUrl() {
    return normalizeUrl(window.ENV?.active_brand_config?.js_overrides);
  }

  function normalizeUrl(u) {
    if (u == null) return '';
    return String(u).trim();
  }

  function escapeHtml(s) {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
  }

  function el(tag, props = {}) {
    const node = document.createElement(tag);
    if (props.className) node.className = props.className;
    if (props.text != null) node.textContent = props.text;
    if (props.html != null) node.innerHTML = props.html;
    if (props.style && typeof props.style === 'object') Object.assign(node.style, props.style);
    if (props.attrs && typeof props.attrs === 'object') {
      for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
    }
    if (props.on && typeof props.on === 'object') {
      for (const [evt, fn] of Object.entries(props.on)) node.addEventListener(evt, fn);
    }
    return node;
  }

  function addPanel(root, titleText) {
    const panel = el('div', {
      style: {
        marginTop: '16px',
        padding: '16px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        background: '#fff'
      }
    });
    panel.appendChild(el('div', { text: titleText, style: { fontWeight: '700', marginBottom: '10px' } }));
    root.appendChild(panel);
    return panel;
  }

  function addPre(panel, obj) {
    const pre = el('pre', {
      style: {
        margin: '0',
        padding: '12px',
        background: '#f8f9fa',
        border: '1px solid #eee',
        borderRadius: '8px',
        fontSize: '13px',
        overflow: 'auto'
      }
    });
    pre.textContent = JSON.stringify(obj, null, 2);
    panel.appendChild(pre);
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function fetchTextWithTimeout(url, ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'omit', // S3/public asset: do not send Canvas cookies
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  /* ---------- CG managed block generator (CONFIG ONLY) ---------- */
  function buildCGManagedBlock({ accountId, enableDashboard, dashboardLabel }) {
    return [
      CG_BEGIN,
      `/* Generated: ${new Date().toISOString()} */`,
      `/* Account: ${accountId ?? 'unknown'} */`,
      '/* Purpose: Configure CG features without altering district loader behavior */',
      '',
      'window.CG_CONFIG = window.CG_CONFIG || {};',
      'window.CG_CONFIG.features = window.CG_CONFIG.features || {};',
      `window.CG_CONFIG.features.adminDashboard = ${enableDashboard ? 'true' : 'false'};`,
      `window.CG_CONFIG.features.adminDashboardLabel = ${JSON.stringify(dashboardLabel || 'Open CG Admin Dashboard')};`,
      '',
      'window.__CG_ADMIN_DASHBOARD_ENABLED__ = ' + (enableDashboard ? 'true' : 'false') + ';',
      '',
      CG_END
    ].join('\n');
  }

  function upsertCGBlockIntoLoader({ baseLoaderText, cgBlock }) {
    const beginIdx = baseLoaderText.indexOf(CG_BEGIN);
    const endIdx = baseLoaderText.indexOf(CG_END);

    // Replace existing CG block
    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
      const before = baseLoaderText.slice(0, beginIdx).trimEnd();
      const after = baseLoaderText.slice(endIdx + CG_END.length).trimStart();
      return `${before}\n\n${cgBlock}\n\n${after}\n`;
    }

    // Append at end
    const trimmed = baseLoaderText.trimEnd();
    return `${trimmed}\n\n${cgBlock}\n`;
  }

  /* ---------- virtual admin page ---------- */
  function renderCGAdminPage() {
    document.documentElement.innerHTML = '';

    const root = el('div', { attrs: { id: 'cg-admin-root' } });
    root.style.cssText = `
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 32px;
      max-width: 1100px;
      margin: 0 auto;
      background: #fff;
    `;

    root.appendChild(el('h1', { text: 'Customized Gradebook – Admin Dashboard (Test)' }));
    root.appendChild(
        el('p', {
          html: `Account ID: <strong>${getAccountId() ?? 'unknown'}</strong>`,
          style: { color: '#666', marginTop: '6px' }
        })
    );

    root.appendChild(
        el('div', {
          html: `✅ Virtual admin page rendered via Theme JS<br>Same origin • Same session • CSRF intact`,
          style: {
            marginTop: '16px',
            padding: '16px',
            border: '2px solid #2d8',
            borderRadius: '10px',
            background: 'rgba(34,221,136,.08)'
          }
        })
    );

    document.body.appendChild(root);

    renderThemeStatusPanels(root);
    renderLoaderGeneratorPanel(root);
  }

  function renderThemeStatusPanels(root) {
    const envBrand = window.ENV?.active_brand_config || null;
    const installedJs = normalizeUrl(envBrand?.js_overrides);
    const installedCss = normalizeUrl(envBrand?.css_overrides);

    const p1 = addPanel(root, 'Installed Theme Overrides (ENV.active_brand_config)');
    addPre(p1, {
      js_overrides: installedJs || null,
      css_overrides: installedCss || null,
      brand_md5: envBrand?.md5 ?? null,
      brand_created_at: envBrand?.created_at ?? null
    });

    const p2 = addPanel(root, 'CG Script Check');
    const expectedInput = el('input', {
      attrs: { type: 'text', value: DEFAULT_EXPECTED_JS_URL, spellcheck: 'false' },
      style: {
        width: '100%',
        padding: '8px 10px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        fontSize: '13px'
      }
    });

    const status = el('div', { style: { marginTop: '10px' } });

    function renderStatus() {
      const expected = normalizeUrl(expectedInput.value);
      const matches = expected && installedJs && expected === installedJs;

      status.innerHTML = '';
      if (!installedJs) {
        status.appendChild(
            el('div', {
              text: '⚠️ No JavaScript override is currently installed on this account.',
              style: { padding: '10px', borderRadius: '8px', border: '1px solid #f3d19e', background: '#fff7e6' }
            })
        );
        return;
      }
      if (!expected) {
        status.appendChild(el('div', { text: 'Enter an Expected CG JS URL to compare.', style: { color: '#666' } }));
        return;
      }
      if (matches) {
        status.appendChild(
            el('div', {
              text: '✅ Installed JS matches Expected CG JS URL.',
              style: { padding: '10px', borderRadius: '8px', border: '1px solid #b7eb8f', background: '#f6ffed' }
            })
        );
      } else {
        status.appendChild(
            el('div', {
              html: `🚨 <strong>Script has changed</strong><br>Installed JS does not match the expected CG script URL.`,
              style: { padding: '10px', borderRadius: '8px', border: '1px solid #ffa39e', background: '#fff1f0' }
            })
        );
        status.appendChild(
            el('div', {
              html:
                  `<div style="margin-top:10px; font-size:13px; color:#333;">
                 <div><strong>Installed:</strong> ${escapeHtml(installedJs)}</div>
                 <div style="margin-top:6px;"><strong>Expected:</strong> ${escapeHtml(expected)}</div>
               </div>`
            })
        );
      }
    }

    expectedInput.addEventListener('input', renderStatus);

    p2.appendChild(el('div', { text: 'Expected CG JS URL:', style: { fontWeight: '600', marginBottom: '6px' } }));
    p2.appendChild(expectedInput);
    p2.appendChild(status);
    renderStatus();
  }

  function renderLoaderGeneratorPanel(root) {
    const panel = addPanel(root, 'Generate Combined Loader (District loader + CG block)');

    const installedUrl = getInstalledThemeJsUrl();

    const topNote = el('div', {
      html:
          `<div style="color:#444; margin-bottom:10px;">
           This tool preserves the existing Theme JavaScript (district loader) and inserts/updates a CG-managed block at the <strong>end</strong> of the file.
         </div>`
    });

    const installedLine = el('div', {
      html:
          `<div style="font-size:13px; color:#666; margin-bottom:10px;">
           Detected installed Theme JS URL:
           <div style="margin-top:4px; word-break:break-all;"><code>${escapeHtml(installedUrl || '(none)')}</code></div>
         </div>`
    });

    const loadStatus = el('div', { style: { marginBottom: '10px' } });

    const settingsRow = el('div', {
      style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }
    });

    const enableDashboard = el('input', { attrs: { type: 'checkbox', checked: 'true' } });
    const enableLabel = el('label', {
      style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }
    });
    enableLabel.appendChild(enableDashboard);
    enableLabel.appendChild(el('span', { text: 'Enable Admin Dashboard module' }));

    const labelInput = el('input', {
      attrs: { type: 'text', value: 'Open CG Admin Dashboard', spellcheck: 'false' },
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
    settingsRow.appendChild(el('div', { text: 'Button label:', style: { fontWeight: '600', fontSize: '13px' } }));
    settingsRow.appendChild(labelInput);

    const baseLabel = el('div', { text: 'Current Theme JavaScript (district loader):', style: { fontWeight: '700', marginTop: '6px' } });

    const baseTA = el('textarea', {
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

    const lockRow = el('div', { style: { display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' } });
    const unlockBtn = el('button', { text: 'Unlock to edit', className: 'Button Button--small', attrs: { disabled: 'true' } });
    const relockBtn = el('button', { text: 'Re-lock', className: 'Button Button--small', attrs: { disabled: 'true' } });
    const reloadBtn = el('button', { text: 'Reload from installed Theme JS URL', className: 'Button Button--small', attrs: { disabled: installedUrl ? null : 'true' } });

    lockRow.appendChild(unlockBtn);
    lockRow.appendChild(relockBtn);
    lockRow.appendChild(reloadBtn);

    const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' } });

    const genBtn = el('button', { text: 'Generate Combined Loader', className: 'Button Button--primary' });
    const dlBtn = el('button', { text: 'Download loader.js', className: 'Button', attrs: { disabled: 'true' } });
    const copyBtn = el('button', { text: 'Copy Output', className: 'Button', attrs: { disabled: 'true' } });

    actions.appendChild(genBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(copyBtn);

    const outLabel = el('div', { text: 'Combined Output (copy/upload this):', style: { fontWeight: '700', marginTop: '14px' } });
    const outTA = el('textarea', {
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

    const hint = el('div', {
      html:
          `<div style="margin-top:10px; color:#666; font-size:13px;">
           The CG-managed block is bracketed with:<br>
           <code>${escapeHtml(CG_BEGIN)}</code> … <code>${escapeHtml(CG_END)}</code>
         </div>`
    });

    function setLoaderText(text, { locked }) {
      baseTA.value = text || '';
      if (locked) {
        baseTA.setAttribute('readonly', 'true');
        baseTA.style.background = '#fafafa';
        unlockBtn.removeAttribute('disabled');
        relockBtn.setAttribute('disabled', 'true');
      } else {
        baseTA.removeAttribute('readonly');
        baseTA.style.background = '#fff';
        unlockBtn.setAttribute('disabled', 'true');
        relockBtn.setAttribute('disabled', 'true');
      }
    }

    function setLocked(locked) {
      if (locked) {
        baseTA.setAttribute('readonly', 'true');
        baseTA.style.background = '#fafafa';
        unlockBtn.removeAttribute('disabled');
        relockBtn.setAttribute('disabled', 'true');
      } else {
        baseTA.removeAttribute('readonly');
        baseTA.style.background = '#fff';
        unlockBtn.setAttribute('disabled', 'true');
        relockBtn.removeAttribute('disabled');
      }
    }

    async function tryAutoLoad({ reason }) {
      loadStatus.innerHTML = '';
      if (!installedUrl) {
        loadStatus.appendChild(
            el('div', {
              text: '⚠️ No installed Theme JS URL detected. Paste the loader manually.',
              style: { padding: '10px', borderRadius: '8px', border: '1px solid #f3d19e', background: '#fff7e6' }
            })
        );
        setLoaderText('', { locked: false });
        return;
      }

      loadStatus.appendChild(
          el('div', {
            html: `⏳ Loading current Theme JavaScript from installed URL… <span style="color:#666">(${escapeHtml(reason || 'auto')})</span>`,
            style: { padding: '10px', borderRadius: '8px', border: '1px solid #d9d9d9', background: '#fafafa' }
          })
      );

      try {
        // Try twice: 1s then 3s timeout
        let text;
        try {
          text = await fetchTextWithTimeout(installedUrl, 1000);
        } catch {
          text = await fetchTextWithTimeout(installedUrl, 3000);
        }

        // Success: lock by default
        loadStatus.innerHTML = '';
        loadStatus.appendChild(
            el('div', {
              html:
                  `✅ Loaded current Theme JavaScript automatically.<br>` +
                  `<span style="color:#666; font-size:13px;">Textarea is locked to prevent accidental edits. Click “Unlock to edit” if needed.</span>`,
              style: { padding: '10px', borderRadius: '8px', border: '1px solid #b7eb8f', background: '#f6ffed' }
            })
        );

        setLoaderText(text, { locked: true });
        relockBtn.setAttribute('disabled', 'true'); // already locked
      } catch (err) {
        console.warn('[CG] Auto-load failed', err);

        loadStatus.innerHTML = '';
        loadStatus.appendChild(
            el('div', {
              html:
                  `⚠️ Could not auto-load the current Theme JavaScript (likely CORS).<br>` +
                  `<span style="color:#666; font-size:13px;">Please copy/paste the loader contents manually from the Theme Editor.</span>`,
              style: { padding: '10px', borderRadius: '8px', border: '1px solid #f3d19e', background: '#fff7e6' }
            })
        );

        setLoaderText('', { locked: false });
      }
    }

    unlockBtn.addEventListener('click', () => setLocked(false));
    relockBtn.addEventListener('click', () => setLocked(true));
    reloadBtn.addEventListener('click', () => tryAutoLoad({ reason: 'manual reload' }));

    // Keep relock availability in sync while unlocked
    baseTA.addEventListener('input', () => {
      // If user is editing (unlocked), allow relock
      const isReadonly = baseTA.hasAttribute('readonly');
      if (!isReadonly) {
        relockBtn.removeAttribute('disabled');
      }
    });

    genBtn.addEventListener('click', () => {
      const baseText = baseTA.value || '';
      if (!baseText.trim()) {
        alert('No loader text found. Paste the current Theme JavaScript (district loader) first, or use Reload if available.');
        return;
      }

      const cgBlock = buildCGManagedBlock({
        accountId: getAccountId(),
        enableDashboard: !!enableDashboard.checked,
        dashboardLabel: labelInput.value || 'Open CG Admin Dashboard'
      });

      const combined = upsertCGBlockIntoLoader({ baseLoaderText: baseText, cgBlock });
      outTA.value = combined;

      dlBtn.removeAttribute('disabled');
      copyBtn.removeAttribute('disabled');
    });

    dlBtn.addEventListener('click', () => {
      if (!outTA.value.trim()) return;
      downloadText('loader.js', outTA.value);
    });

    copyBtn.addEventListener('click', async () => {
      try {
        if (!outTA.value.trim()) return;
        await navigator.clipboard.writeText(outTA.value);
        alert('Copied combined loader to clipboard.');
      } catch (e) {
        console.error(e);
        alert('Copy failed (clipboard permissions). You can still manually select + copy.');
      }
    });

    panel.appendChild(topNote);
    panel.appendChild(installedLine);
    panel.appendChild(loadStatus);
    panel.appendChild(settingsRow);
    panel.appendChild(baseLabel);
    panel.appendChild(baseTA);
    panel.appendChild(lockRow);
    panel.appendChild(actions);
    panel.appendChild(outLabel);
    panel.appendChild(outTA);
    panel.appendChild(hint);

    // Auto-load on first render
    tryAutoLoad({ reason: 'auto' });
  }

  /* ---------- theme editor injection ---------- */
  function injectThemeEditorLink() {
    if (!isThemeEditor()) return;

    const labels = Array.from(document.querySelectorAll('label'));
    const jsLabel = labels.find((l) => /^javascript file/i.test(l.textContent.trim()));
    if (!jsLabel) return;

    const container =
        jsLabel.closest('.ic-Form-control') ||
        jsLabel.closest('.ic-Form-control__control') ||
        jsLabel.parentElement;

    if (!container || container.querySelector('.cg-theme-editor-link')) return;

    const block = document.createElement('div');
    block.className = 'cg-theme-editor-link';
    block.style.cssText = `
      margin-top:10px;
      padding:10px;
      border:2px solid #2d8;
      border-radius:6px;
      background:rgba(34,221,136,.08);
    `;

    const title = document.createElement('div');
    title.textContent = 'Customized Gradebook Tools';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'Button Button--small';
    btn.textContent = 'Open CG Admin Dashboard';
    btn.addEventListener('click', () => {
      const accountId = getAccountId();
      if (!accountId) return alert('Account ID not found.');
      window.open(`/accounts/${accountId}?cg_admin_dashboard=1`, '_blank');
    });

    block.appendChild(title);
    block.appendChild(btn);
    container.appendChild(block);
  }

  /* ---------- entry ---------- */
  function start() {
    if (isCGAdminPage()) {
      renderCGAdminPage();
      return;
    }

    if (!isThemeEditor()) return;

    let tries = 0;
    const timer = setInterval(() => {
      injectThemeEditorLink();
      tries++;
      if (document.querySelector('.cg-theme-editor-link') || tries > 20) clearInterval(timer);
    }, 250);
  }

  start();
})();
/* =====================================================
   END CG MANAGED CODE
   ===================================================== */