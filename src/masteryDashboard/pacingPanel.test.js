// src/masteryDashboard/pacingPanel.test.js
// Student/observer pacing on Mastery View: the Pace stat box and per-outcome lines.

import { describe, test, expect, beforeEach } from 'vitest';
import {
    buildPacingModel,
    renderPaceStat,
    clearPaceStat,
    buildOutcomePaceLineHtml,
    buildOutcomeProgressBarHtml,
    paceTone,
    PACING_STYLE_ID
} from './pacingPanel.js';

const today = '2026-11-17';
const outcomeNames = new Map([['1', 'Alpha'], ['2', 'Beta'], ['3', 'Gamma']]);
const scoresByOutcomeId = new Map([['1', 3.5], ['2', 1], ['3', null]]);

const model = scales => buildPacingModel({
    pacing: { enabled: true, scales },
    scoresByOutcomeId, outcomeNames, today
});

let box;
beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<div id="pm-stat-pace" style="display:none;"></div>';
    box = document.getElementById('pm-stat-pace');
});

describe('buildPacingModel', () => {
    test('null without a config, when disabled, or with nothing required', () => {
        expect(buildPacingModel({ pacing: null, scoresByOutcomeId, outcomeNames, today })).toBeNull();
        expect(buildPacingModel({
            pacing: { enabled: false, scales: [{ id: '1', date: '', included: true }] },
            scoresByOutcomeId, outcomeNames, today
        })).toBeNull();
        expect(model([{ id: '1', date: '', included: false }])).toBeNull();
        expect(model([{ id: '999', date: '', included: true }])).toBeNull();
    });
});

describe('Pace stat box', () => {
    test('stays hidden for a null model', () => {
        expect(renderPaceStat(box, null)).toBe(false);
        expect(box.style.display).toBe('none');
        expect(box.innerHTML).toBe('');
    });

    test('shows pill, bar with expected tick, and detail line', () => {
        const summary = model([
            { id: '1', date: '2026-11-01', included: true },
            { id: '2', date: '2026-11-10', included: true },
            { id: '3', date: '2026-12-01', included: true }
        ]);
        expect(renderPaceStat(box, summary)).toBe(true);
        expect(box.style.display).toBe('');
        expect(document.getElementById(PACING_STYLE_ID)).not.toBeNull();

        expect(box.querySelector('.pm-pace-pill--behind').textContent).toBe('Behind pace');
        expect(box.querySelector('.pm-pace-fill').style.width).toBe('33%');
        expect(box.querySelector('.pm-pace-tick').style.left).toBe('67%');
        expect(box.querySelector('.pm-pace-detail').textContent).toBe('2 of 3 expected by today · 1 past target date');
        expect(box.querySelector('[role="img"]').getAttribute('aria-label'))
            .toBe('1 of 3 required outcomes mastered; 2 expected by today');
    });

    test('on pace, and missing dates → no pill, "Some target dates not set"', () => {
        renderPaceStat(box, model([{ id: '1', date: '2026-11-01', included: true }]));
        expect(box.querySelector('.pm-pace-pill--onpace').textContent).toBe('On pace');

        renderPaceStat(box, model([{ id: '1', date: '', included: true }, { id: '2', date: '2026-12-01', included: true }]));
        expect(box.querySelector('.pm-pace-pill')).toBeNull();
        expect(box.querySelector('.pm-pace-detail').textContent).toBe('Some target dates not set');
    });

    test('no dates at all → no tick', () => {
        renderPaceStat(box, model([{ id: '1', date: '', included: true }]));
        expect(box.querySelector('.pm-pace-tick')).toBeNull();
    });

    test('clearPaceStat hides it again', () => {
        renderPaceStat(box, model([{ id: '1', date: '', included: true }]));
        clearPaceStat(box);
        expect(box.innerHTML).toBe('');
        expect(box.style.display).toBe('none');
    });
});

