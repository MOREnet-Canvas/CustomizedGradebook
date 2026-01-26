// src/student/allGradesDataSourceTest.js
/**
 * All-Grades Page Data Source Testing Module
 *
 * NOTE: This module is for testing and comparison purposes only.
 * The actual implementation now uses a hybrid approach (see allGradesPageCustomizer.js).
 *
 * This module tests and compares two legacy approaches for fetching course grade data:
 * 1. DOM Parsing + Individual Course API Calls
 * 2. Single Enrollments API Call + Course Metadata
 *
 * Run this module on the all-grades page (/grades) to compare performance,
 * reliability, and data completeness.
 *
 * Usage:
 * - Open browser console on /grades page
 * - Run: window.CG_testAllGradesDataSources()
 */

import { logger } from '../utils/logger.js';
import { AVG_ASSIGNMENT_NAME, AVG_OUTCOME_NAME, STANDARDS_BASED_COURSE_PATTERNS } from '../config.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import { determineCourseModel } from '../utils/courseDetection.js';
import { extractCourseDataFromRow, findTableRows } from '../utils/domExtractors.js';

/**
 * Approach 1: DOM Parsing + Individual Course API Calls
 * Extracts course data from the existing table, then makes API calls to detect standards-based courses
 */
async function testDOMParsingApproach() {
    const startTime = performance.now();
    const results = {
        approach: 'DOM Parsing + Individual API Calls',
        courses: [],
        errors: [],
        metrics: {}
    };

    try {
        // Use shared DOM extraction utility to find table rows
        const rows = findTableRows();
        if (rows.length === 0) {
            throw new Error('Grades table not found or has no rows');
        }

        logger.info(`[DOM Approach] Found ${rows.length} course rows`);

        const apiClient = new CanvasApiClient();
        const coursePromises = [];

        for (const row of rows) {
            coursePromises.push(extractCourseFromRow(row, apiClient));
        }

        // Process all courses in parallel
        const courseResults = await Promise.allSettled(coursePromises);
        
        for (const result of courseResults) {
            if (result.status === 'fulfilled' && result.value) {
                results.courses.push(result.value);
            } else if (result.status === 'rejected') {
                results.errors.push(result.reason.message);
            }
        }

    } catch (error) {
        results.errors.push(error.message);
        logger.error('[DOM Approach] Fatal error:', error);
    }

    const endTime = performance.now();
    results.metrics = {
        totalTime: endTime - startTime,
        coursesFound: results.courses.length,
        errorCount: results.errors.length,
        avgTimePerCourse: results.courses.length > 0 ? (endTime - startTime) / results.courses.length : 0
    };

    return results;
}

/**
 * Extract course data from a table row
 */
async function extractCourseFromRow(row, apiClient) {
    // Use shared DOM extraction utility
    const courseData = extractCourseDataFromRow(row);
    if (!courseData) return null;

    const { courseId, courseName, percentage } = courseData;

    // Detect if standards-based
    const detectionStart = performance.now();
    const isStandardsBased = await detectStandardsBasedCourse(courseId, courseName, apiClient);
    const detectionTime = performance.now() - detectionStart;

    return {
        courseId,
        courseName,
        percentage,
        isStandardsBased,
        detectionTime,
        source: 'DOM'
    };
}

/**
 * Approach 2: Single Enrollments API Call
 * Fetches all enrollments with grades in a single API call
 */
async function testEnrollmentsAPIApproach() {
    const startTime = performance.now();
    const results = {
        approach: 'Enrollments API',
        courses: [],
        errors: [],
        metrics: {}
    };

    try {
        const apiClient = new CanvasApiClient();
        
        // Fetch all enrollments with total scores
        const apiCallStart = performance.now();
        const enrollments = await apiClient.get(
            '/api/v1/users/self/enrollments',
            {
                'type[]': 'StudentEnrollment',
                'state[]': 'active',
                'include[]': 'total_scores'
            },
            'testEnrollmentsAPI'
        );
        const apiCallTime = performance.now() - apiCallStart;

        logger.info(`[API Approach] Fetched ${enrollments.length} enrollments in ${apiCallTime.toFixed(2)}ms`);

        // Process enrollments in parallel
        const coursePromises = enrollments.map(enrollment => 
            processCourseFromEnrollment(enrollment, apiClient)
        );

        const courseResults = await Promise.allSettled(coursePromises);
        
        for (const result of courseResults) {
            if (result.status === 'fulfilled' && result.value) {
                results.courses.push(result.value);
            } else if (result.status === 'rejected') {
                results.errors.push(result.reason.message);
            }
        }

    } catch (error) {
        results.errors.push(error.message);
        logger.error('[API Approach] Fatal error:', error);
    }

    const endTime = performance.now();
    results.metrics = {
        totalTime: endTime - startTime,
        coursesFound: results.courses.length,
        errorCount: results.errors.length,
        avgTimePerCourse: results.courses.length > 0 ? (endTime - startTime) / results.courses.length : 0
    };

    return results;
}

/**
 * Process course data from enrollment object
 */
