// src/student/studentGradeCustomization.js
/**
 * Student Grade Customization Module
 * 
 * Main entry point for all student-facing grade customizations.
 * Coordinates the initialization of:
 * - Grade page customization (removing assignment tab, showing mastery score)
 * - Grade normalization (removing fractions from scores)
 * 
 * This module only runs for student-like users when ENABLE_STUDENT_GRADE_CUSTOMIZATION is true.
 */

import { ENABLE_STUDENT_GRADE_CUSTOMIZATION } from '../config.js';
import { getUserRoleGroup } from '../utils/canvas.js';
import { initGradePageCustomizer } from './gradePageCustomizer.js';
import { initAllGradesPageCustomizer } from './allGradesPageCustomizer.js';
import { initCleanupObservers } from './cleanupObserver.js';
import { logger } from '../utils/logger.js';

/**
 * Check if current page is a single-course grades page
 * @returns {boolean} True if on single-course grades page
 */
function isSingleCourseGradesPage() {
    return (
        window.location.href.includes('/courses/') &&
        window.location.pathname.includes('/grades')
    );
}

/**
 * Check if current page is the all-grades page
 * @returns {boolean} True if on all-grades page
 */
function isAllGradesPage() {
    const path = window.location.pathname;
    // All-grades page is /grades without /courses/ in the path
    return path === '/grades' || (path.includes('/grades') && !path.includes('/courses/'));
}

/**
 * Initialize all student grade customizations
 * This is the main entry point called from customGradebookInit.js
 */
export function initStudentGradeCustomization() {
    // Check if feature is enabled
    if (!ENABLE_STUDENT_GRADE_CUSTOMIZATION) {
        logger.debug('Student grade customization disabled');
        return;
    }
    
    // Check if user is a student
    const roleGroup = getUserRoleGroup();
    if (roleGroup !== 'student_like') {
        logger.debug('User is not student-like, skipping student customizations');
        return;
    }
    
    logger.info('Initializing student grade customizations');

    // Route to appropriate customizer based on page type
    if (isAllGradesPage()) {
        logger.debug('On all-grades page, initializing all-grades customizer');
        initAllGradesPageCustomizer();
    } else if (isSingleCourseGradesPage()) {
        logger.debug('On single-course grades page, initializing grade page customizer');
        initGradePageCustomizer();
    }

    // Initialize cleanup observers (runs on dashboard and course pages)
    initCleanupObservers();
}

