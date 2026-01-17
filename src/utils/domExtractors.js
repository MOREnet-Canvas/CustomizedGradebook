// src/utils/domExtractors.js
/**
 * DOM Extraction Utilities
 * 
 * Shared utilities for extracting data from Canvas DOM elements.
 * Used across dashboard, all-grades page, and other modules.
 * 
 * Functions:
 * - extractCourseLinks: Find all course links in a container
 * - extractGradeFromCell: Extract grade percentage from a table cell
 * - extractCourseDataFromRow: Parse course information from a table row
 * - findTableRows: Find course table rows in the all-grades page
 */

import { logger } from './logger.js';
import { extractCourseIdFromHref } from './canvas.js';
import { matchesCourseNamePattern } from './courseDetection.js';

/**
 * Extract all course links from a container element
 * 
 * Filters out navigation links and only returns links in the main content area.
 * 
 * @param {HTMLElement} container - Container element to search within
 * @param {boolean} [excludeNavigation=true] - Whether to exclude navigation links
 * @returns {HTMLAnchorElement[]} Array of course link elements
 */
export function extractCourseLinks(container, excludeNavigation = true) {
    const links = container.querySelectorAll('a[href*="/courses/"]');
    
    if (!excludeNavigation) {
        return Array.from(links);
    }
    
    // Filter out navigation links
    return Array.from(links).filter(link => {
        const isNavigation = link.closest('.ic-app-header') ||
                            link.closest('[role="navigation"]') ||
                            link.closest('.menu');
        return !isNavigation;
    });
}

/**
 * Extract grade percentage from a table cell
 * 
 * Handles various Canvas grade cell formats:
 * - "85.5%" -> 85.5
 * - "85.5 %" -> 85.5
 * - "N/A" -> null
 * - "" -> null
 * 
 * @param {HTMLElement} gradeCell - Grade cell element
 * @returns {number|null} Grade percentage or null if not found
 */
export function extractGradeFromCell(gradeCell) {
    if (!gradeCell) return null;
    
    const gradeText = gradeCell.textContent.trim();
    if (!gradeText) return null;
    
    // Match percentage pattern: digits with optional decimal, followed by %
    const percentageMatch = gradeText.match(/(\d+(?:\.\d+)?)\s*%/);
    
    if (percentageMatch) {
        return parseFloat(percentageMatch[1]);
    }
    
    return null;
}

/**
 * Extract course data from a table row
 * 
 * Parses a Canvas grades table row to extract:
 * - Course ID
 * - Course name
 * - Grade percentage
 * - Whether course name matches standards-based pattern
 * 
 * @param {HTMLTableRowElement} row - Table row element
 * @returns {Object|null} Course data object or null if extraction failed
 * @returns {string} return.courseId - Course ID
 * @returns {string} return.courseName - Course name
 * @returns {number|null} return.percentage - Grade percentage (0-100) or null
 * @returns {boolean} return.matchesPattern - Whether course name matches SBG pattern
 * @returns {string} return.courseUrl - URL to course grades page
 */
export function extractCourseDataFromRow(row) {
    try {
        // Find course link
        const courseLink = row.querySelector('a[href*="/courses/"]');
        if (!courseLink) {
            logger.trace('[DOM Extractor] No course link found in row');
            return null;
        }
        
        const courseName = courseLink.textContent.trim();
        const href = courseLink.getAttribute('href');
        const courseId = extractCourseIdFromHref(href);
        
        if (!courseId) {
            logger.trace(`[DOM Extractor] Could not extract course ID from href: ${href}`);
            return null;
        }
        
        // Extract grade percentage from .percent cell
        const gradeCell = row.querySelector('.percent');
        const percentage = extractGradeFromCell(gradeCell);
        
        // Check if course name matches standards-based pattern
        const matchesPattern = matchesCourseNamePattern(courseName);
        
        logger.trace(`[DOM Extractor] Extracted course: ${courseName} (${courseId}), grade=${percentage}%, matchesPattern=${matchesPattern}`);
        
        return {
            courseId,
            courseName,
            percentage,
            matchesPattern,
            courseUrl: `/courses/${courseId}/grades`
        };
        
    } catch (error) {
        logger.warn('[DOM Extractor] Failed to extract course data from row:', error);
        return null;
    }
}

/**
 * Find all course table rows in the all-grades page
 * 
 * Locates the Canvas grades table and returns all course rows.
 * 
 * @returns {HTMLTableRowElement[]} Array of table row elements
 */
export function findTableRows() {
    const table = document.querySelector('table.course_details.student_grades');
    
    if (!table) {
        logger.trace('[DOM Extractor] Grades table not found');
        return [];
    }
    
    const rows = table.querySelectorAll('tbody tr');
    logger.trace(`[DOM Extractor] Found ${rows.length} table rows`);
    
    return Array.from(rows);
}

/**
 * Extract all courses from the all-grades page DOM
 * 
 * Convenience function that combines findTableRows and extractCourseDataFromRow
 * to extract all course data from the grades table.
 * 
 * @returns {Object[]} Array of course data objects
 */
export function extractAllCoursesFromTable() {
    const rows = findTableRows();
    const courses = [];
    
    for (const row of rows) {
        const courseData = extractCourseDataFromRow(row);
        if (courseData) {
            courses.push(courseData);
        }
    }
    
    logger.trace(`[DOM Extractor] Extracted ${courses.length} courses from table`);
    return courses;
}

