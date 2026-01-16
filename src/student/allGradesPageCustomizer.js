// src/student/allGradesPageCustomizer.js
/**
 * All-Grades Page Customizer Module
 * 
 * Customizes the all-grades page (/grades) to display converted point values
 * for standards-based courses while preserving percentages for traditional courses.
 * 
 * Features:
 * - Detects standards-based courses via course name patterns and AVG Assignment presence
 * - Converts percentage grades to 0-4 point scale for standards-based courses
 * - Displays letter grades alongside numeric scores (e.g., "2.57 (Developing)")
 * - Replaces Canvas grades table with enhanced custom table
 * - Caches detection results for performance
 * 
 * Data Source Strategy:
 * - Primary: Enrollments API (/api/v1/users/self/enrollments) - single call, includes grades
 * - Fallback: DOM parsing if API fails
 */

import { logger } from '../utils/logger.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import {
    AVG_ASSIGNMENT_NAME,
    DEFAULT_MAX_POINTS,
    STANDARDS_BASED_COURSE_PATTERNS,
    OUTCOME_AND_RUBRIC_RATINGS
} from '../config.js';
import { scoreToGradeLevel } from './gradeExtractor.js';

/**
 * Track if customizations have been applied
 */
let processed = false;

/**
 * Convert percentage score to point value
 * @param {number} percentage - Percentage score (0-100)
 * @returns {number} Point value (0-DEFAULT_MAX_POINTS scale)
 */
function percentageToPoints(percentage) {
    return (percentage / 100) * DEFAULT_MAX_POINTS;
}

/**
 * Format grade display with score and letter grade
 * @param {number} score - Numeric score
 * @param {string|null} letterGrade - Letter grade description
 * @returns {string} Formatted display string
 */
function formatGradeDisplay(score, letterGrade) {
    const scoreStr = score.toFixed(2);
    if (letterGrade) {
        return `${scoreStr} (${letterGrade})`;
    }
    return scoreStr;
}

/**
 * Detect if a course uses standards-based grading
 * Checks:
 * 1. Course name patterns (from config)
 * 2. Presence of AVG Assignment
 * 
 * @param {string} courseId - Course ID
 * @param {string} courseName - Course name
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<boolean>} True if standards-based
 */
