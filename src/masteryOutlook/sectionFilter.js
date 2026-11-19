// src/masteryOutlook/sectionFilter.js
/**
 * Mastery Outlook section filter.
 *
 * The teacher picks one course section (or All sections) in the top bar. Every
 * view then shows only that section's students, class numbers (Canvas avg,
 * spread, below threshold, sync counts, tab counts, metric cards) are worked
 * out from those students, and "Save grades to Canvas" sends only their rows.
 *
 * Only what's drawn is filtered. cache.students always holds the whole
 * roster, and every cache write, background refresh, and Current Score
 * update stays course-wide. Read students for display with visibleStudents(cache).
 *
 * The choice is remembered per course in this browser (localStorage).
 * A student enrolled in several sections appears under each of them
 * (student.sectionIds, set by enrichCache from the roster).
 */

import { logger } from '../utils/logger.js';
import { computeCanvasClassStats } from './masteryOutlookDataService.js';

const STORAGE_KEY = (courseId) => `cg_mo_section_${courseId}`;

/** @type {{ courseId: string|null, sections: Array<{id: string, name: string}>, selectedId: string|null }} */
const filter = { courseId: null, sections: [], selectedId: null };

/**
 * Set the course's sections and restore the saved choice for this course.
 * A saved section that no longer exists falls back to All sections.
 *
 * @param {string|number} courseId
 * @param {Array<{id: string|number, name: string}>} sections - from fetchCourseSections
 * @returns {string|null} the selected section ID (null = all)
 */
export function initSectionFilter(courseId, sections) {
    filter.courseId = String(courseId);
    filter.sections = (sections ?? []).map(s => ({ id: String(s.id), name: s.name ?? `Section ${s.id}` }));
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY(courseId)); } catch { /* storage blocked */ }
    filter.selectedId = saved && filter.sections.some(s => s.id === saved) ? saved : null;
    return filter.selectedId;
}

/** @returns {Array<{id: string, name: string}>} the course's sections */
export function getCourseSections() {
    return filter.sections;
}

/** True when the course has more than one section, so the filter is worth showing. */
export function hasSectionChoice() {
    return filter.sections.length > 1;
}

/** @returns {string|null} selected section ID, or null for All sections */
export function getSelectedSectionId() {
    return filter.selectedId;
}

/** @returns {string|null} selected section's name, or null for All sections */
export function getSelectedSectionName() {
    return filter.sections.find(s => s.id === filter.selectedId)?.name ?? null;
}

/**
 * Choose a section (null / '' = All sections) and remember it for this course.
 * @param {string|null} sectionId
 */
export function setSelectedSectionId(sectionId) {
    const id = sectionId ? String(sectionId) : null;
    filter.selectedId = id && filter.sections.some(s => s.id === id) ? id : null;
    try {
        if (filter.selectedId) localStorage.setItem(STORAGE_KEY(filter.courseId), filter.selectedId);
        else localStorage.removeItem(STORAGE_KEY(filter.courseId));
    } catch { /* storage blocked */ }
    logger.debug(`[MasteryOutlook] Section filter: ${filter.selectedId ?? 'all sections'}`);
}

/** Back to no filter and no sections (tests, or leaving the page). */
export function resetSectionFilter() {
    filter.courseId = null;
    filter.sections = [];
    filter.selectedId = null;
}

/**
 * Section IDs a student is enrolled in.
 * @param {Object} student - cache.students entry
 * @returns {string[]}
 */
export function studentSectionIds(student) {
    if (Array.isArray(student?.sectionIds)) return student.sectionIds.map(String);
    return student?.sectionId != null ? [String(student.sectionId)] : [];
}

/**
 * True when the student is shown under the current filter.
 * @param {Object} student - cache.students entry
 * @returns {boolean}
 */
export function isStudentVisible(student) {
    return !filter.selectedId || studentSectionIds(student).includes(filter.selectedId);
}

/**
 * The students to draw: the selected section's, or everyone.
 * Display only. Never write the result back to the cache.
 * @param {Object} cache
 * @returns {Object[]}
 */
export function visibleStudents(cache) {
    const students = cache?.students ?? [];
    return filter.selectedId ? students.filter(isStudentVisible) : students;
}

/**
 * An outcome's class stats for display. Unfiltered: the stored
 * outcome.classStats. Filtered: Canvas avg / spread / below threshold from the
 * visible students' Canvas scores, Marzano trend (avgSlope) from their slopes.
 *
 * @param {Object} outcome - cache.outcomes entry
 * @param {Object} cache
 * @returns {Object} classStats-shaped object
 */
export function displayClassStats(outcome, cache) {
    const stored = outcome?.classStats ?? {};
    if (!filter.selectedId) return stored;

    const students = visibleStudents(cache);
    const oid = String(outcome.id);
    const slopes = students
        .map(s => s.outcomes?.find(o => String(o.outcomeId) === oid)?.slope)
        .filter(v => v !== null && v !== undefined);
    return {
        ...stored,
        ...computeCanvasClassStats(oid, students, stored.computedThreshold),
        avgSlope: slopes.length ? parseFloat((slopes.reduce((a, b) => a + b, 0) / slopes.length).toFixed(4)) : null,
        totalStudents: students.length,
    };
}
