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
import { initCleanupObservers } from './cleanupObserver.js';
import { logger } from '../utils/logger.js';

/**
 * Check if current page is a student grades page
 * @returns {boolean} True if on student grades page
 */
function isStudentGradesPage() {
    return (
        window.location.href.includes('/courses/') &&
        window.location.pathname.includes('/grades')
    );
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
    
    // Initialize grade page customizer (only on grades pages)
    if (isStudentGradesPage()) {
        logger.debug('On student grades page, initializing grade page customizer');
        initGradePageCustomizer();
    }
    
    // Initialize cleanup observers (runs on dashboard and course pages)
    initCleanupObservers();
}

