// src/MasteryOutlook/outcomesDataService.js
/**
 * Outcomes Data Service
 *
 * Fetches and processes outcome data from Canvas APIs for Power Law analysis.
 *
 * Data Flow:
 * 1. fetchOutcomeNames() - Get outcome metadata (names, IDs, alignments)
 * 2. fetchOutcomeResults() - Get ALL individual attempts across all students
 * 3. extractAttempts() - Group by student+outcome, sort chronologically
 * 4. fetchAllOutcomeData() - Orchestrate all fetches
 * 5. computeOutcomeStats() - Apply Power Law calculations
 *
 * See: docs/AI_SERVICES_REFERENCE.md and src/MasteryOutlook/API_REFERENCE.md
 */

import { logger } from '../utils/logger.js';
import { fetchCourseStudents } from '../services/enrollmentService.js';
import { computeStudentOutcome, computeClassStats, MIN_SCORES } from './powerLaw.js';
import { readPLAssignments } from './masteryOutlookCacheService.js'

// ═══════════════════════════════════════════════════════════════════════
// FETCH OUTCOME METADATA
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch outcome names and metadata for the course
 *
 * Uses /outcome_groups API to get outcome names and IDs.
 * This works even when there are no students or results yet.
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Array>} Array of {id, title, displayOrder}
 */