describe('pace bar color', () => {
    const tone = scales => paceTone(model(scales));

    test('red when any required outcome is past target and not mastered', () => {
        expect(tone([{ id: '2', date: '2026-11-10', included: true }, { id: '3', date: '', included: true }])).toBe('behind');
    });

    test('amber when a not-mastered outcome is due within 7 days (today counts)', () => {
        expect(tone([{ id: '2', date: '2026-11-17', included: true }])).toBe('soon');
        expect(tone([{ id: '2', date: '2026-11-24', included: true }])).toBe('soon');
        expect(tone([{ id: '2', date: '2026-11-25', included: true }])).toBe('onpace');
    });

    test('mastered outcomes due soon do not turn it amber', () => {
        expect(tone([{ id: '1', date: '2026-11-20', included: true }])).toBe('onpace');
    });

    test('gray when no target dates are set', () => {
        expect(tone([{ id: '2', date: '', included: true }])).toBe('none');
    });

    test('the fill carries the tone class', () => {
        renderPaceStat(box, model([{ id: '2', date: '2026-11-10', included: true }]));
        expect(box.querySelector('.pm-pace-fill').classList.contains('pm-pace-fill--behind')).toBe(true);
    });
});

describe('outcome card pace line', () => {
    const line = item => {
        const el = document.createElement('div');
        el.innerHTML = buildOutcomePaceLineHtml(item);
        return el.firstElementChild;
    };

    test('behind shows days past in red; due today; upcoming shows days left', () => {
        const behind = line({ date: '2026-09-01', days: -77, pacing: 'Behind pace' });
        expect(behind.textContent).toBe('Target Sep 1, 2026 · 77 days past');
        expect(behind.classList.contains('pm-pace-line--behind')).toBe(true);
        expect(line({ date: '2026-11-16', days: -1, pacing: 'Behind pace' }).textContent).toBe('Target Nov 16, 2026 · 1 day past');

        const today = line({ date: '2026-11-17', days: 0, pacing: 'Due today' });
        expect(today.textContent).toBe('Target Nov 17, 2026 · Due today');
        expect(today.classList.contains('pm-pace-line--today')).toBe(true);

        expect(line({ date: '2026-12-04', days: 17, pacing: 'Upcoming' }).textContent).toBe('Target Dec 4, 2026 · in 17 days');
    });

    test('mastered shows only the expected date — no days, no "early"', () => {
        const past = line({ date: '2026-10-01', days: -47, pacing: 'Mastered' });
        expect(past.textContent).toBe('Expected by Oct 1, 2026 · Mastered');
        expect(past.classList.contains('pm-pace-line--mastered')).toBe(true);
        expect(line({ date: '2026-12-01', days: 14, pacing: 'Mastered' }).textContent).toBe('Expected by Dec 1, 2026 · Mastered');
    });

    test('undated outcomes say so', () => {
        expect(line({ date: '', days: null, pacing: 'No target date' }).textContent).toBe('No target date');
        expect(line({ date: '', days: null, pacing: 'Mastered' }).textContent).toBe('No target date · Mastered');
    });
});

describe('outcome card progress bar', () => {
    const bar = (score, color = '#03893D') => {
        const el = document.createElement('div');
        el.innerHTML = buildOutcomeProgressBarHtml(score, color, { maxPoints: 4, threshold: 3 });
        return el.firstElementChild;
    };

    test('fill is score / max, tick at the mastery threshold', () => {
        const b = bar(2);
        const [fill, tick] = b.children;
        expect(fill.style.width).toBe('50%');
        expect(tick.style.left).toBe('75%');
        expect(b.getAttribute('aria-label')).toBe('Score 2 out of 4. Mastery is 3.');
    });

    test('no score → empty fill, clamped above max', () => {
        expect(bar(null).children[0].style.width).toBe('0%');
        expect(bar(null).getAttribute('aria-label')).toBe('No score yet. Mastery is 3 out of 4.');
        expect(bar(5).children[0].style.width).toBe('100%');
    });
});
