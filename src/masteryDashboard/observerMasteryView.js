// src/masteryDashboard/observerMasteryView.js
/**
 * Observer Mastery View
 *
 * Renders a student picker for observers (parents) who have multiple observed students
 * in the same course. Uses Canvas API to get student names reliably.
 *
 * Features:
 * - Fetches observed student list from Canvas API
 * - Auto-selects first student (or last selected from localStorage)
 * - Remembers selection across page loads
 * - Shows only observed students (privacy - no access to other students)
 * - Reuses shared student picker UI from studentPickerView.js
 */

import { renderStudentPicker } from './studentPickerView.js';
import { fetchObservedStudents, fetchCourseSections } from '../services/enrollmentService.js';
import { logger } from '../utils/logger.js';

const SELECTED_STUDENT_KEY_PREFIX = 'cg_observer_selected_';

/**
 * Render the observer student picker into the dashboard container.
 *
 * @param {Object} options
 * @param {string|number} options.courseId - Canvas course ID
 * @param {Object} options.apiClient - CanvasApiClient instance
 * @param {HTMLElement} options.statusEl - #pm-status element
 * @param {HTMLElement} options.cardsEl - #pm-cards element
 * @param {Function} options.onStudentSelected - Callback(studentId, studentName)
 */
export async function renderObserverMasteryView({ courseId, apiClient, statusEl, cardsEl, onStudentSelected }) {
    statusEl.textContent = "Loading observed students…";

    // Fetch observed students from Canvas API (includes names from observed_users)
    const [observedStudents, sections] = await Promise.all([
        fetchObservedStudents(courseId, apiClient),
        fetchCourseSections(courseId, apiClient)
    ]);

    if (observedStudents.length === 0) {
        statusEl.textContent = "No observed students found in this course.";
        logger.warn('[ObserverMasteryView] No observed students found');
        return;
    }

    logger.info(`[ObserverMasteryView] Found ${observedStudents.length} observed students`);

    // Check localStorage for last selected student
    const storageKey = `${SELECTED_STUDENT_KEY_PREFIX}${courseId}`;
    const lastSelectedId = localStorage.getItem(storageKey);

    // Find the student to auto-select
    let studentToSelect = null;
    if (lastSelectedId) {
        studentToSelect = observedStudents.find(s => s.userId === lastSelectedId);
        if (studentToSelect) {
            logger.debug(`[ObserverMasteryView] Auto-selecting last selected student: ${studentToSelect.name}`);
        }
    }

    // If no last selection or student not found, select first student (alphabetically)
    if (!studentToSelect) {
        const sortedStudents = [...observedStudents].sort((a, b) => a.sortableName.localeCompare(b.sortableName));
        studentToSelect = sortedStudents[0];
        logger.debug(`[ObserverMasteryView] Auto-selecting first student: ${studentToSelect.name}`);
    }

    statusEl.textContent = "";

    // Wrap the onStudentSelected callback to save selection to localStorage
    const wrappedCallback = (selectedStudentId, selectedStudentName) => {
        try {
            localStorage.setItem(storageKey, selectedStudentId);
            logger.trace(`[ObserverMasteryView] Saved student selection: ${selectedStudentId}`);
        } catch (e) {
            logger.warn('[ObserverMasteryView] Failed to save student selection to localStorage:', e);
        }
        onStudentSelected(selectedStudentId, selectedStudentName);
    };

    // Use shared student picker UI
    renderStudentPicker({
        students: observedStudents,
        sections: sections,
        cardsEl: cardsEl,
        onStudentSelected: wrappedCallback,
        autoSelectStudent: studentToSelect  // Pass student to auto-select
    });
}