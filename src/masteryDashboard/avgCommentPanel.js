// src/masteryDashboard/avgCommentPanel.js
/**
 * AVG Assignment Comment Panel
 *
 * Renders a comment icon and collapsible comment panel for the Total (AVG) card
 * on the Mastery Dashboard. Displays teacher comments from the AVG assignment
 * submission, sorted newest to oldest, capped at 3 visible with scrolling.
 *
 * Exports:
 *   buildAvgCommentToggleHtml(rawComments) → HTML string for the toggle button
 *   buildAvgCommentPanelHtml(rawComments)  → HTML string for the comment panel
 *   initAvgCommentPanel()                  → wires toggle click after DOM render
 */

const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const PANEL_ID = 'pm-avg-comment-panel';
const TOGGLE_ID = 'pm-avg-comment-toggle';
const MAX_VISIBLE = 3;

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function prepareComments(rawComments) {
    return [...rawComments]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Build the toggle button HTML.
 * Returns empty string when there are no comments.
 * @param {Array} rawComments - submission_comments array from Canvas API
 * @returns {string} HTML string
 */
export function buildAvgCommentToggleHtml(rawComments) {
    if (!rawComments?.length) return '';
    return `
        <button id="${TOGGLE_ID}"
            aria-label="View teacher comments"
            aria-expanded="false"
            title="View comments"
            style="background:#E8F0FE; border:1.5px solid #0770A3; border-radius:12px; cursor:pointer; padding:3px 8px; font-size:1.1rem; line-height:1; flex-shrink:0;">
            💬
        </button>
    `;
}

/**
 * Build the collapsible comment panel HTML (hidden by default).
 * Returns empty string when there are no comments.
 * @param {Array} rawComments - submission_comments array from Canvas API
 * @returns {string} HTML string
 */
export function buildAvgCommentPanelHtml(rawComments) {
    if (!rawComments?.length) return '';

    const comments = prepareComments(rawComments);
    const count = rawComments.length;

    const commentRows = comments.map(c => {
        const date = c.created_at
            ? new Date(c.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })
            : '';
        return `
            <div style="padding:8px 0; border-bottom:1px solid #f0f0f0;">
                <div style="${FONT} font-size:0.75rem; color:#888; margin-bottom:4px; line-height:1.4; -webkit-font-smoothing:antialiased;">
                    ${escapeHtml(c.author_name || 'Teacher')}${date ? ` · ${date}` : ''}
                </div>
                <div style="${FONT} font-size:0.85rem; color:#333; line-height:1.5; -webkit-font-smoothing:antialiased; border-left:3px solid #0770A3; padding-left:8px;">
                    ${escapeHtml(c.comment || '')}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div id="${PANEL_ID}" style="display:none; margin-top:8px;">
            <div style="${FONT} font-size:0.72rem; font-weight:600; color:#666; margin-bottom:4px; letter-spacing:0.04em; text-transform:uppercase; -webkit-font-smoothing:antialiased;">
                Teacher Comments${count > 1 ? ` (${count})` : ''}
            </div>
            <div style="max-height:160px; overflow-y:auto; border:1px solid #e8e8e8; border-radius:6px; padding:0 10px;">
                ${commentRows}
            </div>
        </div>
    `;
}

/**
 * Wire up the toggle button click handler after the card HTML is in the DOM.
 * Safe to call even when no comments exist — the button won't be present and
 * the function returns silently.
 */
export function initAvgCommentPanel() {
    const toggle = document.getElementById(TOGGLE_ID);
    const panel = document.getElementById(PANEL_ID);
    if (!toggle || !panel) return;

    toggle.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        toggle.setAttribute('aria-expanded', String(!isOpen));
        toggle.style.background = isOpen ? '#E8F0FE' : '#C9DEFA';
        toggle.style.borderColor = '#0770A3';
    });
}