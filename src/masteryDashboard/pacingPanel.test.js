// src/masteryDashboard/pacingPanel.test.js
// DOM render tests for the student/observer pacing panel on Mastery View.

import { describe, test, expect, beforeEach } from 'vitest';
import { renderPacingPanel, clearPacingPanel, PACING_PANEL_STYLE_ID } from './pacingPanel.js';

const today = '2026-11-17';
const outcomeNames = new Map([['1', 'Alpha <b>'], ['2', 'Beta']]);
const scoresByOutcomeId = new Map([['1', 3.5], ['2', 1]]);

let slot;
beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<div id="pm-pacing" style="display:none;"></div>';
    slot = document.getElementById('pm-pacing');
});

describe('renderPacingPanel', () => {
    test('stays hidden without a config', () => {
        expect(renderPacingPanel(slot, { pacing: null, scoresByOutcomeId, outcomeNames, today })).toBe(false);
        expect(slot.style.display).toBe('none');
        expect(slot.innerHTML).toBe('');
    });

    test('stays hidden when disabled or nothing included', () => {
        const scales = [{ id: '1', date: '', included: true }];
        expect(renderPacingPanel(slot, { pacing: { enabled: false, scales }, scoresByOutcomeId, outcomeNames, today })).toBe(false);
        expect(renderPacingPanel(slot, {
            pacing: { enabled: true, scales: [{ id: '1', date: '', included: false }] },
            scoresByOutcomeId, outcomeNames, today
        })).toBe(false);
        expect(slot.style.display).toBe('none');
    });

    test('renders bars, status, tiles and escaped outcome names', () => {
        const pacing = {
            enabled: true,
            scales: [
                { id: '1', date: '2026-11-01', included: true },
                { id: '2', date: '2026-11-10', included: true }
            ]
        };
        expect(renderPacingPanel(slot, { pacing, scoresByOutcomeId, outcomeNames, today })).toBe(true);
        expect(slot.style.display).toBe('block');
        expect(document.getElementById(PACING_PANEL_STYLE_ID)).not.toBeNull();

        const text = slot.textContent;
        expect(text).toContain('Learning Progress');
        expect(text).toContain('1 of 2 outcomes mastered');
        expect(text).toContain('Expected Progress by Today');
        expect(slot.querySelector('.pm-pacing-status--behind').textContent).toBe('Behind Pace');
        expect(slot.querySelectorAll('.pm-pacing-item')).toHaveLength(2);
        expect(slot.innerHTML).toContain('Alpha &lt;b&gt;');
        expect(slot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('50');
    });

    test('notes missing dates and omits the overall status', () => {
        const pacing = { enabled: true, scales: [{ id: '1', date: '', included: true }, { id: '2', date: '2026-12-01', included: true }] };
        renderPacingPanel(slot, { pacing, scoresByOutcomeId, outcomeNames, today });
        expect(slot.querySelector('.pm-pacing-status')).toBeNull();
        expect(slot.textContent).toContain('1 target date has not been set');
    });

    test('clearPacingPanel hides a rendered panel', () => {
        renderPacingPanel(slot, { pacing: { enabled: true, scales: [{ id: '1', date: '', included: true }] }, scoresByOutcomeId, outcomeNames, today });
        clearPacingPanel(slot);
        expect(slot.innerHTML).toBe('');
        expect(slot.style.display).toBe('none');
    });
});