export async function fetchOutcomeNames(courseId, apiClient) {
    try {
        logger.info('[outcomesDataService] Fetching outcome metadata...');

        // Fetch outcome groups for the course
        const groups = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_groups`,
            {},
            'fetchOutcomeNames:groups'
        );

        if (!groups || groups.length === 0) {
            logger.warn('[outcomesDataService] No outcome groups found in course');
            return [];
        }

        // Fetch outcomes from each group
        const outcomePromises = groups.map(group =>
            apiClient.get(
                `/api/v1/courses/${courseId}/outcome_groups/${group.id}/outcomes`,
                {},
                `fetchOutcomeNames:group_${group.id}`
            )
        );

        const results = await Promise.all(outcomePromises);

        // Flatten and map to simple structure
        const allOutcomes = results.flat();

        if (allOutcomes.length === 0) {
            logger.warn('[outcomesDataService] No outcomes found in course');
            return [];
        }

        const outcomeList = allOutcomes.map((outcomeWrapper, index) => ({
            id: outcomeWrapper.outcome.id,
            title: outcomeWrapper.outcome.title || outcomeWrapper.outcome.display_name || `Outcome ${outcomeWrapper.outcome.id}`,
            displayOrder: index + 1
        }));

        logger.info(`[outcomesDataService] Fetched ${outcomeList.length} outcomes`);
        return outcomeList;

    } catch (error) {
        logger.error('[outcomesDataService] Failed to fetch outcome names', error);
        throw new Error(`Could not fetch outcome metadata: ${error.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// FETCH CANVAS OUTCOME ROLLUPS (OFFICIAL SCORES)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch Canvas's official outcome rollup scores for all students
 *
 * These are the scores Canvas calculates and displays in the gradebook,
 * based on the outcome's calculation_method (decaying_average, n_mastery, etc.)
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object>} Map of studentId_outcomeId -> canvasScore
 */
export async function fetchOutcomeRollups(courseId, apiClient) {
    try {
        logger.info('[outcomesDataService] Fetching Canvas outcome rollups...');

        // Fetch outcome rollups
        // Note: Canvas returns object { rollups: [...], linked: {...} }, not an array
        const rollupResponse = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&include[]=users&per_page=100`,
            {},
            'fetchOutcomeRollups'
        );

        if (!rollupResponse) {
            logger.warn('[outcomesDataService] No rollup data returned');
            return {};
        }

        // Extract rollups array from response object
        const rollups = rollupResponse.rollups || [];

        if (rollups.length === 0) {
            logger.warn('[outcomesDataService] No rollups found in response');
            return {};
        }

        // Parse rollup data structure
        const scoreMap = {};

        rollups.forEach(rollup => {
            const studentId = rollup.links?.user;
            if (!studentId) return;

            const scores = rollup.scores || [];
            scores.forEach(scoreObj => {
                const outcomeId = scoreObj.links?.outcome;
                const score = scoreObj.score;

                if (outcomeId && score !== null && score !== undefined) {
                    const key = `${studentId}_${outcomeId}`;
                    scoreMap[key] = score;
                }
            });
        });

        logger.info(`[outcomesDataService] Fetched ${Object.keys(scoreMap).length} Canvas rollup scores`);
        return scoreMap;

    } catch (error) {
        logger.error('[outcomesDataService] Failed to fetch outcome rollups', error);
        // Don't throw - rollups are supplementary data
        return {};
    }
}

// ═══════════════════════════════════════════════════════════════════════
// FETCH OUTCOME RESULTS (ALL ATTEMPTS)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch ALL individual outcome attempts across all students
 *
 * Uses /outcome_results to get chronological score history.
 * This is the foundation for Power Law regression.
 *
 * IMPORTANT: May require many API calls on large courses.
 * Use onProgress callback to update UI during fetch.
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {Function} onProgress - Callback for progress updates: (message) => void
 * @returns {Promise<Array>} Array of outcome result objects
 */
export async function fetchOutcomeResults(courseId, apiClient, onProgress = () => {}) {
    try {
        logger.info('[outcomesDataService] Fetching ALL outcome results...');
        onProgress('Fetching outcome results...');

        // Manual pagination because Canvas API returns { outcome_results: [...] }
        // not a direct array like other endpoints
        let allResults = [];
        let page = 1;
        let hasMore = true;
        let nextUrl = `/api/v1/courses/${courseId}/outcome_results?include[]=outcomes.alignments&per_page=100`;

        while (hasMore) {
            const response = await apiClient.get(
                nextUrl,
                {},
                `fetchOutcomeResults:page${page}`
            );

            // Extract outcome_results array from response
            const pageResults = response.outcome_results || [];
            allResults = allResults.concat(pageResults);

            logger.debug(`[outcomesDataService] Page ${page}: ${pageResults.length} results`);
            onProgress(`Fetching outcome results... page ${page} (${allResults.length} total)`);

            // Check for next page using Link header
            // apiClient should expose pagination info, but we'll check response
            if (pageResults.length < 100) {
                // Last page (fewer results than per_page)
                hasMore = false;
            } else {
                // Continue to next page
                page++;
                nextUrl = `/api/v1/courses/${courseId}/outcome_results?include[]=outcomes.alignments&per_page=100&page=${page}`;
            }
        }

        logger.info(`[outcomesDataService] Fetched ${allResults.length} outcome results`);
        onProgress(`Loaded ${allResults.length} outcome results`);

        return allResults;

    } catch (error) {
        logger.error('[outcomesDataService] Failed to fetch outcome results', error);
        throw new Error(`Could not fetch outcome results: ${error.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// EXTRACT AND GROUP ATTEMPTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Group outcome results by student+outcome and sort chronologically
 *
 * Pattern from masteryDashboardViewer.js lines 638-660.
 *
 * Groups by composite key: studentId_outcomeId
 * Sorts each group by submitted_or_assessed_at (oldest first)
 * Deduplicates by submission ID if needed
 *
 * @param {Array} outcomeResults - Raw outcome_results from Canvas API
 * @returns {Object} Grouped attempts: { "studentId_outcomeId": [{score, timestamp, assignmentId}] }
 */
export function extractAttempts(outcomeResults) {
    // Defensive check
    if (!Array.isArray(outcomeResults)) {
        logger.error(`[outcomesDataService] extractAttempts received non-array: ${typeof outcomeResults}`);
        return {};
    }

    logger.debug(`[outcomesDataService] Extracting attempts from ${outcomeResults.length} results...`);

    const grouped = {};

    outcomeResults.forEach(result => {
        const studentId = result.links?.user;
        const outcomeId = result.links?.learning_outcome;
        const score = result.score;
        const timestamp = result.submitted_or_assessed_at || result.submitted_at;


        const assignmentId = result.links?.assignment || result.links?.alignment;

        // Skip invalid results
        if (!studentId || !outcomeId || score === null || score === undefined) {
            logger.warn('[outcomesDataService] Skipping invalid result', result);
            return;
        }

        // Create composite key
        const key = `${studentId}_${outcomeId}`;

        // Initialize array for this student+outcome
        if (!grouped[key]) {
            grouped[key] = [];
        }

        // Add attempt
        grouped[key].push({
            score: parseFloat(score),
            timestamp: timestamp,
            assignmentId: assignmentId,
            resultId: result.id
        });
    });

    // Sort each group chronologically (oldest first) and deduplicate
    Object.keys(grouped).forEach(key => {
        // Sort by timestamp
        grouped[key].sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            return dateA - dateB;  // Oldest first
        });

        // Deduplicate by submission ID (keep first occurrence)
        const seen = new Set();
        grouped[key] = grouped[key].filter(attempt => {
            if (!attempt.assignmentId) return true;  // Keep if no assignment ID

            if (seen.has(attempt.assignmentId)) {
                return false;  // Duplicate - skip
            }

            seen.add(attempt.assignmentId);
            return true;
        });
    });

    const totalGroups = Object.keys(grouped).length;
    const totalAttempts = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    logger.info(`[outcomesDataService] Grouped into ${totalGroups} student+outcome pairs (${totalAttempts} attempts total)`);

    return grouped;
}

// ═══════════════════════════════════════════════════════════════════════
// ORCHESTRATE DATA FETCH
// ═══════════════════════════════════════════════════════════════════════

/**
 * Orchestrate all data fetches for the Mastery Outlook
 *
 * Steps:
 * 1. Fetch outcome names (metadata)
 * 2. Fetch student roster
 * 3. Fetch ALL outcome results
 * 4. Extract and group attempts
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {Function} onProgress - Progress callback: (message) => void
 * @returns {Promise<Object>} Combined data: {outcomes, students, groupedAttempts}
 */
export async function fetchAllOutcomeData(courseId, apiClient, onProgress = () => {}) {
    try {
        logger.info('[outcomesDataService] Starting complete data fetch...');
        onProgress('Starting data fetch...');

        // Step 1: Fetch outcome metadata
        onProgress('Fetching outcome names...');
        const outcomes = await fetchOutcomeNames(courseId, apiClient);

        if (outcomes.length === 0) {
            throw new Error('No outcomes found in course');
        }

        // Step 2: Fetch student roster
        onProgress('Fetching student roster...');
        const students = await fetchCourseStudents(courseId, apiClient);

        if (students.length === 0) {
            logger.warn('[outcomesDataService] No students found in course');
        }

        // Step 3: Fetch ALL outcome results
        const outcomeResults = await fetchOutcomeResults(courseId, apiClient, onProgress);

        if (outcomeResults.length === 0) {
            logger.warn('[outcomesDataService] No outcome results found');
        }

        // Step 4: Fetch Canvas official rollup scores
        onProgress('Fetching Canvas rollup scores...');
        const canvasRollups = await fetchOutcomeRollups(courseId, apiClient);

        // Step 5: Filter out PL override assignment results before computing Power Law
        // PL override assignments feed scores back into the outcome, creating a feedback loop
        onProgress('Processing attempts...');
        const plAssignments = await readPLAssignments(courseId, apiClient);
        const plAssignmentIds = new Set(
            Object.values(plAssignments).map(a => `assignment_${a.assignment_id}`)
        );
        const filteredResults = plAssignmentIds.size > 0
            ? outcomeResults.filter(result => {
                const alignmentId = result.links?.assignment || result.links?.alignment;
                return !plAssignmentIds.has(alignmentId);
            })
            : outcomeResults;

        if (plAssignmentIds.size > 0) {
            const excluded = outcomeResults.length - filteredResults.length;
            logger.info(`[outcomesDataService] Excluded ${excluded} PL override result(s) from Power Law calculation`);
        }

        const groupedAttempts = extractAttempts(filteredResults);

        onProgress('Data fetch complete');
        logger.info('[outcomesDataService] Complete data fetch finished');

        return {
            outcomes,
            students,
            groupedAttempts,
            canvasRollups,
            courseId
        };

    } catch (error) {
        logger.error('[outcomesDataService] Failed to fetch outcome data', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// COMPUTE POWER LAW STATS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute Power Law statistics for all student+outcome combinations
 *
 * For each student+outcome:
 * - Check if scores.length >= MIN_SCORES
 * - If yes: call computeStudentOutcome() from powerLaw.js
 * - If no: set status='NE'
 *
 * Then compute class stats per outcome using computeClassStats()
 *
 * @param {Object} data - Combined data from fetchAllOutcomeData()
 * @param {number} threshold - Re-teach threshold (e.g. 2.2)
 * @returns {Object} Cache-ready structure matching DATA_STRUCTURES.md schema
 */
export function computeOutcomeStats(data, threshold = 2.2) {
    const { outcomes, students, groupedAttempts, canvasRollups = {} } = data;

    logger.info('[outcomesDataService] Computing Power Law statistics...');
    logger.debug(`[outcomesDataService] Using threshold: ${threshold}, MIN_SCORES: ${MIN_SCORES}`);

    // Build student outcome data
    const studentData = students.map(student => {
        const studentOutcomes = outcomes.map(outcome => {
            const key = `${student.userId}_${outcome.id}`;
            const attempts = groupedAttempts[key] || [];
            const scores = attempts.map(a => a.score);

            // Compute stats using powerLaw.js
            const computed = computeStudentOutcome(scores);

            // Get Canvas official score from rollups
            const canvasScore = canvasRollups[key] !== undefined ? canvasRollups[key] : null;

            return {
                outcomeId: outcome.id,
                ...computed,
                canvasScore: canvasScore,  // Canvas's calculated score
                attempts: attempts  // Include full history for UI
            };
        });

        return {
            id: student.userId.toString(),
            sectionId: student.sectionId,
            outcomes: studentOutcomes
        };
    });


    // Compute class stats per outcome
    const outcomeStats = outcomes.map(outcome => {
        // Get all student results for this outcome
        const studentResults = studentData.map(student => {
            // Use loose equality to handle string/number mismatch
            const outcomeData = student.outcomes.find(o => String(o.outcomeId) === String(outcome.id));

            // Handle case where outcome data is not found
            if (!outcomeData) {
                logger.warn(`[outcomesDataService] No outcome data found for student ${student.id}, outcome ${outcome.id}`);
                return {
                    computed: {
                        status: 'NE',
                        plPrediction: null,
                        slope: null
                    }
                };
            }

            return {
                computed: {
                    status: outcomeData.status,
                    plPrediction: outcomeData.plPrediction,
                    slope: outcomeData.slope
                }
            };
        });

        // Compute class stats using powerLaw.js
        const classStats = computeClassStats(studentResults, threshold);

        return {
            id: outcome.id,
            title: outcome.title,
            displayOrder: outcome.displayOrder,
            classStats: {
                plAvg: classStats.plAvg,
                classMean: classStats.plAvg,  // Alias for compatibility
                classMedian: null,  // Not computed by computeClassStats
                computedThreshold: classStats.computedThreshold,
                threshold_2_2: classStats.computedThreshold,  // Alias for compatibility
                belowThresholdCount: classStats.belowThresholdCount,
                studentsAtRisk: classStats.belowThresholdCount,  // Alias
                studentsNE: classStats.neCount,
                neCount: classStats.neCount,  // Alias
                totalStudents: students.length,
                distribution: classStats.distribution,
                avgSlope: classStats.avgSlope
            }
        };
    });

    logger.info('[outcomesDataService] Power Law computation complete');

    // Return cache-ready structure
    return {
        metadata: {
            courseId: data.courseId || 'unknown',
            generatedAt: new Date().toISOString(),
            minScoresThreshold: MIN_SCORES,
            studentCount: students.length,
            outcomeCount: outcomes.length
        },
        outcomes: outcomeStats,
        students: studentData
    };
}