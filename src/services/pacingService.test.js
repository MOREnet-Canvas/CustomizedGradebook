// src/services/pacingService.test.js
// Pure-logic tests for course pacing: storage format, dates, classification, summary.

import { describe, test, expect } from 'vitest';
import {
    parsePacing,
    serializePacing,
    isValidDate,
    todayInTimeZone,
    daysUntil,
    formatTargetDate,
    evidenceStatus,
    pacingStatus,
    computePacingSummary,
    percentOf,
    PACING_ATTRIBUTE,
    PACING_STATUS,
    EVIDENCE_STATUS
} from './pacingService.js';

describe('parsePacing / serializePacing', () => {
    test('returns null when absent or invalid', () => {
        expect(parsePacing(null)).toBeNull();
        expect(parsePacing('')).toBeNull();
        expect(parsePacing('not json')).toBeNull();
        expect(parsePacing('{"scales":"nope"}')).toBeNull();
        const el = document.createElement('div');
        expect(parsePacing(el)).toBeNull();
    });

    test('normalizes ids, dates, included, enabled', () => {
        const parsed = parsePacing(JSON.stringify({
            v: 1,
            scales: [
                { id: 5, date: '2026-12-04' },
                { id: '6', date: '2026-02-30', included: false },
                { id: null, date: '2026-01-01' }
            ]
        }));
        expect(parsed).toEqual({
            enabled: true,
            scales: [
                { id: '5', date: '2026-12-04', included: true },
                { id: '6', date: '', included: false }
            ]
        });
    });

    test('reads the attribute from an element (HTML-decoded by the DOM)', () => {
        const el = document.createElement('div');
        el.innerHTML = `<div id="r" ${PACING_ATTRIBUTE}="{&quot;v&quot;:1,&quot;enabled&quot;:false,&quot;scales&quot;:[{&quot;id&quot;:&quot;1&quot;,&quot;date&quot;:&quot;&quot;,&quot;included&quot;:true}]}"></div>`;
        const parsed = parsePacing(el.firstElementChild);
        expect(parsed.enabled).toBe(false);
        expect(parsed.scales).toHaveLength(1);
    });

    test('round-trips through serializePacing', () => {
        const pacing = { enabled: true, scales: [{ id: '1', date: '2026-12-04', included: true }] };
        expect(parsePacing(serializePacing(pacing))).toEqual(pacing);
        expect(JSON.parse(serializePacing(pacing)).v).toBe(1);
    });
});

describe('dates', () => {
    test('isValidDate rejects malformed and impossible dates', () => {
        expect(isValidDate('2026-12-04')).toBe(true);
        expect(isValidDate('2026-02-30')).toBe(false);
        expect(isValidDate('12/04/2026')).toBe(false);
        expect(isValidDate(undefined)).toBe(false);
    });

    test('todayInTimeZone uses the zone and falls back on unknown zones', () => {
        const now = new Date('2026-11-18T03:00:00Z'); // still Nov 17 in Chicago
        expect(todayInTimeZone('America/Chicago', now)).toBe('2026-11-17');
        expect(todayInTimeZone('UTC', now)).toBe('2026-11-18');
        expect(todayInTimeZone('Not/AZone', now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('daysUntil and formatTargetDate', () => {
        expect(daysUntil('2026-11-20', '2026-11-17')).toBe(3);
        expect(daysUntil('2026-11-10', '2026-11-17')).toBe(-7);
        expect(daysUntil('', '2026-11-17')).toBeNull();
        expect(formatTargetDate('2026-12-04')).toBe('Dec 4, 2026');
        expect(formatTargetDate('')).toBe('Not set');
    });
});

describe('classification', () => {
    test('evidenceStatus', () => {
        expect(evidenceStatus(null, 3)).toBe(EVIDENCE_STATUS.NO_EVIDENCE);
        expect(evidenceStatus(0, 3)).toBe(EVIDENCE_STATUS.NO_EVIDENCE);
        expect(evidenceStatus(2.5, 3)).toBe(EVIDENCE_STATUS.NOT_YET_MASTERED);
        expect(evidenceStatus(3, 3)).toBe(EVIDENCE_STATUS.MASTERED);
    });

    test('pacingStatus', () => {
        const today = '2026-11-17';
        expect(pacingStatus({ date: '2026-11-01' }, 3.2, today, 3)).toBe(PACING_STATUS.MASTERED);
        expect(pacingStatus({ date: '' }, 1, today, 3)).toBe(PACING_STATUS.NO_TARGET_DATE);
        expect(pacingStatus({ date: '2026-11-16' }, 1, today, 3)).toBe(PACING_STATUS.BEHIND);
        expect(pacingStatus({ date: '2026-11-17' }, 1, today, 3)).toBe(PACING_STATUS.TARGET_TODAY);
        expect(pacingStatus({ date: '2026-11-18' }, null, today, 3)).toBe(PACING_STATUS.UPCOMING);
    });
});

describe('computePacingSummary', () => {
    const today = '2026-11-17';
    const outcomeNames = new Map([['1', 'Alpha'], ['2', 'Beta'], ['3', 'Gamma'], ['4', 'Delta']]);
    const scores = new Map([['1', 3.5], ['2', 2], ['3', null]]);

    test('all dated, one behind → Behind Pace', () => {
        const s = computePacingSummary({
            scales: [
                { id: '1', date: '2026-11-01', included: true },
                { id: '2', date: '2026-11-10', included: true },
                { id: '3', date: '2026-12-01', included: true },
                { id: '4', date: '2026-12-01', included: false }
            ],
            scoresByOutcomeId: scores, outcomeNames, today, threshold: 3
        });
        expect(s.total).toBe(3);
        expect(s.mastered).toBe(1);
        expect(s.dated).toBe(3);
        expect(s.dueByToday).toBe(2);
        expect(s.behind).toBe(1);
        expect(s.dueSoon).toBe(0);
        expect(s.noEvidence).toBe(1);
        expect(s.datesComplete).toBe(true);
        expect(s.overall).toBe(PACING_STATUS.BEHIND);
        expect(s.items.map(i => i.id)).toEqual(['1', '2', '3']);
        expect(s.items.map(i => i.days)).toEqual([-16, -7, 14]);
    });

    test('target today and on pace', () => {
        const todayCase = computePacingSummary({
            scales: [{ id: '2', date: today, included: true }],
            scoresByOutcomeId: scores, outcomeNames, today, threshold: 3
        });
        expect(todayCase.overall).toBe(PACING_STATUS.TARGET_TODAY);

        const onPace = computePacingSummary({
            scales: [{ id: '1', date: '2026-11-01', included: true }, { id: '3', date: '2026-12-01', included: true }],
            scoresByOutcomeId: scores, outcomeNames, today, threshold: 3
        });
        expect(onPace.overall).toBe(PACING_STATUS.ON_PACE);
    });

    test('missing dates → no overall status; unknown outcomes dropped; undated sorted last', () => {
        const s = computePacingSummary({
            scales: [
                { id: '3', date: '', included: true },
                { id: '2', date: '2026-12-01', included: true },
                { id: '999', date: '2026-11-01', included: true }
            ],
            scoresByOutcomeId: scores, outcomeNames, today, threshold: 3
        });
        expect(s.total).toBe(2);
        expect(s.datesComplete).toBe(false);
        expect(s.overall).toBeNull();
        expect(s.items.map(i => i.id)).toEqual(['2', '3']);
    });
});

test('percentOf clamps and handles zero total', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 3)).toBe(100);
    expect(percentOf(1, 0)).toBe(0);
});
