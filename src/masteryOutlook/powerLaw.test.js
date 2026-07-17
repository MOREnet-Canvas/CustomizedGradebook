// src/masteryOutlook/powerLaw.test.js
import { describe, it, expect } from 'vitest';
import {
    MIN_SCORES,
    MAX_SCORE,
    MIN_SCORE,
    DECAYING_AVG_WEIGHT,
    roundToHalf,
    powerLawPredict,
    powerLawSlope,
    mean,
    mostRecent,
    decayingAverage,
    isInsufficient,
    computeStudentOutcome,
    computeClassStats,
} from './powerLaw.js';

describe('roundToHalf', () => {
    it('rounds to nearest 0.5', () => {
        expect(roundToHalf(2.74)).toBe(2.5);
        expect(roundToHalf(2.76)).toBe(3.0);
        expect(roundToHalf(3.25)).toBe(3.5);
        expect(roundToHalf(4.0)).toBe(4.0);
        expect(roundToHalf(1.0)).toBe(1.0);
    });
});

describe('mean', () => {
    it('returns null for empty or null input', () => {
        expect(mean([])).toBeNull();
        expect(mean(null)).toBeNull();
    });
    it('computes simple average', () => {
        expect(mean([2, 4])).toBe(3);
        expect(mean([1, 2, 3, 4])).toBe(2.5);
        expect(mean([3])).toBe(3);
    });
});

describe('mostRecent', () => {
    it('returns null for empty or null input', () => {
        expect(mostRecent([])).toBeNull();
        expect(mostRecent(null)).toBeNull();
    });
    it('returns last element', () => {
        expect(mostRecent([1, 2, 3])).toBe(3);
        expect(mostRecent([4])).toBe(4);
    });
});

describe('decayingAverage', () => {
    it('returns null for empty or null input', () => {
        expect(decayingAverage([])).toBeNull();
        expect(decayingAverage(null)).toBeNull();
    });
    it('returns single score when only one score exists', () => {
        expect(decayingAverage([3])).toBe(3);
    });
    it('weights recent scores more heavily using default weight 0.65', () => {
        // scores [2, 4]: result = 0.65*4 + 0.35*2 = 2.6 + 0.7 = 3.3
        expect(decayingAverage([2, 4])).toBeCloseTo(3.3, 5);
    });
    it('respects custom weight', () => {
        // weight=1.0: always returns the newest score
        expect(decayingAverage([1, 2, 3], 1.0)).toBe(3);
    });
    it('uses DECAYING_AVG_WEIGHT constant as default', () => {
        const [s1, s2] = [2, 4];
        const expected = DECAYING_AVG_WEIGHT * s2 + (1 - DECAYING_AVG_WEIGHT) * s1;
        expect(decayingAverage([s1, s2])).toBeCloseTo(expected, 10);
    });
});

describe('isInsufficient', () => {
    it('returns true for null, undefined, or too-short arrays', () => {
        expect(isInsufficient(null)).toBe(true);
        expect(isInsufficient(undefined)).toBe(true);
        expect(isInsufficient([])).toBe(true);
        expect(isInsufficient([3])).toBe(true);
        expect(isInsufficient([3, 3])).toBe(true);
    });
    it('returns false when scores length >= MIN_SCORES', () => {
        expect(isInsufficient([3, 3, 3])).toBe(false);
        expect(isInsufficient([1, 2, 3, 4])).toBe(false);
    });
    it('MIN_SCORES is 3', () => {
        expect(MIN_SCORES).toBe(3);
    });
});

