// src/masteryOutlook/currentScorePaceView.js
/**
 * Course Overview "Pace" view — the alternative to the Current Score table.
 *
 * One row per student on a timeline from course start to course end (term
 * dates, then target dates as fallbacks). Each required outcome with a target
 * date (Pacing tab, cache.meta.customOutcomePacing) is a marker at its date:
 *   ✓ Mastered · ✕ past the target and not mastered · ● due today · ○ not due yet.
 * Outcomes that aren't required or have no date are left off.
 *
 * Scores are the Canvas outcome scores shown in the Scores table
 * (buildCurrentScoreRows); statuses come from pacingService, so teachers see
 * the same "Behind pace" / "Due today" as the student Mastery View panel.
 *
 * Every student uses the class target dates. Per-student dates: #116.
 */

import { escapeHtml } from '../utils/html.js';
import { scoreTone, scoreToneStyle } from '../ui/masteryColors.js';
import { DEFAULT_MASTERY_THRESHOLD } from '../config.js';
import { getOutcomeDisplayName } from './outcomeTypes.js';
import {
    buildCurrentScoreRows, renderCurrentScoreToolbar, sortStudentRows, CS_MODES,
} from './currentScoreTable.js';
import {
    computePacingSummary, isValidDate, daysUntil, timelineRange,
    todayInTimeZone, formatTargetDate, PACING_STATUS,
} from '../services/pacingService.js';

/** Default Pace sort: most behind first. */
export const DEFAULT_PACE_SORT = Object.freeze({ key: 'behind', dir: 'desc' });