async function detectStandardsBasedCourse(courseId, courseName, apiClient) {
    // Check cache first
    const cacheKey = `standardsBased_${courseId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
        return cached === 'true';
    }

    // 1. Check course name patterns
    const matchesPattern = STANDARDS_BASED_COURSE_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') {
            return courseName.toLowerCase().includes(pattern.toLowerCase());
        } else if (pattern instanceof RegExp) {
            return pattern.test(courseName);
        }
        return false;
    });

    if (matchesPattern) {
        logger.debug(`Course "${courseName}" matches standards-based pattern`);
        sessionStorage.setItem(cacheKey, 'true');
        return true;
    }

    // 2. Check for AVG Assignment
    try {
        const assignments = await apiClient.get(
            `/api/v1/courses/${courseId}/assignments`,
            { search_term: AVG_ASSIGNMENT_NAME },
            'checkAvgAssignment'
        );
        
        const hasAvgAssignment = assignments.some(a => a.name === AVG_ASSIGNMENT_NAME);
        if (hasAvgAssignment) {
            logger.debug(`Course "${courseName}" has AVG Assignment`);
            sessionStorage.setItem(cacheKey, 'true');
            return true;
        }
    } catch (error) {
        logger.warn(`Could not check assignments for course ${courseId}:`, error.message);
    }

    // Not standards-based
    sessionStorage.setItem(cacheKey, 'false');
    return false;
}

/**
 * Fetch course grade data using Enrollments API
 * @param {CanvasApiClient} apiClient - API client instance
 * @returns {Promise<Array>} Array of course grade objects
 */
async function fetchCourseGradesFromAPI(apiClient) {
    const startTime = performance.now();
    
    try {
        // Fetch all active student enrollments with grades
        const enrollments = await apiClient.get(
            '/api/v1/users/self/enrollments',
            {
                'type[]': 'StudentEnrollment',
                'state[]': 'active',
                'include[]': 'total_scores'
            },
            'fetchAllGrades'
        );

        logger.debug(`Fetched ${enrollments.length} enrollments in ${(performance.now() - startTime).toFixed(2)}ms`);

        // Process enrollments in parallel
        const coursePromises = enrollments.map(async (enrollment) => {
            const courseId = enrollment.course_id?.toString();
            if (!courseId) return null;

            const grades = enrollment.grades || {};
            const percentage = grades.current_score ?? grades.final_score ?? null;
            const canvasLetterGrade = grades.current_grade ?? grades.final_grade ?? null;

            // Get course name
            let courseName = 'Unknown Course';
            if (enrollment.course?.name) {
                courseName = enrollment.course.name;
            } else {
                // Fetch course details if not included
                try {
                    const course = await apiClient.get(
                        `/api/v1/courses/${courseId}`,
                        {},
                        'getCourseDetails'
                    );
                    courseName = course.name || courseName;
                } catch (error) {
                    logger.warn(`Could not fetch course name for ${courseId}`);
                }
            }

            // Detect if standards-based
            const isStandardsBased = await detectStandardsBasedCourse(courseId, courseName, apiClient);

            // Calculate display values
            let displayScore = percentage;
            let displayLetterGrade = canvasLetterGrade;
            let displayType = 'percentage'; // 'percentage' or 'points'

            if (isStandardsBased && percentage !== null) {
                // Convert percentage to points
                const pointValue = percentageToPoints(percentage);
                displayScore = pointValue;
                displayType = 'points';

                // Calculate letter grade from point value
                displayLetterGrade = scoreToGradeLevel(pointValue);
            }

            return {
                courseId,
                courseName,
                percentage,
                displayScore,
                displayLetterGrade,
                displayType,
                isStandardsBased,
                courseUrl: `/courses/${courseId}/grades`
            };
        });

        const results = await Promise.all(coursePromises);
        const courses = results.filter(c => c !== null);

        logger.info(`Processed ${courses.length} courses in ${(performance.now() - startTime).toFixed(2)}ms`);
        return courses;

    } catch (error) {
        logger.error('Failed to fetch course grades from API:', error);
        throw error;
    }
}

/**
 * Fetch course grade data by parsing DOM (fallback method)
 * @returns {Promise<Array>} Array of course grade objects
 */
async function fetchCourseGradesFromDOM() {
    const startTime = performance.now();
    const apiClient = new CanvasApiClient();

    try {
        // Find the grades table
        const table = document.querySelector('table.course_details.student_grades');
        if (!table) {
            throw new Error('Grades table not found in DOM');
        }

        // Extract course rows
        const rows = table.querySelectorAll('tbody tr');
        logger.debug(`Found ${rows.length} course rows in DOM`);

        const coursePromises = Array.from(rows).map(async (row) => {
            // Find course link
            const courseLink = row.querySelector('a[href*="/courses/"]');
            if (!courseLink) return null;

            const courseName = courseLink.textContent.trim();
            const href = courseLink.getAttribute('href');
            const courseIdMatch = href.match(/\/courses\/(\d+)/);
            if (!courseIdMatch) return null;

            const courseId = courseIdMatch[1];

            // Extract grade percentage
            const gradeCell = row.querySelector('.grade');
            const gradeText = gradeCell?.textContent.trim() || '';
            const percentageMatch = gradeText.match(/(\d+(?:\.\d+)?)\s*%/);
            const percentage = percentageMatch ? parseFloat(percentageMatch[1]) : null;

            // Detect if standards-based
            const isStandardsBased = await detectStandardsBasedCourse(courseId, courseName, apiClient);

            // Calculate display values
            let displayScore = percentage;
            let displayLetterGrade = null;
            let displayType = 'percentage';

            if (isStandardsBased && percentage !== null) {
                const pointValue = percentageToPoints(percentage);
                displayScore = pointValue;
                displayType = 'points';
                displayLetterGrade = scoreToGradeLevel(pointValue);
            }

            return {
                courseId,
                courseName,
                percentage,
                displayScore,
                displayLetterGrade,
                displayType,
                isStandardsBased,
                courseUrl: `/courses/${courseId}/grades`
            };
        });

        const results = await Promise.all(coursePromises);
        const courses = results.filter(c => c !== null);

        logger.info(`Processed ${courses.length} courses from DOM in ${(performance.now() - startTime).toFixed(2)}ms`);
        return courses;

    } catch (error) {
        logger.error('Failed to fetch course grades from DOM:', error);
        throw error;
    }
}

/**
 * Fetch course grade data with fallback strategy
 * @returns {Promise<Array>} Array of course grade objects
 */
async function fetchCourseGrades() {
    const apiClient = new CanvasApiClient();

    try {
        // Try API approach first
        logger.debug('Fetching course grades via Enrollments API...');
        return await fetchCourseGradesFromAPI(apiClient);
    } catch (error) {
        logger.warn('API approach failed, falling back to DOM parsing:', error.message);

        try {
            // Fallback to DOM parsing
            return await fetchCourseGradesFromDOM();
        } catch (domError) {
            logger.error('Both API and DOM approaches failed:', domError);
            throw new Error('Could not fetch course grades');
        }
    }
}

/**
 * Create enhanced grades table
 * @param {Array} courses - Array of course grade objects
 * @returns {HTMLElement} Table element
 */
function createGradesTable(courses) {
    const table = document.createElement('table');
    table.className = 'ic-Table ic-Table--hover-row ic-Table--striped customized-grades-table';
    table.style.cssText = 'width: 100%; margin-top: 1rem;';

    // Create table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="ic-Table-header" style="text-align: left; padding: 0.75rem;">Course</th>
            <th class="ic-Table-header" style="text-align: right; padding: 0.75rem;">Grade</th>
            <th class="ic-Table-header" style="text-align: center; padding: 0.75rem;">Type</th>
        </tr>
    `;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');

    for (const course of courses) {
        const row = document.createElement('tr');
        row.className = 'ic-Table-row';

        // Course name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'ic-Table-cell';
        nameCell.style.padding = '0.75rem';

        const courseLink = document.createElement('a');
        courseLink.href = course.courseUrl;
        courseLink.textContent = course.courseName;
        courseLink.style.cssText = 'color: #0374B5; text-decoration: none;';
        courseLink.addEventListener('mouseenter', () => {
            courseLink.style.textDecoration = 'underline';
        });
        courseLink.addEventListener('mouseleave', () => {
            courseLink.style.textDecoration = 'none';
        });

        nameCell.appendChild(courseLink);

        // Grade cell
        const gradeCell = document.createElement('td');
        gradeCell.className = 'ic-Table-cell';
        gradeCell.style.cssText = 'text-align: right; padding: 0.75rem; font-weight: bold;';

        if (course.displayScore !== null) {
            if (course.displayType === 'points') {
                // Standards-based: show points with letter grade
                gradeCell.textContent = formatGradeDisplay(course.displayScore, course.displayLetterGrade);
                gradeCell.style.color = '#0B874B'; // Green for standards-based
            } else {
                // Traditional: show percentage
                gradeCell.textContent = `${course.displayScore.toFixed(2)}%`;
                gradeCell.style.color = '#2D3B45'; // Default color
            }
        } else {
            gradeCell.textContent = 'N/A';
            gradeCell.style.color = '#73818C'; // Gray for no grade
        }

        // Type cell
        const typeCell = document.createElement('td');
        typeCell.className = 'ic-Table-cell';
        typeCell.style.cssText = 'text-align: center; padding: 0.75rem; font-size: 0.875rem;';

        if (course.isStandardsBased) {
            const badge = document.createElement('span');
            badge.textContent = 'Standards';
            badge.style.cssText = `
                background-color: #E5F3ED;
                color: #0B874B;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-weight: 600;
            `;
            typeCell.appendChild(badge);
        } else {
            typeCell.textContent = 'Traditional';
            typeCell.style.color = '#73818C';
        }

        row.appendChild(nameCell);
        row.appendChild(gradeCell);
        row.appendChild(typeCell);
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    return table;
}

/**
 * Replace the original grades table with enhanced version
 * @param {Array} courses - Array of course grade objects
 */
function replaceGradesTable(courses) {
    // Find the original table
    const originalTable = document.querySelector('table.course_details.student_grades');
    if (!originalTable) {
        logger.warn('Original grades table not found');
        return;
    }

    // Hide original table
    originalTable.style.display = 'none';
    originalTable.dataset.customized = 'true';

    // Create and insert new table
    const newTable = createGradesTable(courses);
    newTable.id = 'customized-grades-table';

    // Insert after original table
    originalTable.parentNode.insertBefore(newTable, originalTable.nextSibling);

    logger.info(`Replaced grades table with ${courses.length} courses`);
}

/**
 * Apply all customizations to the all-grades page
 */
async function applyCustomizations() {
    if (processed) {
        logger.debug('All-grades customizations already applied');
        return;
    }

    try {
        logger.info('Applying all-grades page customizations...');

        // Fetch course grades
        const courses = await fetchCourseGrades();

        if (courses.length === 0) {
            logger.warn('No courses found, skipping customization');
            return;
        }

        // Replace table
        replaceGradesTable(courses);

        // Log statistics
        const standardsBasedCount = courses.filter(c => c.isStandardsBased).length;
        const traditionalCount = courses.length - standardsBasedCount;
        logger.info(`Customization complete: ${standardsBasedCount} standards-based, ${traditionalCount} traditional courses`);

        processed = true;

    } catch (error) {
        logger.error('Failed to apply all-grades customizations:', error);
        // Don't set processed = true so it can retry
    }
}

/**
 * Initialize all-grades page customizer
 * Sets up observers to handle lazy-loaded content
 */
export function initAllGradesPageCustomizer() {
    logger.debug('Initializing all-grades page customizer');

    // Try immediately
    applyCustomizations();

    // Also observe for lazy-loaded content
    const observer = new MutationObserver(() => {
        const table = document.querySelector('table.course_details.student_grades');
        if (table && !table.dataset.customized && !processed) {
            logger.debug('Grades table detected, applying customizations...');
            applyCustomizations();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Safety stop after 30s
    setTimeout(() => {
        observer.disconnect();
        logger.trace('All-grades customization observer disconnected (timeout)');
    }, 30000);
}

