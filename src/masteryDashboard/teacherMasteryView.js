// src/masteryDashboard/teacherMasteryView.js
/**
 * Teacher Mastery View
 *
 * Renders a student picker for teachers on the mastery dashboard.
 * Fetches all students in the course and caches the roster for performance.
 * Uses shared student picker UI from studentPickerView.js.
 */

import { fetchCourseStudents, fetchCourseSections } from '../services/enrollmentService.js';
import { renderStudentPicker } from './studentPickerView.js';
import { logger } from '../utils/logger.js';

const ROSTER_KEY_PREFIX = 'cg_teacherRoster_';
const ROSTER_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getRosterFromCache(courseId) {
    try {
        const cached = sessionStorage.getItem(`${ROSTER_KEY_PREFIX}${courseId}`);
        if (!cached) return null;
        const { timestamp, students, sections } = JSON.parse(cached);
        if (Date.now() - timestamp > ROSTER_TTL_MS) {
            sessionStorage.removeItem(`${ROSTER_KEY_PREFIX}${courseId}`);
            logger.trace(`[TeacherMasteryView] Roster cache EXPIRED for course ${courseId}`);
            return null;
        }
        logger.debug(`[TeacherMasteryView] Roster cache HIT for course ${courseId} (${students.length} students)`);
        return { students, sections };
    } catch {
        return null;
    }
}

function saveRosterToCache(courseId, students, sections) {
    if (!students.length) return; // Don't cache a failed or empty fetch
    try {
        sessionStorage.setItem(`${ROSTER_KEY_PREFIX}${courseId}`, JSON.stringify({
            timestamp: Date.now(),
            students,
            sections
        }));
        logger.trace(`[TeacherMasteryView] Roster cached for course ${courseId} (${students.length} students)`);
    } catch {
        logger.warn(`[TeacherMasteryView] Could not cache roster — sessionStorage may be full`);
    }
}

/**
 * Render the teacher student picker into the dashboard container.
 *
 * @param {Object} options
 * @param {string|number} options.courseId - Canvas course ID
 * @param {Object} options.apiClient - CanvasApiClient instance
 * @param {HTMLElement} options.statusEl - #pm-status element
 * @param {HTMLElement} options.cardsEl - #pm-cards element
 * @param {Function} options.onStudentSelected - Callback(studentId, studentName)
 */
export async function renderTeacherMasteryView({ courseId, apiClient, statusEl, cardsEl, onStudentSelected }) {
    statusEl.textContent = "Loading student roster…";

    let students, sections;

    // Fetch from API or cache
    const cached = getRosterFromCache(courseId);
    if (cached) {
        ({ students, sections } = cached);
    } else {
        [students, sections] = await Promise.all([
            fetchCourseStudents(courseId, apiClient),
            fetchCourseSections(courseId, apiClient)
        ]);
        saveRosterToCache(courseId, students, sections);
    }

    if (students.length === 0) {
        statusEl.textContent = "No students found in this course.";
        return;
    }

    logger.info(`[TeacherMasteryView] Rendering picker for ${students.length} students`);

    statusEl.textContent = "";

    // Use shared student picker UI
    renderStudentPicker({
        students: students,
        sections: sections,
        cardsEl: cardsEl,
        onStudentSelected: onStudentSelected
    });
}