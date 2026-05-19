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

/**
 * Fetch Canvas rollup scores for a single outcome across all students.
 *
 * Used for live score refresh when a teacher expands an outcome row —
 * cheaper than fetchOutcomeRollups which fetches all outcomes at once.
 *
 * Returns a Map of studentId -> canvasScore for the given outcome.
 * Returns an empty Map on any error (safe fallback — cached scores remain).
 *
 * @param {string} courseId
 * @param {string} outcomeId
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<Map<string, number>>} Map of studentId -> canvasScore
 */
export async function fetchOutcomeRollupsForOutcome(courseId, outcomeId, apiClient) {
    try {
        logger.debug(`[outcomesDataService] Fetching live Canvas rollup for outcome ${outcomeId}`);

        const rollupResponse = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups`
                + `?outcome_ids[]=${outcomeId}`
                + `&include[]=outcomes&include[]=users&per_page=100`,
            {},
            'fetchOutcomeRollupsForOutcome'
        );

        const rollups  = rollupResponse?.rollups ?? [];
        const scoreMap = new Map();

        rollups.forEach(rollup => {
            const studentId = rollup.links?.user;
            if (!studentId) return;
            rollup.scores?.forEach(scoreObj => {
                if (String(scoreObj.links?.outcome) === String(outcomeId)
                        && scoreObj.score != null) {
                    scoreMap.set(String(studentId), scoreObj.score);
                }
            });
        });

        logger.debug(`[outcomesDataService] Live rollup: ${scoreMap.size} score(s) for outcome ${outcomeId}`);
        return scoreMap;

    } catch (err) {
        logger.warn(`[outcomesDataService] Live rollup fetch failed for outcome ${outcomeId} — cached scores remain:`, err.message);
        return new Map();   // safe fallback
    }
}

/**
 * Fetch fresh alignment scores (attempts) for one student × one outcome.
 *
 * Used for lazy fetch on outcome expand and per-student refresh. Filters
 * out PL override assignment results so they don't contaminate the Power
 * Law calculation.
 *
 * Returns an array of attempt objects in the same shape as od.attempts,
 * sorted chronologically (oldest first). Returns null on error so the
 * caller can keep existing cached attempts unchanged.
 *
 * @param {string}      courseId
 * @param {string}      outcomeId
 * @param {string}      studentId
 * @param {Object}      apiClient
 * @param {Set<string>} [plAssignmentIds]  - "assignment_NNNN" IDs to exclude
 * @returns {Promise<Array|null>}
 */
export async function fetchStudentOutcomeAttempts(courseId, outcomeId, studentId, apiClient, plAssignmentIds = new Set()) {
    try {
        logger.debug(`[outcomesDataService] Fetching attempts for student ${studentId}, outcome ${outcomeId}`);

        const response = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_results`
                + `?user_ids[]=${studentId}`
                + `&outcome_ids[]=${outcomeId}`
                + `&include[]=alignments`
                + `&per_page=100`,
            {},
            'fetchStudentOutcomeAttempts'
        );

        const results = Array.isArray(response)
            ? response
            : (response?.outcome_results ?? []);

        if (results.length === 0) {
            logger.debug(`[outcomesDataService] No results for student ${studentId}, outcome ${outcomeId}`);
            return [];
        }

        // Build alignment name map from linked data if available
        const alignmentNameMap = {};
        if (response.linked?.alignments) {
            response.linked.alignments.forEach(a => {
                if (a.id && a.title) alignmentNameMap[a.id] = a.title;
            });
        }

        const filtered = results.filter(r => {
            const aId = r.links?.assignment || r.links?.alignment;
            return !aId || !plAssignmentIds.has(aId);
        });

        const grouped = extractAttempts(filtered, alignmentNameMap);
        const key = `${studentId}_${outcomeId}`;
        return grouped[key] ?? [];

    } catch (err) {
        logger.warn(`[outcomesDataService] Failed to fetch attempts for student ${studentId}: ${err.message}`);
        return null;   // null = keep existing cached attempts
    }
}

/**
 * Fetch and apply fresh outcome data for one student × one outcome.
 *
 * Updates in-memory cache:
 *   1. od.attempts — fresh rubric criterion scores from Canvas
 *   2. od.plPrediction — recomputed from fresh attempts (respecting ignored alignments)
 *   3. od.canvasScore — live rollup score from Canvas
 *
 * Returns true if any data changed, false otherwise.
 * Silent fail on errors — cached data remains unchanged.
 *
 * @param {string}      courseId
 * @param {string}      outcomeId
 * @param {string}      studentId
 * @param {Object}      cache         - In-memory cache (mutated in place)
 * @param {Object}      apiClient
 * @param {Set<string>} [plAssignmentIds]
 * @returns {Promise<boolean>} true if cache was updated
 */
