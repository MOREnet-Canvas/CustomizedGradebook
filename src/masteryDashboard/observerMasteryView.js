// src/masteryDashboard/observerMasteryView.js
/**
 * Observer Mastery View
 *
 * Renders a student picker for observers (parents) who have multiple observed students
 * in the same course. Uses ENV.OBSERVER_OPTIONS.OBSERVED_USERS_LIST to get student names
 * without requiring API calls that observers may not have permission for.
 *
 * Features:
 * - Gets observed student list from ENV or sessionStorage
 * - Shows only observed students (privacy - no access to other students)
 * - Reuses shared student picker UI from studentPickerView.js
 */

import { renderStudentPicker } from './studentPickerView.js';
import { fetchCourseSections } from '../services/enrollmentService.js';
import { logger } from '../utils/logger.js';

/**
 * Render the observer student picker into the dashboard container.
 *
 * @param {Object} options
 * @param {string|number} options.courseId - Canvas course ID
 * @param {Array} options.observerEnrollments - Array of ObserverEnrollment objects for this course
 * @param {Object} options.apiClient - CanvasApiClient instance
 * @param {HTMLElement} options.statusEl - #pm-status element
 * @param {HTMLElement} options.cardsEl - #pm-cards element
 * @param {Function} options.onStudentSelected - Callback(studentId, studentName)
 */
export async function renderObserverMasteryView({ courseId, observerEnrollments, apiClient, statusEl, cardsEl, onStudentSelected }) {
    statusEl.textContent = "Loading observed students…";

    // Try to get observed users list from ENV (most reliable source)
    let observedUsersList = ENV?.OBSERVER_OPTIONS?.OBSERVED_USERS_LIST;
    
    if (observedUsersList) {
        logger.debug(`[ObserverMasteryView] Found ${observedUsersList.length} observed users in ENV.OBSERVER_OPTIONS`);
        
        // Store in sessionStorage for future use (SPA navigation)
        try {
            sessionStorage.setItem('cg_observed_users', JSON.stringify(observedUsersList));
        } catch (e) {
            logger.warn('[ObserverMasteryView] Failed to store observed users in sessionStorage:', e);
        }
    } else {
        // Fallback to sessionStorage if ENV not available
        const cached = sessionStorage.getItem('cg_observed_users');
        if (cached) {
            try {
                observedUsersList = JSON.parse(cached);
                logger.debug(`[ObserverMasteryView] Found ${observedUsersList.length} observed users in sessionStorage`);
            } catch (e) {
                logger.warn('[ObserverMasteryView] Failed to parse cached observed users:', e);
                observedUsersList = null;
            }
        }
    }

    // Build student list from observer enrollments
    const observedStudents = observerEnrollments.map(enrollment => {
        const userId = String(enrollment.associated_user_id);
        
        // Try to get name from observedUsersList first (no API call needed!)
        const userInfo = observedUsersList?.find(u => String(u.id) === userId);
        
        return {
            userId: userId,
            name: userInfo?.name || `Student ${userId}`,
            sortableName: userInfo?.sortable_name || userInfo?.name || `Student ${userId}`,
            sectionId: String(enrollment.course_section_id)
        };
    });

    logger.info(`[ObserverMasteryView] Rendering picker for ${observedStudents.length} observed students`);

    // Fetch sections for the course
    const sections = await fetchCourseSections(courseId, apiClient);

    statusEl.textContent = "";
    
    // Use shared student picker UI
    renderStudentPicker({
        students: observedStudents,
        sections: sections,
        cardsEl: cardsEl,
        onStudentSelected: onStudentSelected
    });
}

