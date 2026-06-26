# Power Law Algorithm

`src/masteryOutlook/powerLaw.js`

---

## Overview

`powerLaw.js` is a **pure math module** — no DOM, no Canvas API, no side effects. Every export is a stateless function that takes an array of scores and returns a number or object.

The module implements Marzano's Power Law of Learning, which models student skill acquisition as a power curve. It also provides simpler fallback statistics (mean, most recent, decaying average) for students with fewer than the minimum required attempts.

---

## The Marzano Power Law formula

```
y = a · x^b
```

Where:
- `x` = attempt index (1-based, oldest = 1)
- `y` = score at attempt `x`
- `a` = intercept coefficient (initial performance level)
- `b` = slope coefficient (rate of learning — positive = growing, negative = declining)

The coefficients are solved via **least-squares regression on log-transformed values**:

```
ln(y) = ln(a) + b·ln(x)
```

This converts the power-law fit into a standard linear regression problem on the log-logged data, making it solvable with the standard formulas for slope and intercept.

**Prediction:** Once `a` and `b` are determined from the score history, the next score is predicted by evaluating `a · (n+1)^b`, where `n` is the number of existing scores.

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_SCORES` | `3` | Minimum attempts required to run Power Law. Fewer → `NE` status. |
| `MAX_SCORE` | `4` | Upper clamp on predictions |
| `MIN_SCORE` | `1` | Lower clamp on predictions |
| `DECAYING_AVG_WEIGHT` | `0.65` | Default weight applied to each new score in `decayingAverage` |

---

## Exports

### `powerLawPredict(scores)` → `number|null`

Predicts the student's next score using the Power Law regression.

| Parameter | Type | Description |
|-----------|------|-------------|
| `scores` | `number[]` | Rubric criterion scores in **chronological order, oldest first** |

Returns the predicted score clamped to `[MIN_SCORE, MAX_SCORE]`, or `null` if `scores.length < MIN_SCORES`.

**Implementation steps:**

1. Map `x = [1, 2, ..., n]` and `y = scores` to log space: `lnX[i] = ln(i+1)`, `lnY[i] = ln(max(score, 0.01))`
2. Compute OLS regression coefficients `b` (slope) and `a = exp(intercept)`
3. Predict at `n+1`: `clamp(a · (n+1)^b, MIN_SCORE, MAX_SCORE)`

The `max(y, 0.01)` guard prevents `ln(0)` for zero scores.

---

### `powerLawSlope(scores)` → `number|null`

Returns the `b` coefficient from the Power Law regression. Positive = student improving, negative = declining, near zero = flat trajectory.

Same input and minimum-score requirements as `powerLawPredict`. Returns `null` if insufficient data.

---

### `mean(scores)` → `number|null`

Simple arithmetic mean. Available for any number of attempts (including < `MIN_SCORES`). Returns `null` for empty input.

---

### `mostRecent(scores)` → `number|null`

Returns `scores[scores.length - 1]`. Available for any number of attempts. Returns `null` for empty input.

---

### `decayingAverage(scores, weight?)` → `number|null`

Calculates a weighted running average where each new score is blended with the previous average:

```
result_i = weight · score_i + (1 - weight) · result_{i-1}
```

The first score seeds the average with no weighting. With `weight = 0.65`, recent scores are weighted more heavily than older ones.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scores` | `number[]` | required | Chronological scores |
| `weight` | `number` | `0.65` | Weight on each new score (0–1) |

Returns `null` for empty input. Available regardless of attempt count.

---

### `isInsufficient(scores)` → `boolean`

Returns `true` if `scores.length < MIN_SCORES`. Used to determine `NE` (Not Enough data) status before attempting regression.

---

### `roundToHalf(val)` → `number`

Rounds a prediction to the nearest 0.5 (`Math.round(val * 2) / 2`).

Applied **only at the presentation and sync layers** — predictions inside the module remain at full floating-point precision. The rounding step converts the model output to the Marzano 0, 0.5, 1, 1.5, … 4 scale that teachers set grades in.

---

### `computeStudentOutcome(scores)` → `Object`

The **single entry point** for the cache-building phase. `outcomesDataService` calls this once per student per outcome. Runs all metrics in a single pass.

Returns an object matching the cache schema:

```js
{
  status:       'NE' | 'ok',
  plPrediction: number | null,   // powerLawPredict result (null if NE)
  slope:        number | null,   // powerLawSlope result (null if NE)
  mean:         number | null,
  mostRecent:   number | null,
  decayingAvg:  number | null,
  attemptCount: number
}
```

---

### `computeClassStats(studentResults, threshold)` → `Object`

Aggregates per-student computed objects into a class-level summary for one outcome. Called once per outcome after all student computations are complete.

| Parameter | Type | Description |
|-----------|------|-------------|
| `studentResults` | `Object[]` | Array of cache entries, each with a `.computed` field (output of `computeStudentOutcome`) |
| `threshold` | `number` | Re-teach threshold (e.g. `2.2`) |

Returns:

```js
{
  plAvg:               number | null,   // Class mean of plPrediction (students with 'ok' only)
  distribution: {
    '1': number,                        // Students with plPrediction < 1.5
    '2': number,                        // 1.5 ≤ plPrediction < 2.5
    '3': number,                        // 2.5 ≤ plPrediction < 3.5
    '4': number                         // plPrediction ≥ 3.5
  },
  belowThresholdCount: number,          // Students below `threshold`
  computedThreshold:   number,          // `threshold` passed in
  avgSlope:            number | null,   // Class mean of slope coefficients
  neCount:             number           // Students with status === 'NE'
}
```

`plAvg` and `avgSlope` are formatted to 4 decimal places.

---

## Gotchas

- **Input order is the caller's responsibility** — `powerLaw.js` trusts that scores are chronological, oldest first. Passing scores in the wrong order produces a valid but incorrect regression. The caller (`outcomesDataService`) is responsible for sorting by attempt timestamp before calling.
- **`MIN_SCORE = 1` clamp, not 0** — A predicted score below 1.0 is clamped to 1.0, not 0. This reflects the Marzano scale (0 = "Not Attempted", 1 = "Beginning"). Scores below 1 in raw Canvas rubric data should be treated as 0.01 for regression purposes to avoid `ln(0)`.
- **`roundToHalf` at sync time** — The Will Post value shown in the UI and sent to Canvas is `roundToHalf(plPrediction)`. The raw `plPrediction` in the cache is the unrounded float. If you compare cached values to Canvas values you may see rounding differences; use `scoresMatch()` from `plOutlookSyncStatus.js` for comparison.
- **Degenerate regression** — If all log-x values are identical (impossible with 1-based indexing and ≥3 scores, but guarded by `Math.abs(denom) < 1e-9`), both `powerLawPredict` and `powerLawSlope` return `null` rather than producing an infinity or NaN.
- **`decayingAverage` is seeded by the first score** — The first score is returned as-is (no weighting). For a student with exactly one score, `decayingAverage([3])` returns `3`, not `0.65 × 3 = 1.95`.