describe('powerLawPredict', () => {
    it('returns null for insufficient data', () => {
        expect(powerLawPredict(null)).toBeNull();
        expect(powerLawPredict([3, 3])).toBeNull();
    });
    it('prediction is always clamped between MIN_SCORE and MAX_SCORE', () => {
        const prediction = powerLawPredict([1, 2, 3, 4]);
        expect(prediction).toBeGreaterThanOrEqual(MIN_SCORE);
        expect(prediction).toBeLessThanOrEqual(MAX_SCORE);
    });
    it('flat scores produce prediction near the same flat value', () => {
        const pred = powerLawPredict([3, 3, 3]);
        expect(pred).toBeCloseTo(3, 1);
    });
    it('increasing trend produces higher prediction than first score', () => {
        const pred = powerLawPredict([1, 2, 3]);
        expect(pred).toBeGreaterThan(3);
    });
    it('prediction is clamped at MAX_SCORE (4) for very strong increasing trend', () => {
        const pred = powerLawPredict([1, 2, 4, 4]);
        expect(pred).toBeLessThanOrEqual(MAX_SCORE);
    });
});

describe('powerLawSlope', () => {
    it('returns null for insufficient data', () => {
        expect(powerLawSlope(null)).toBeNull();
        expect(powerLawSlope([2, 3])).toBeNull();
    });
    it('flat scores produce slope near zero', () => {
        expect(powerLawSlope([3, 3, 3])).toBeCloseTo(0, 5);
    });
    it('increasing scores produce positive slope', () => {
        expect(powerLawSlope([1, 2, 3])).toBeGreaterThan(0);
    });
    it('decreasing scores produce negative slope', () => {
        expect(powerLawSlope([4, 3, 2])).toBeLessThan(0);
    });
});

describe('computeStudentOutcome', () => {
    it('returns NE status and null predictions when insufficient scores', () => {
        const result = computeStudentOutcome([3, 3]);
        expect(result.status).toBe('NE');
        expect(result.plPrediction).toBeNull();
        expect(result.slope).toBeNull();
        expect(result.attemptCount).toBe(2);
    });
    it('returns ok status and numeric predictions with sufficient scores', () => {
        const result = computeStudentOutcome([2, 3, 3]);
        expect(result.status).toBe('ok');
        expect(typeof result.plPrediction).toBe('number');
        expect(typeof result.slope).toBe('number');
        expect(typeof result.mean).toBe('number');
        expect(typeof result.mostRecent).toBe('number');
        expect(typeof result.decayingAvg).toBe('number');
        expect(result.attemptCount).toBe(3);
    });
    it('always populates mean, mostRecent, decayingAvg regardless of count', () => {
        const result = computeStudentOutcome([2]);
        expect(result.mean).toBe(2);
        expect(result.mostRecent).toBe(2);
        expect(result.decayingAvg).toBe(2);
    });
});

describe('computeClassStats', () => {
    it('returns null aggregates when no students have ok status', () => {
        const students = [
            { computed: { status: 'NE', plPrediction: null, slope: null } },
        ];
        const stats = computeClassStats(students, 2.2);
        expect(stats.plAvg).toBeNull();
        expect(stats.avgSlope).toBeNull();
        expect(stats.neCount).toBe(1);
    });
    it('counts belowThresholdCount correctly', () => {
        const students = [
            { computed: { status: 'ok', plPrediction: 1.8, slope: -0.5 } },
            { computed: { status: 'ok', plPrediction: 3.2, slope: 0.4 } },
        ];
        const stats = computeClassStats(students, 2.2);
        expect(stats.belowThresholdCount).toBe(1);
        expect(stats.computedThreshold).toBe(2.2);
        expect(stats.plAvg).toBeCloseTo(2.5, 3);
    });
    it('distribution buckets cover full score range', () => {
        const students = [
            { computed: { status: 'ok', plPrediction: 1.0, slope: 0 } },
            { computed: { status: 'ok', plPrediction: 2.0, slope: 0 } },
            { computed: { status: 'ok', plPrediction: 3.0, slope: 0 } },
            { computed: { status: 'ok', plPrediction: 4.0, slope: 0 } },
        ];
        const stats = computeClassStats(students, 2.5);
        expect(stats.distribution['1']).toBe(1);
        expect(stats.distribution['2']).toBe(1);
        expect(stats.distribution['3']).toBe(1);
        expect(stats.distribution['4']).toBe(1);
    });
});