export async function refreshStudentOutcomeData(courseId, outcomeId, studentId, cache, apiClient, plAssignmentIds = new Set()) {
    const student = cache.students?.find(s => String(s.id) === String(studentId));
    if (!student) return false;

    const od = student.outcomes?.find(o => String(o.outcomeId) === String(outcomeId));
    if (!od) return false;

    const [freshAttempts, scoreMap] = await Promise.all([
        fetchStudentOutcomeAttempts(courseId, outcomeId, studentId, apiClient, plAssignmentIds),
        fetchOutcomeRollupsForOutcome(courseId, outcomeId, apiClient)
    ]);

    let changed = false;

    if (freshAttempts !== null) {
        od.attempts = freshAttempts;
        changed = true;

        const ignoredIds = new Set(
            (cache.ignored_alignments ?? [])
                .filter(ia => String(ia.student_id) === String(studentId)
                           && String(ia.outcome_id)  === String(outcomeId))
                .map(ia => ia.alignment_id)
        );
        const activeScores = freshAttempts
            .filter(a => !ignoredIds.has(a.assignmentId))
            .map(a => a.score)
            .filter(s => s != null);

        Object.assign(od, computeStudentOutcome(activeScores));
    }

    const liveScore = scoreMap.get(String(studentId));
    if (liveScore !== undefined && liveScore !== od.canvasScore) {
        od.canvasScore = liveScore;
        changed = true;
    }

    return changed;
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
// ═══════════════════════════════════════════════════════════════════════
// PARALLEL OUTCOME RESULTS FETCH (4d)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Parse the total page count from a Canvas Link response header.
 * Canvas emits:  <url?page=N>; rel="last"
 * Returns null when the header is absent or has no rel="last" entry (single page).
 *
 * @param {string|null} linkHeader
 * @returns {number|null}
 */
function parseTotalPagesFromLink(linkHeader) {
    if (!linkHeader) return null;
    const m = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * Split an array into sequential chunks of at most `size` elements.
 *
 * @param {Array}  arr
 * @param {number} size
 * @returns {Array[]}
 */
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Build a { alignmentId → name } lookup map from a Canvas linked.alignments array.
 * Each alignment object has at minimum: { id: "assignment_NNN", name: "Quiz 1" }
 *
 * @param {Object[]} alignments  - From response.linked?.alignments ?? []
 * @returns {Object}             - e.g. { "assignment_123": "Quiz 1" }
 */
function buildAlignmentNameMap(alignments) {
    const map = {};
    if (!Array.isArray(alignments)) return map;
    alignments.forEach(a => {
        if (a.id && a.name) map[a.id] = a.name;
    });
    return map;
}

/**
 * Apply the PL assignment exclusion filter to a flat results array.
 *
 * @param {Object[]} results        - Raw outcome_result objects
 * @param {Set<string>} plIds       - Set of "assignment_NNNN" strings to exclude
 * @returns {Object[]}
 */
function filterOutPLResults(results, plIds) {
    if (!plIds || plIds.size === 0) return results;
    return results.filter(r => {
        const alignmentId = r.links?.assignment || r.links?.alignment;
        return !plIds.has(alignmentId);
    });
}

/**
 * Fetch ALL outcome results using parallel page requests (~13 s vs ~60 s sequential).
 *
 * Algorithm:
 *  1. Fetch page 1 via getWithResponse() to read the Link header for total page count.
 *  2. Fetch remaining pages in parallel batches of 10 via Promise.allSettled.
 *  3. Any batch failure throws immediately — caller must treat this as a hard error
 *     and leave the existing cache unchanged (cache integrity rule).
 *  4. The PL assignment exclusion filter is applied to the combined results BEFORE
 *     returning, matching the filter in the sequential fetchOutcomeResults path.
 *     This is critical: PL override assignments create a feedback loop that corrupts
 *     the Power Law calculation if their scores are included.
 *
 * @param {string}      courseId
 * @param {CanvasApiClient} apiClient
 * @param {Set<string>} plAssignmentIds  - "assignment_NNNN" IDs to exclude (may be empty Set)
 * @param {Function}    onProgress       - (message: string) => void
 * @returns {Promise<Object[]>}          - Filtered outcome_result objects
 */
export async function fetchAllOutcomeResultsParallel(courseId, apiClient, plAssignmentIds, onProgress = () => {}) {
    const baseUrl = `/api/v1/courses/${courseId}/outcome_results`
        + `?include[]=alignments&per_page=100`;

    logger.info('[outcomesDataService] Parallel fetch: fetching page 1 for Link header...');
    onProgress('Fetching outcome results (parallel)... page 1');

    // Page 1 — getWithResponse so we can read the Link header for total pages
    const page1Response = await apiClient.getWithResponse(`${baseUrl}&page=1`, {}, 'fetchOutcomeResultsParallel:page1');
    if (!page1Response.ok) {
        throw new Error(`Parallel fetch failed on page 1: HTTP ${page1Response.status}`);
    }

    const page1Data   = await page1Response.json();
    const linkHeader  = page1Response.headers.get('Link');
    const totalPages  = parseTotalPagesFromLink(linkHeader) ?? 1;

    const allResults = [...(page1Data.outcome_results || [])];
    // Collect alignment names: { alignmentId → name } cumulative across all pages
    const alignmentNameMap = buildAlignmentNameMap(page1Data.linked?.alignments ?? []);
    logger.debug(`[outcomesDataService] Parallel fetch: ${totalPages} total page(s), ${allResults.length} from page 1`);

    if (totalPages > 1) {
        const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const batches  = chunk(pageNums, 10);

        for (const batch of batches) {
            onProgress(`Fetching outcome results (parallel)... pages ${batch[0]}–${batch[batch.length - 1]} of ${totalPages}`);

            const settled = await Promise.allSettled(
                batch.map(p =>
                    apiClient.get(`${baseUrl}&page=${p}`, {}, `fetchOutcomeResultsParallel:page${p}`)
                             .then(d => ({ results: d.outcome_results || [], names: buildAlignmentNameMap(d.linked?.alignments ?? []) }))
                )
            );

            const failed = settled.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                throw new Error(
                    `Parallel refresh failed — ${failed.length} page(s) could not be fetched. ` +
                    `Existing cache is unchanged.`
                );
            }

            settled.forEach(r => {
                allResults.push(...r.value.results);
                Object.assign(alignmentNameMap, r.value.names);
            });
        }
    }

    logger.info(`[outcomesDataService] Parallel fetch complete: ${totalPages} pages, ${allResults.length} raw results`);
    onProgress(`Loaded ${allResults.length} outcome results`);

    const filtered = filterOutPLResults(allResults, plAssignmentIds);
    if (plAssignmentIds?.size > 0) {
        const excluded = allResults.length - filtered.length;
        logger.info(`[outcomesDataService] Excluded ${excluded} PL override result(s) from parallel fetch`);
    }

    return { results: filtered, alignmentNameMap };
}

export async function fetchOutcomeResults(courseId, apiClient, onProgress = () => {}) {
    try {
        logger.info('[outcomesDataService] Fetching ALL outcome results...');
        onProgress('Fetching outcome results...');

        // Manual pagination because Canvas API returns { outcome_results: [...] }
        // not a direct array like other endpoints
        let allResults = [];
        const alignmentNameMap = {};
        let page = 1;
        let hasMore = true;
        let nextUrl = `/api/v1/courses/${courseId}/outcome_results?include[]=alignments&per_page=100`;

        while (hasMore) {
            const response = await apiClient.get(
                nextUrl,
                {},
                `fetchOutcomeResults:page${page}`
            );

            // Extract outcome_results array from response
            const pageResults = response.outcome_results || [];
            allResults = allResults.concat(pageResults);

            // Collect alignment name metadata from this page
            Object.assign(alignmentNameMap, buildAlignmentNameMap(response.linked?.alignments ?? []));

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
                nextUrl = `/api/v1/courses/${courseId}/outcome_results?include[]=alignments&per_page=100&page=${page}`;
            }
        }

        logger.info(`[outcomesDataService] Fetched ${allResults.length} outcome results`);
        onProgress(`Loaded ${allResults.length} outcome results`);

        return { results: allResults, alignmentNameMap };

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
 * @param {Array}  outcomeResults   - Raw outcome_results from Canvas API
 * @param {Object} [alignmentNameMap={}] - { alignmentId → assignmentName } from linked.alignments
 * @returns {Object} Grouped attempts: { "studentId_outcomeId": [{score, timestamp, assignmentId, assignmentName}] }
 */
export function extractAttempts(outcomeResults, alignmentNameMap = {}) {
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

        // Add attempt — include assignmentName if available from linked.alignments
        grouped[key].push({
            score: parseFloat(score),
            timestamp: timestamp,
            assignmentId: assignmentId,
            assignmentName: alignmentNameMap[assignmentId]
                         ?? alignmentNameMap[`assignment_${assignmentId}`]
                         ?? null,
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
/**
 * Orchestrate all fetches needed for a Mastery Outlook cache build.
 *
 * @param {string}   courseId
 * @param {CanvasApiClient} apiClient
 * @param {Function} onProgress       - (message: string) => void
 * @param {Object}   [opts]
 * @param {boolean}  [opts.parallel=false]  When true, uses the parallel page-fetch path
 *                                          for outcome_results (~13 s vs ~60 s sequential).
 *                                          The caller must guarantee that all pages succeed
 *                                          before writing the cache (handled by runFullRefresh).
 * @param {Set<string>|null} [opts.knownPlAssignmentIds=null]  Additional "assignment_NNNN" IDs
 *                                          to exclude from outcome results, merged with any IDs
 *                                          read from the disk cache. Use when the disk cache may
 *                                          be empty but PL assignments are known to exist in Canvas.
 * @returns {Promise<{outcomes, students, groupedAttempts, canvasRollups, courseId}>}
 */
export async function fetchAllOutcomeData(courseId, apiClient, onProgress = () => {}, { parallel = false, knownPlAssignmentIds = null } = {}) {
    try {
        logger.info(`[outcomesDataService] Starting complete data fetch (parallel=${parallel})...`);
        onProgress('Starting data fetch...');

        // Step 1: Fetch outcome metadata
        onProgress('Fetching outcome names...');
        const outcomes = await fetchOutcomeNames(courseId, apiClient);
        if (outcomes.length === 0) throw new Error('No outcomes found in course');

        // Step 2: Fetch student roster
        onProgress('Fetching student roster...');
        const students = await fetchCourseStudents(courseId, apiClient);
        if (students.length === 0) logger.warn('[outcomesDataService] No students found in course');

        // Step 2.5: Read PL assignment IDs now — needed by both fetch paths for filtering.
        // Merge with any IDs the caller already resolved (e.g. from a Canvas name search
        // in runFullRefresh) so the filter is complete even when the disk cache is empty.
        const plAssignments    = await readPLAssignments(courseId, apiClient);
        const diskIds          = Object.values(plAssignments || {}).map(a => `assignment_${a.assignment_id}`);
        const plAssignmentIds  = new Set([
            ...diskIds,
            ...(knownPlAssignmentIds ?? [])
        ]);
        if (plAssignmentIds.size > 0) {
            logger.debug(`[outcomesDataService] Filtering ${plAssignmentIds.size} PL assignment ID(s) from outcome results`);
        }

        // Step 3: Fetch ALL outcome results — sequential or parallel.
        // Both paths now return { results, alignmentNameMap } for assignment name resolution in dots.
        let filteredResults;
        let alignmentNameMap = {};

        if (parallel) {
            // Parallel path returns already-filtered results + alignment names
            const parallelData = await fetchAllOutcomeResultsParallel(
                courseId, apiClient, plAssignmentIds, onProgress
            );
            filteredResults  = parallelData.results;
            alignmentNameMap = parallelData.alignmentNameMap;
        } else {
            // Sequential path — filter applied below
            const fetchData = await fetchOutcomeResults(courseId, apiClient, onProgress);
            const outcomeResults = fetchData.results;
            alignmentNameMap     = fetchData.alignmentNameMap;
            if (outcomeResults.length === 0) logger.warn('[outcomesDataService] No outcome results found');

            filteredResults = plAssignmentIds.size > 0
                ? outcomeResults.filter(result => {
                    const alignmentId = result.links?.assignment || result.links?.alignment;
                    return !plAssignmentIds.has(alignmentId);
                })
                : outcomeResults;

            if (plAssignmentIds.size > 0) {
                const excluded = outcomeResults.length - filteredResults.length;
                logger.info(`[outcomesDataService] Excluded ${excluded} PL override result(s) from Power Law calculation`);
            }
        }

        // Step 4: Fetch Canvas official rollup scores
        onProgress('Fetching Canvas rollup scores...');
        const canvasRollups = await fetchOutcomeRollups(courseId, apiClient);

        // Pass alignmentNameMap so each attempt gets its assignment name populated
        const groupedAttempts = extractAttempts(filteredResults, alignmentNameMap);

        onProgress('Data fetch complete');
        logger.info('[outcomesDataService] Complete data fetch finished');

        return { outcomes, students, groupedAttempts, canvasRollups, courseId };

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

/**
 * Refresh Data — step 8: detect possible manual Canvas overrides.
 *
 * After a Refresh Data cycle computes the new cache, this function walks every
 * student × outcome and checks whether the Canvas rollup score has changed
 * since the last PL sync push.  If it has, the teacher may have manually
 * overridden the grade in Canvas, so we flag it for the teacher to review.
 *
 * Rules:
 *  - Only checked when a PL assignment exists for the outcome.
 *  - possibleManualOverride = true  ↔  canvasScore ≠ lastSyncedScore
 *                                       AND manual_override is NOT already set.
 *  - Never sets manual_override (that requires explicit teacher confirmation).
 *  - Mutates cache.students in place and returns cache for chaining.
 *
 * @param {Object} cache        - Result of computeOutcomeStats()
 * @param {Object} syncState    - Result of readSyncState() — may be {}
 * @param {Object} plAssignments - Result of readPLAssignments() — may be {}
 * @returns {Object} The same cache object (mutated)
 */
export function applyPossibleManualOverrides(cache, syncState, plAssignments) {
    const scoresMatch = (a, b) =>
        a != null && b != null && Math.round(a * 100) === Math.round(b * 100);

    for (const student of (cache.students || [])) {
        for (const outcomeData of (student.outcomes || [])) {
            const oId = String(outcomeData.outcomeId);
            const sId = String(student.id);

            // Only relevant when the outcome has a PL assignment set up
            if (!plAssignments?.[oId]?.assignment_id) {
                outcomeData.possibleManualOverride = false;
                continue;
            }

            const state          = syncState?.[oId]?.[sId];
            const canvasScore    = outcomeData.canvasScore;
            const lastSynced     = state?.last_synced_score ?? null;
            const manualOverride = state?.manual_override ?? false;

            // Flag only when: not already confirmed, was pushed before, and now differs
            outcomeData.possibleManualOverride = (
                !manualOverride
                && lastSynced !== null
                && canvasScore !== null
                && !scoresMatch(canvasScore, lastSynced)
            );
        }
    }

    return cache;
}

/**
 * Recompute plPrediction for every student×outcome that has at least one
 * ignored alignment, using only the non-ignored attempts.
 *
 * Must be called after ignored_alignments is restored in runFullRefresh so
 * that computeOutcomeStats output (which uses all attempts) is corrected.
 * Mutates cache.students in place.
 *
 * @param {Object} cache - In-memory cache with .students and .ignored_alignments
 */
export function reapplyIgnoredAlignments(cache) {
    const ignored = cache.ignored_alignments ?? [];
    if (ignored.length === 0) return;

    // Group by student×outcome to avoid recomputing the same pair multiple times
    const pairs = new Map();
    for (const ia of ignored) {
        const key = `${ia.student_id}::${ia.outcome_id}`;
        if (!pairs.has(key)) pairs.set(key, { studentId: ia.student_id, outcomeId: ia.outcome_id });
    }

    for (const { studentId, outcomeId } of pairs.values()) {
        const student = (cache.students ?? []).find(s => String(s.id) === String(studentId));
        if (!student) continue;

        const od = (student.outcomes ?? []).find(o => String(o.outcomeId) === String(outcomeId));
        if (!od) continue;

        // Build the set of alignment_ids to exclude for this student×outcome
        const ignoredIds = new Set(
            ignored
                .filter(ia => String(ia.student_id) === String(studentId) &&
                              String(ia.outcome_id)  === String(outcomeId))
                .map(ia => ia.alignment_id)
        );

        const activeScores = (od.attempts ?? [])
            .filter(a => !ignoredIds.has(a.assignmentId))
            .map(a => a.score)
            .filter(s => s != null);

        Object.assign(od, computeStudentOutcome(activeScores));
        logger.debug(
            `[DataService] reapplyIgnoredAlignments: recomputed outcome ${outcomeId} ` +
            `for student ${studentId} — ${activeScores.length} active attempt(s)`
        );
    }
}