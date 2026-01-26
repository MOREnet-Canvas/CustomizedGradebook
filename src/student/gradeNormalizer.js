// src/student/gradeNormalizer.js
/**
 * Grade Normalizer Module
 * 
 * Removes fraction denominators and "out of X" text from grade displays across Canvas.
 * This creates a cleaner, standards-based grading experience for students by showing
 * only the mastery score (e.g., "2.74") instead of traditional point-based displays
 * (e.g., "2.74 / 4 pts" or "2.74 out of 4").
 * 
 * Handles multiple Canvas UI patterns:
 * - Course homepage assignment lists
 * - Grades page tables
 * - Rubric cells
 * - Screenreader text
 * - Outcomes tab
 * - Assignment details pages
 * - Dashboard feedback cards
 * - Assignment group totals
 * - Final grade row
 */

import { AVG_ASSIGNMENT_NAME } from '../config.js';
import { logger } from '../utils/logger.js';
import { formatGradeDisplay } from '../utils/gradeFormatting.js';
import { getCourseId } from '../utils/canvas.js';
import { CanvasApiClient } from '../utils/canvasApiClient.js';
import {
    getCourseSnapshot,
    refreshCourseSnapshot,
    shouldRefreshGrade,
    PAGE_CONTEXT
} from '../services/courseSnapshotService.js';

/**
 * Remove fraction denominators and "out of X" text from all grade displays
 * This function is idempotent and can be called multiple times safely
 */
export async function removeFractionScores() {
    // --- 1. Course homepage / assignments list style ---
    // <span class="score-display"><b>2.74</b>/4 pts</span>
    document.querySelectorAll(".score-display").forEach(scoreEl => {
        const html = scoreEl.innerHTML;
        const cleaned = html.replace(/<\/b>\s*\/\s*\d+(\.\d+)?\s*pts/i, "</b>");
        if (html !== cleaned) scoreEl.innerHTML = cleaned;
    });

    // --- 2. The grades page table style ---
    // <span class="tooltip"><span class="grade">2.74</span><span>/ 4</span></span>
    document.querySelectorAll("span.tooltip").forEach(tooltipEl => {
        Array.from(tooltipEl.children).forEach(child => {
            if (
                child.childNodes.length === 1 &&
                child.childNodes[0].nodeType === Node.TEXT_NODE &&
                /^\/\s*\d+(\.\d+)?$/.test(child.textContent.trim())
            ) {
                child.remove();
            }
        });
    });

    // --- 3. Rubric cells like "/4 pts" ---
    // matches plain text nodes like "/4 pts"
    document.querySelectorAll("span, div, td").forEach(el => {
        if (
            el.childNodes.length === 1 &&
            el.childNodes[0].nodeType === Node.TEXT_NODE &&
            /\/\s*\d+(\.\d+)?\s*pts/i.test(el.textContent)
        ) {
            el.textContent = el.textContent.replace(/\/\s*\d+(\.\d+)?\s*pts/gi, "");
        }
    });

    // --- 4. Screenreader text cleanup ---
    // "Score: 2.74 out of 4 points." -> "Score: 2.74"
    document.querySelectorAll(".screenreader-only").forEach(srEl => {
        const txt = srEl.textContent;
        const cleanedTxt = txt.replace(/out of\s*\d+(\.\d+)?\s*points?\.?/i, "").trim();
        if (txt !== cleanedTxt) srEl.textContent = cleanedTxt;
    });

    // --- 5. Outcomes tab style (2.74/4) ---
    // <span class="css-1jyml41-text">2.74/4</span>
    document.querySelectorAll("span.css-1jyml41-text").forEach(scoreEl => {
        const txt = scoreEl.textContent.trim();
        const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
        if (m) scoreEl.textContent = m[1];
    });

    // --- 6. Assignment details page ---
    // a) <span class="points-value"><strong>2.74/4</strong> Points</span>
    document.querySelectorAll("span.points-value strong").forEach(strongEl => {
        const txt = strongEl.textContent.trim();
        const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
        if (m) strongEl.textContent = m[1];
    });

    // b) <span class="css-7cbhck-text">2.74/4</span>
    document.querySelectorAll("span.css-7cbhck-text").forEach(scoreEl => {
        const txt = scoreEl.textContent.trim();
        const m = txt.match(/^(\d+(\.\d+)?)[/]\s*\d+(\.\d+)?$/);
        if (m) scoreEl.textContent = m[1];
    });

    // --- 7. Recent feedback / dashboard card style ---
    // Only affect dashboard cards for the Current Score Assignment
    document.querySelectorAll('a[data-track-category="dashboard"][data-track-label="recent feedback"]').forEach(cardEl => {
        const titleEl = cardEl.querySelector(".recent_feedback_title");
        const strongEl = cardEl.querySelector(".event-details strong");

        if (!titleEl || !strongEl) return;

        // normalize both strings
        const titleText = titleEl.textContent.trim().replace(/\s+/g, " ").toLowerCase();
        const targetName = AVG_ASSIGNMENT_NAME.trim().replace(/\s+/g, " ").toLowerCase();

        if (titleText !== targetName) return;

        // Example: "2.74 out of 4"
        const scoreText = strongEl.textContent.trim();
        const m = scoreText.match(/^(\d+(\.\d+)?)\s+out of\s+\d+(\.\d+)?$/i);
        if (m) {
            strongEl.textContent = m[1];
        }
    });

    // --- 8. Assignment group totals row ---
    normalizeGroupTotalsRow();

    // --- 9. Final grade row ---
    await normalizeFinalGradeRow();
}

