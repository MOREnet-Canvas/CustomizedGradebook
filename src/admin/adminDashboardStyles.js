// src/admin/adminDashboardStyles.js
/**
 * Admin Dashboard Styles
 *
 * All .cg-* component styles (panels, tooltips, status messages, toolbar,
 * summary, sections, pills) used by the Admin Dashboard.
 *
 * Previously lived in loader files/css_loader.css; moved here so styles
 * version with the bundle that uses them.
 *
 * Page-reset rules (hide Canvas chrome) remain inline in dashboardShell.js
 * because they're specific to the dashboard's full-page takeover, not
 * reusable component styling.
 *
 * Consumed by: src/admin/dashboardShell.js → injectAdminDashboardStyles()
 */

import { injectStyles } from '../ui/styles.js';

const ADMIN_DASHBOARD_CSS = `
/* ========================================
   Panel Components
   ======================================== */

.cg-panel {
    background: #fff;
    border: 1px solid #C7CDD1;
    border-radius: 4px;
    margin-bottom: 24px;
}

.cg-panel__header {
    padding: 16px 20px;
    border-bottom: 1px solid #C7CDD1;
    background: #F5F5F5;
    font-weight: 600;
    font-size: 16px;
    color: #2D3B45;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
}

.cg-panel__header:hover {
    background: #EEEEEE;
}

.cg-panel__header-title {
    flex: 1;
}

.cg-panel__header-toggle {
    color: #666;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
}

/* Override Canvas icon font size for panel toggle arrows */
.cg-panel__header-toggle.icon-mini-arrow-down::before,
.cg-panel__header-toggle.icon-mini-arrow-right::before {
    font-size: 32px !important;
}

.cg-panel__body {
    padding: 20px;
}

.cg-panel__footer {
    padding: 16px 20px;
    border-top: 1px solid #C7CDD1;
    background: #F5F5F5;
}

.cg-panel--collapsed .cg-panel__body {
    display: none;
}

.cg-panel--collapsed .cg-panel__footer {
    display: none;
}

/* ========================================
   Tooltip
   ======================================== */

.cg-tip {
    display: inline-block;
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
    border-radius: 50%;
    background: #0374B5;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    cursor: help;
    margin-left: 6px;
    vertical-align: middle;
}

.cg-tip:hover {
    background: #0056A3;
}

/* ========================================
   Utility Classes
   ======================================== */

.cg-admin-padding { padding: 24px; }

.cg-section {
    margin-bottom: 24px;
}

.cg-section__title {
    font-size: 14px;
    font-weight: 600;
    color: #2D3B45;
    margin-bottom: 12px;
    padding-left: 8px;
    border-left: 3px solid #0374B5;
}

.cg-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
}

.cg-button-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
}

/* ========================================
   Status Messages
   ======================================== */

.cg-status {
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 12px;
    font-size: 14px;
}

.cg-status--info {
    background: #F0F7FF;
    border: 1px solid #0374B5;
    color: #2D3B45;
}

.cg-status--success {
    background: #F6FFED;
    border: 1px solid #B7EB8F;
    color: #2D3B45;
}

.cg-status--warning {
    background: #FFF7E6;
    border: 1px solid #F3D19E;
    color: #2D3B45;
}

.cg-status--error {
    background: #FFF1F0;
    border: 1px solid #FFA39E;
    color: #2D3B45;
}

.cg-status-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
}

.cg-pill {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid #e2e6ea;
    background: #fafbfc;
    font-size: 13px;
    color: #2d3b45;
}

.cg-pill b {
    font-weight: 600;
}

/* ========================================
   Toolbar / Header
   ======================================== */

.cg-toolbar {
    position: sticky;
    top: 0;
    z-index: 60;
    background: #f5f5f5;
    border-bottom: 1px solid #c7cdd1;
    padding: 10px 0;
}

.cg-toolbar__inner {
    background: #fff;
    border: 1px solid #c7cdd1;
    border-radius: 4px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.cg-toolbar__left {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.cg-toolbar__nav {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 6px 14px;
    margin-top: 6px;
}

.cg-toolbar__right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    min-width: 140px;
}

.cg-toolbar__title {
    font-weight: 700;
    font-size: 28px;
    color: #2d3b45;
    margin-bottom: 2px;
    white-space: nowrap;
}

.cg-toolbar__subtitle {
    font-size: 14px;
    color: #6b7785;
    margin-bottom: 10px;
}

.cg-toolbar__titleBlock {
    display: flex;
    flex-direction: column;
}

/* ========================================
   Summary
   ======================================== */

.cg-summary-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
}

.cg-summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
}

.cg-summary-label {
    color: #6b7785;
}

.cg-summary-value {
    font-weight: 600;
    color: #2d3b45;
}

/* ========================================
   Theme CSS Editor Panel
   ======================================== */

.cg-theme-url-display {
    font-size: 13px;
    color: #666;
    margin-bottom: 10px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 6px;
}
.cg-theme-url-text {
    margin-top: 4px;
    word-break: break-all;
    font-family: monospace;
    font-size: 12px;
}
.cg-theme-load-status {
    margin-bottom: 10px;
}
#theme-css-textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    background: #fafafa;
}
.cg-theme-cors-hint {
    color: #666;
    font-size: 13px;
}
`;

/**
 * Inject the admin dashboard CSS into the page via a `<style>` element.
 * Safe to call multiple times — the `injectStyles` helper de-duplicates by element id.
 *
 * @returns {void}
 */
export function injectAdminDashboardStyles() {
    injectStyles(ADMIN_DASHBOARD_CSS, 'cg-admin-dashboard-styles');
}