async function processCourseFromEnrollment(enrollment, apiClient) {
    const courseId = enrollment.course_id?.toString();
    if (!courseId) return null;

    // Extract grade data
    const grades = enrollment.grades || {};
    const percentage = grades.current_score ?? grades.final_score ?? null;

    // Get course name from enrollment or fetch it
    let courseName = enrollment.course?.name;
    if (!courseName) {
        // Need to fetch course details
        try {
            const course = await apiClient.get(
                `/api/v1/courses/${courseId}`,
                {},
                'getCourseDetails'
            );
            courseName = course.name;
        } catch (error) {
            logger.warn(`[API Approach] Could not fetch course name for ${courseId}:`, error.message);
            courseName = `Course ${courseId}`;
        }
    }

    // Detect if standards-based
    const detectionStart = performance.now();
    const isStandardsBased = await detectStandardsBasedCourse(courseId, courseName, apiClient);
    const detectionTime = performance.now() - detectionStart;

    return {
        courseId,
        courseName,
        percentage,
        isStandardsBased,
        detectionTime,
        source: 'API',
        letterGrade: grades.current_grade ?? grades.final_grade ?? null
    };
}

/**
 * Detect if a course uses standards-based grading
 * Uses the shared determineCourseModel function
 */
async function detectStandardsBasedCourse(courseId, courseName, apiClient) {
    const classification = await determineCourseModel(
        { courseId, courseName },
        null,
        { apiClient }
    );

    return classification.model === 'standards';
}

/**
 * Compare both approaches and display results
 */
export async function compareDataSourceApproaches() {
    logger.info('='.repeat(80));
    logger.info('ALL-GRADES PAGE DATA SOURCE COMPARISON TEST');
    logger.info('='.repeat(80));

    // Run both approaches
    logger.info('\n📊 Running DOM Parsing Approach...');
    const domResults = await testDOMParsingApproach();

    logger.info('\n📊 Running Enrollments API Approach...');
    const apiResults = await testEnrollmentsAPIApproach();

    // Display comparison
    logger.info('\n' + '='.repeat(80));
    logger.info('COMPARISON RESULTS');
    logger.info('='.repeat(80));

    console.table([
        {
            Approach: domResults.approach,
            'Total Time (ms)': domResults.metrics.totalTime.toFixed(2),
            'Courses Found': domResults.metrics.coursesFound,
            'Errors': domResults.metrics.errorCount,
            'Avg Time/Course (ms)': domResults.metrics.avgTimePerCourse.toFixed(2)
        },
        {
            Approach: apiResults.approach,
            'Total Time (ms)': apiResults.metrics.totalTime.toFixed(2),
            'Courses Found': apiResults.metrics.coursesFound,
            'Errors': apiResults.metrics.errorCount,
            'Avg Time/Course (ms)': apiResults.metrics.avgTimePerCourse.toFixed(2)
        }
    ]);

    // Detailed course comparison
    logger.info('\n📋 Course Details (DOM Approach):');
    console.table(domResults.courses.map(c => ({
        'Course ID': c.courseId,
        'Course Name': c.courseName.substring(0, 40),
        'Percentage': c.percentage,
        'Standards-Based': c.isStandardsBased,
        'Detection Time (ms)': c.detectionTime.toFixed(2)
    })));

    logger.info('\n📋 Course Details (API Approach):');
    console.table(apiResults.courses.map(c => ({
        'Course ID': c.courseId,
        'Course Name': c.courseName.substring(0, 40),
        'Percentage': c.percentage,
        'Standards-Based': c.isStandardsBased,
        'Letter Grade': c.letterGrade,
        'Detection Time (ms)': c.detectionTime.toFixed(2)
    })));

    // Recommendation
    logger.info('\n' + '='.repeat(80));
    logger.info('RECOMMENDATION');
    logger.info('='.repeat(80));

    const recommendation = generateRecommendation(domResults, apiResults);
    logger.info(recommendation);

    return { domResults, apiResults, recommendation };
}

/**
 * Generate recommendation based on test results
 */
function generateRecommendation(domResults, apiResults) {
    const timeDiff = domResults.metrics.totalTime - apiResults.metrics.totalTime;
    const timeDiffPercent = (timeDiff / domResults.metrics.totalTime) * 100;

    let recommendation = '';

    if (apiResults.metrics.totalTime < domResults.metrics.totalTime) {
        recommendation += `✅ RECOMMENDED: Enrollments API Approach\n\n`;
        recommendation += `Reasons:\n`;
        recommendation += `- Faster by ${Math.abs(timeDiff).toFixed(2)}ms (${Math.abs(timeDiffPercent).toFixed(1)}%)\n`;
        recommendation += `- More reliable (single API call for initial data)\n`;
        recommendation += `- Provides letter grades directly from Canvas\n`;
        recommendation += `- Less dependent on DOM structure\n`;
    } else {
        recommendation += `✅ RECOMMENDED: DOM Parsing Approach\n\n`;
        recommendation += `Reasons:\n`;
        recommendation += `- Faster by ${Math.abs(timeDiff).toFixed(2)}ms (${Math.abs(timeDiffPercent).toFixed(1)}%)\n`;
        recommendation += `- No additional API calls for initial data\n`;
        recommendation += `- Works even if API is slow/unavailable\n`;
    }

    if (domResults.metrics.errorCount > 0 || apiResults.metrics.errorCount > 0) {
        recommendation += `\n⚠️  Errors detected:\n`;
        recommendation += `- DOM Approach: ${domResults.metrics.errorCount} errors\n`;
        recommendation += `- API Approach: ${apiResults.metrics.errorCount} errors\n`;
    }

    return recommendation;
}

// Expose test function globally for console access
if (typeof window !== 'undefined') {
    window.CG_testAllGradesDataSources = compareDataSourceApproaches;
}