/**
 * Normalize assignment group totals row
 * Removes percentages and denominators from group total displays
 */
function normalizeGroupTotalsRow() {
    document.querySelectorAll("tr.student_assignment.hard_coded.group_total").forEach(row => {
        // Remove the percent entirely (leave blank)
        const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
        if (gradeEl) {
            const raw = gradeEl.textContent.trim();
            // Remove any numeric percentage or numeric-only text
            if (/^\d+(\.\d+)?%?$/.test(raw)) {
                gradeEl.textContent = ""; // completely blank it out
            }
        }

        // Remove the denominator (keep blank if 0 or fraction)
        const possibleEl = row.querySelector(".details .possible.points_possible");
        if (possibleEl) {
            const txt = possibleEl.textContent.trim();
            // Matches "number / number" or "0.00 / 0.00"
            if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
                possibleEl.textContent = ""; // fully blank out
            }
        }
    });
}

/**
 * Normalize final grade row
 * Replaces percentage with mastery score and letter grade from Course Snapshot Service
 */
async function normalizeFinalGradeRow() {
    // Get course ID from URL
    const courseId = getCourseId();
    if (!courseId) {
        logger.trace('Cannot get course ID for final grade normalization');
        return;
    }

    // Get course name from DOM
    const courseName = document.querySelector('.course-title, h1, #breadcrumbs li:last-child')?.textContent?.trim() || 'Course';

    // Check snapshot cache first
    let snapshot = getCourseSnapshot(courseId);

    // Populate/refresh if needed
    if (!snapshot || shouldRefreshGrade(courseId, PAGE_CONTEXT.COURSE_GRADES)) {
        logger.trace(`Fetching grade data from API for final grade normalization...`);
        const apiClient = new CanvasApiClient();
        snapshot = await refreshCourseSnapshot(courseId, courseName, apiClient, PAGE_CONTEXT.COURSE_GRADES);
    }

    // Extract grade data from snapshot
    const gradeData = snapshot ? {
        score: snapshot.score,
        letterGrade: snapshot.letterGrade
    } : null;

    document.querySelectorAll("tr.student_assignment.hard_coded.final_grade").forEach(row => {
        const gradeEl = row.querySelector(".assignment_score .tooltip .grade");
        const possibleEl = row.querySelector(".details .possible.points_possible");

        if (gradeEl) {
            if (gradeData && gradeData.score) {
                // Format with both score and letter grade
                const displayValue = formatGradeDisplay(gradeData.score, gradeData.letterGrade);
                gradeEl.textContent = displayValue;
            } else {
                // If we couldn't get the mastery score, hide the percent instead
                const raw = gradeEl.textContent.trim();
                if (/^\d+(\.\d+)?%$/.test(raw)) {
                    gradeEl.textContent = "";
                }
            }
        }

        if (possibleEl) {
            // Canvas shows "102.50 / 152.00". We don't want that.
            const txt = possibleEl.textContent.trim();
            if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(txt)) {
                possibleEl.textContent = "";
            }
        }
    });
}