/** Marker symbol per pacing status. */
const MARKS = {
    met:    { label: 'Mastered',                    svg: '<circle cx="8" cy="8" r="7" fill="#0b874b"/><path d="M4.6 8.2l2.3 2.4 4.6-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
    behind: { label: 'Past target, not mastered',   svg: '<rect x="1" y="1" width="14" height="14" rx="1.5" fill="#c5221f"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' },
    today:  { label: 'Due today, not mastered',     svg: '<circle cx="8" cy="8" r="6.5" fill="#E5A000"/><circle cx="8" cy="8" r="2.4" fill="#fff"/>' },
    notdue: { label: 'Not due yet',                 svg: '<circle cx="8" cy="8" r="6" fill="#fff" stroke="#2b6cb0" stroke-width="2.6"/>' },
};

const MARK_OF = {
    [PACING_STATUS.MASTERED]: 'met',
    [PACING_STATUS.BEHIND]: 'behind',
    [PACING_STATUS.TARGET_TODAY]: 'today',
};

const markSvg = (mark, size) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${MARKS[mark].svg}</svg>`;

/** "in 5d" / "Due today" / "3d past" */
function relativeDays(days) {
    if (days < 0) return `${-days}d past`;
    if (days === 0) return 'today';
    return `in ${days}d`;
}

/**
 * A Canvas ISO timestamp as a YYYY-MM-DD date in the course time zone.
 * @param {string|null} iso
 * @param {string|null} timeZone
 * @returns {string|null}
 */
function isoToCourseDate(iso, timeZone) {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime()) ? todayInTimeZone(timeZone, d) : null;
}

/**
 * Today and the timeline range for the Pace view.
 *
 * @param {Object} cache
 * @param {{ startAt?: string|null, endAt?: string|null, timeZone?: string|null }|null} courseDates
 *   from courseService.fetchCourseDates (null while loading)
 * @param {Date} [now]
 * @returns {{ today: string, start: string, end: string }}
 */
export function getPaceTimeline(cache, courseDates, now = new Date()) {
    const tz = courseDates?.timeZone ?? null;
    const today = todayInTimeZone(tz, now);
    const dates = (cache?.meta?.customOutcomePacing?.scales ?? [])
        .filter(s => s.included && isValidDate(s.date))
        .map(s => s.date);
    const range = timelineRange({
        start: isoToCourseDate(courseDates?.startAt, tz),
        end: isoToCourseDate(courseDates?.endAt, tz),
        dates,
        today,
    });
    return { today, ...range };
}

/**
 * Build the Pace view rows.
 *
 * @param {Object} outcome - the Current Score outcome
 * @param {Object} cache
 * @param {Object} opts
 * @param {string} opts.today - YYYY-MM-DD
 * @param {number} [opts.threshold]
 * @returns {{
 *   outcomes: Array<{ id: string, name: string, date: string }>,
 *   rows: Array<{ id: string, name: string, sortableName: string, behind: number, dueToday: number,
 *     items: Array<{ id: string, name: string, score: number|null, date: string, days: number, pacing: string, pending: boolean }>,
 *     next: Object|null, lastSubmitted: Object|null }>
 * }} outcomes = required, dated outcomes in the teacher's order
 */
export function buildPaceRows(outcome, cache, { today, threshold = DEFAULT_MASTERY_THRESHOLD }) {
    const { outcomes, rows } = buildCurrentScoreRows(outcome, cache);
    const studentsById = new Map((cache.students ?? []).map(s => [String(s.id), s]));
    const averagedIds = outcomes.map(o => String(o.id));
    const scales = (cache?.meta?.customOutcomePacing?.scales ?? [])
        .filter(s => s.included && isValidDate(s.date));
    const dateById = new Map(scales.map(s => [String(s.id), s.date]));
    const outcomeNames = new Map(outcomes.map(o => [String(o.id), getOutcomeDisplayName(o, cache)]));

    const paced = outcomes
        .filter(o => dateById.has(String(o.id)))
        .map(o => ({ id: String(o.id), name: outcomeNames.get(String(o.id)), date: dateById.get(String(o.id)) }));

    return {
        outcomes: paced,
        rows: rows.map(r => {
            const summary = computePacingSummary({
                scales,
                scoresByOutcomeId: new Map(r.chips.map(c => [c.outcomeId, c.score])),
                outcomeNames,
                today,
                threshold,
            });
            const pendingIds = new Set(r.chips.filter(c => c.pending).map(c => c.outcomeId));
            const items = summary.items.map(i => ({ ...i, pending: pendingIds.has(i.id) }));
            return {
                id: r.id,
                name: r.name,
                sortableName: r.sortableName,
                behind: summary.behind,
                dueToday: summary.dueToday,
                items,
                // items are in date order
                next: items.find(i => i.pacing !== PACING_STATUS.MASTERED && i.days >= 0) ?? null,
                lastSubmitted: lastSubmittedAssessment(studentsById.get(r.id), averagedIds, outcomeNames),
            };
        }),
    };
}

/**
 * The student's most recently submitted assessed assignment across the given
 * outcomes, from the outcome attempts in the cache (submission date, falling
 * back to assessment date). One assignment can assess several outcomes, so
 * it carries one score per outcome.
 *
 * @param {Object|undefined} student - cache.students entry
 * @param {string[]} outcomeIds
 * @param {Map<string, string>} [outcomeNames] - display name per outcome ID
 * @returns {{ assignmentId: string|null, assignmentName: string, timestamp: string,
 *             scores: Array<{ outcomeId: string, name: string, score: number }> }|null}
 */
export function lastSubmittedAssessment(student, outcomeIds, outcomeNames = new Map()) {
    const wanted = new Set(outcomeIds.map(String));
    const attempts = (student?.outcomes ?? [])
        .filter(od => wanted.has(String(od.outcomeId)))
        .flatMap(od => (od.attempts ?? []).map(a => ({ ...a, outcomeId: String(od.outcomeId) })))
        .filter(a => a.timestamp && !isNaN(Date.parse(a.timestamp)) && Number.isFinite(Number(a.score)));
    if (!attempts.length) return null;

    const latest = attempts.reduce((a, b) => (Date.parse(b.timestamp) > Date.parse(a.timestamp) ? b : a));
    const sameAssignment = (a) => (latest.assignmentId != null
        ? String(a.assignmentId) === String(latest.assignmentId)
        : a === latest);
    const latestByOutcome = new Map();
    attempts.filter(sameAssignment).forEach(a => {
        const prev = latestByOutcome.get(a.outcomeId);
        if (!prev || Date.parse(a.timestamp) > Date.parse(prev.timestamp)) latestByOutcome.set(a.outcomeId, a);
    });

    return {
        assignmentId: latest.assignmentId != null ? String(latest.assignmentId) : null,
        assignmentName: latest.assignmentName || 'Assignment',
        timestamp: latest.timestamp,
        scores: outcomeIds.map(String).filter(id => latestByOutcome.has(id)).map(id => ({
            outcomeId: id,
            name: outcomeNames.get(id) ?? id,
            score: Number(latestByOutcome.get(id).score),
        })),
    };
}

/**
 * Sort Pace rows (returns a new array).
 * @param {Array} rows - from buildPaceRows
 * @param {{ key: 'behind'|'next'|'name', dir: 'asc'|'desc' }} sortState
 * @param {string} today - YYYY-MM-DD
 * @returns {Array}
 */
export function sortPaceRows(rows, sortState = DEFAULT_PACE_SORT, today) {
    const key = sortState?.key ?? DEFAULT_PACE_SORT.key;
    if (key === 'next') return sortStudentRows(rows, sortState, r => (r.next ? daysUntil(r.next.date, today) : null));
    if (key === 'behind') return sortStudentRows(rows, sortState, r => r.behind + r.dueToday / 10);
    return sortStudentRows(rows, sortState, null);
}

// ─── Render ──────────────────────────────────────────────────────────────────

/** Percent across the lane; 2% padding keeps edge markers inside. */
function laneX(date, start, end) {
    const total = daysUntil(end, start) || 1;
    const frac = Math.min(1, Math.max(0, daysUntil(date, start) / total));
    return (2 + frac * 96).toFixed(2);
}

/** First of each month inside (start, end]. */
function monthStarts(start, end) {
    const out = [];
    let [y, m] = start.split('-').map(Number);
    for (;;) {
        m += 1;
        if (m > 12) { m = 1; y += 1; }
        const d = `${y}-${String(m).padStart(2, '0')}-01`;
        if (d > end) return out;
        out.push(d);
    }
}

/** Status text for a row: { pill: 'behind'|'today'|'onpace', label, next } (plain text). */
function rowStatus(row, today) {
    const pill = row.behind ? 'behind' : row.dueToday ? 'today' : 'onpace';
    const label = row.behind ? `Behind ${row.behind}` : row.dueToday ? 'Due today' : 'On pace';
    const next = row.next
        ? `Next: ${row.next.name} · ${formatTargetDate(row.next.date, { year: false })} (${relativeDays(daysUntil(row.next.date, today))})`
        : 'Nothing else due';
    return { pill, label, next };
}

/** Plain-text "Quiz 3 · Nov 12 · Outcome 1 3.00, Outcome 2 2.50" (or null). */
function lastSubmittedText(last, timeZone) {
    if (!last) return null;
    const date = formatTargetDate(isoToCourseDate(last.timestamp, timeZone), { year: false });
    const scores = last.scores.map(s => `${s.name} ${s.score.toFixed(2)}`).join(', ');
    return `${last.assignmentName} · ${date}${scores ? ` · ${scores}` : ''}`;
}

/** Most pills shown under a name; the rest are in the tooltip. */
const MAX_LAST_PILLS = 3;

/**
 * SpeedGrader URL for one student's submission, or null without both IDs.
 * @param {string|number|null} courseId
 * @param {string|number|null} assignmentId
 * @param {string|number} studentId
 * @returns {string|null}
 */
export function speedGraderUrl(courseId, assignmentId, studentId) {
    if (courseId == null || assignmentId == null) return null;
    return `/courses/${encodeURIComponent(courseId)}/gradebook/speed_grader?assignment_id=${encodeURIComponent(assignmentId)}&student_id=${encodeURIComponent(studentId)}`;
}

function renderNameCell(row, timeZone, courseId) {
    const last = row.lastSubmitted;
    const sgUrl = last ? speedGraderUrl(courseId, last.assignmentId, row.id) : null;
    const lastName = sgUrl
        ? `<a class="cs-pace-last-name" href="${escapeHtml(sgUrl)}" target="_blank" rel="noopener" title="Open in SpeedGrader">${escapeHtml(last.assignmentName)}</a>`
        : `<span class="cs-pace-last-name">${escapeHtml(last?.assignmentName ?? '')}</span>`;
    const lastHtml = last
        ? `<div class="cs-pace-last" title="${escapeHtml(`Last submitted: ${lastSubmittedText(last, timeZone)}`)}">
             ${lastName}
             <span class="cs-pace-last-date">${escapeHtml(formatTargetDate(isoToCourseDate(last.timestamp, timeZone), { year: false }))}</span>
             ${last.scores.slice(0, MAX_LAST_PILLS).map(s =>
                 `<span class="os-pill cs-pace-last-pill" style="${scoreToneStyle(scoreTone(s.score))}">${s.score.toFixed(2)}</span>`).join('')}${
             last.scores.length > MAX_LAST_PILLS ? `<span class="cs-pace-last-more">+${last.scores.length - MAX_LAST_PILLS}</span>` : ''}
           </div>`
        : '<div class="cs-pace-last cs-pace-last-none">No submissions yet</div>';
    return `<div class="cs-pace-name"><span class="os-stu-name">${escapeHtml(row.name)}</span>${lastHtml}</div>`;
}

/**
 * Stack level (0 = bottom line) per header tag so names whose positions are
 * closer than `gap` percent go on separate lines. Input sorted by position.
 * @param {number[]} positions - percent across the lane, ascending
 * @param {number} [gap]
 * @param {number} [levels]
 * @returns {number[]}
 */
export function tagLevels(positions, gap = 11, levels = 2) {
    const lastAt = new Array(levels).fill(-Infinity);
    return positions.map(p => {
        let level = lastAt.findIndex(at => p - at >= gap);
        if (level === -1) level = lastAt.indexOf(Math.min(...lastAt));
        lastAt[level] = p;
        return level;
    });
}

function renderStatusCell(row, today) {
    const { pill, label, next } = rowStatus(row, today);
    const icon = pill === 'behind' ? '✕ ' : pill === 'onpace' ? '✓ ' : '';
    return `<div class="cs-pace-status"><span class="cs-pace-pill ${pill}">${icon}${escapeHtml(label)}</span><span class="cs-pace-next">${escapeHtml(next)}</span></div>`;
}

/**
 * Render the Pace view (toolbar + timeline).
 *
 * @param {Object} outcome - the Current Score outcome
 * @param {Object} cache
 * @param {{ key: string, dir: 'asc'|'desc' }} [sortState]
 * @param {Object} [options]
 * @param {Object|null} [options.courseDates] - from courseService.fetchCourseDates
 * @param {Date} [options.now]
 * @param {number} [options.threshold]
 * @returns {string} HTML
 */
export function renderPaceView(outcome, cache, sortState = DEFAULT_PACE_SORT,
                               { courseDates = null, now = new Date(), threshold = DEFAULT_MASTERY_THRESHOLD } = {}) {
    const { today, start, end } = getPaceTimeline(cache, courseDates, now);
    const timeZone = courseDates?.timeZone ?? null;
    const { outcomes, rows } = buildPaceRows(outcome, cache, { today, threshold });

    const toolbar = renderCurrentScoreToolbar({
        sortState,
        mode: CS_MODES.PACE,
        sortOptions: [
            { value: 'behind', label: 'Behind' },
            { value: 'next', label: 'Next due' },
            { value: 'name', label: 'Student name' },
        ],
    });

    if (!outcomes.length) {
        return `${toolbar}
            <div class="os-block cs-pace-empty">No target dates yet. Choose the required outcomes and set their
              target dates in the <b>📅 Pacing</b> tab, then they appear here.</div>`;
    }

    const x = (date) => laneX(date, start, end);
    const todayX = x(today);
    const months = monthStarts(start, end);

    // Lines every lane repeats: month gridlines, the student's track, today.
    const laneBackdrop = `
        ${months.map(d => `<span class="cs-pace-month-line" style="left:${x(d)}%"></span>`).join('')}
        <span class="cs-pace-track"></span>
        <span class="cs-pace-today-line" style="left:${todayX}%"></span>`;

    // Header: month names, Today, and outcome names at their class target dates.
    const byDate = new Map();
    outcomes.forEach(o => byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]));
    const tags = [...byDate].sort(([a], [b]) => a.localeCompare(b))
        .map(([date, list]) => ({ date, names: list.map(o => o.name).join(', ') }));
    // Names only stack when they'd overlap
    const levels = tagLevels(tags.map(t => Number(x(t.date))));
    const headerLane = `
        <div class="cs-pace-lane cs-pace-lane-head">
          ${months.map(d => `<span class="cs-pace-month-line" style="left:${x(d)}%"></span>
            <span class="cs-pace-month cs-pace-head-label" style="left:${x(d)}%">${escapeHtml(formatTargetDate(d, { year: false }).split(' ')[0].toUpperCase())}</span>`).join('')}
          <span class="cs-pace-today-line" style="left:${todayX}%"></span>
          <span class="cs-pace-today cs-pace-head-label" style="left:${todayX}%">Today</span>
          ${tags.map(({ date, names }, i) => {
              const tip = `${names} — target ${formatTargetDate(date)}`;
              return `<span class="cs-pace-tag cs-pace-head-label level-${levels[i]}" style="left:${x(date)}%" title="${escapeHtml(tip)}">${escapeHtml(names)}</span>`;
          }).join('')}
        </div>`;

    const sorted = sortPaceRows(rows, sortState, today);

    const body = sorted.map(r => {
        const marks = r.items.map(i => {
            const mark = MARK_OF[i.pacing] ?? 'notdue';
            const score = i.score === null ? 'no score' : i.score.toFixed(2);
            const tip = `${r.name}, ${i.name}: target ${formatTargetDate(i.date)} · ${MARKS[mark].label} (${score})${i.pending ? ' · updating in Canvas' : ''}`;
            return `<span class="cs-pace-mk${i.pending ? ' pending' : ''}" data-oid="${escapeHtml(i.id)}" data-mark="${mark}"
                style="left:${x(i.date)}%" title="${escapeHtml(tip)}">${markSvg(mark, 18)}</span>`;
        }).join('');
        return `
            <div class="cs-pace-row" data-stu="${escapeHtml(r.id)}">
              ${renderNameCell(r, timeZone, cache?.meta?.courseId ?? null)}
              <div class="cs-pace-lane">${laneBackdrop}${marks}</div>
              ${renderStatusCell(r, today)}
            </div>`;
    }).join('');

    // Screen readers get the same information as a list.
    const srList = sorted.map(r => {
        const { label, next } = rowStatus(r, today);
        const items = r.items.map(i =>
            `${i.name} target ${formatTargetDate(i.date)}, ${MARKS[MARK_OF[i.pacing] ?? 'notdue'].label}`).join('; ');
        const last = lastSubmittedText(r.lastSubmitted, timeZone);
        return `<li>${escapeHtml(`${r.name}: ${label}. ${next}. ${items}. ${last ? `Last submitted: ${last}` : 'No submissions yet'}.`)}</li>`;
    }).join('');

    const legend = ['met', 'behind', 'today', 'notdue']
        .map(m => `<span class="cs-pace-legend-item">${markSvg(m, 12)} ${MARKS[m].label}</span>`).join('');
    const hidden = cache?.meta?.customOutcomePacing?.enabled === false
        ? ' · Pacing is hidden from students (📅 Pacing tab)'
        : '';

    return `
        ${toolbar}
        <div class="os-block cs-pace">
          <div class="cs-pace-grid" aria-hidden="true">
            <div class="cs-pace-row cs-pace-head">
              <div class="cs-pace-name"><span class="cs-pace-head-label">Student · last submitted</span></div>
              ${headerLane}
              <div class="cs-pace-status"><span class="cs-pace-head-label">Status</span></div>
            </div>
            ${body}
          </div>
          <ul class="cs-pace-sr" aria-label="Pace by student">${srList}</ul>
        </div>
        <div class="os-table-hint">${legend}<br>
          Mastered = Canvas outcome score ≥ ${threshold} · Timeline runs ${escapeHtml(formatTargetDate(start))} – ${escapeHtml(formatTargetDate(end))}
          · Every student uses the class target dates${hidden}</div>`;
}
