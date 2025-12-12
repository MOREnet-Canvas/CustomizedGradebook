// src/services/gradeOverride.js
/**
 * Grade Override Service
 * 
 * This module handles setting total course grade overrides via Canvas GraphQL API.
 * Grade overrides allow setting a final course grade that differs from the calculated grade.
 * 
 * Key responsibilities:
 * - Fetch and cache student enrollment IDs
 * - Set grade overrides via GraphQL mutation
 * - Queue concurrent override updates during bulk operations
 */

import { getTokenCookie } from "../utils/canvas.js";
import { ENABLE_GRADE_OVERRIDE, OVERRIDE_SCALE, VERBOSE_LOGGING } from "../config.js";

/**
 * Cache for enrollment IDs to avoid repeated API calls
 * Structure: Map<courseId, Map<userId, enrollmentId>>
 */
export const __enrollmentMapCache = new Map();

/**
 * Set a grade override for a student using Canvas GraphQL API
 * @param {string} enrollmentId - Student's enrollment ID
 * @param {number} overrideScore - Override score (0-100 scale)
 * @returns {Promise<number|null>} The set override score or null
 * @throws {Error} If CSRF token is missing or GraphQL request fails
 */
export async function setOverrideScoreGQL(enrollmentId, overrideScore) {
    const csrfToken = getTokenCookie('_csrf_token');
    if (!csrfToken) throw new Error("No CSRF token found.");

    const query = `
    mutation SetOverride($enrollmentId: ID!, $overrideScore: Float!) {
      setOverrideScore(input: { enrollmentId: $enrollmentId, overrideScore: $overrideScore }) {
        grades { customGradeStatusId overrideScore __typename }
        __typename
      }
    }`;

    const res = await fetch("/api/graphql", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
            "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({
            query,
            variables: {
                enrollmentId: String(enrollmentId),
                overrideScore: Number(overrideScore)
            }
        })
    });

    if (!res.ok) throw new Error(`GQL HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(`GQL error: ${JSON.stringify(json.errors)}`);
    return json.data?.setOverrideScore?.grades?.[0]?.overrideScore ?? null;
}

/**
 * Get the enrollment ID for a user in a course
 * Uses cached data when available; fetches and caches all enrollments if not cached
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Enrollment ID or null if not found
 * @throws {Error} If enrollment fetch fails
 */
export async function getEnrollmentIdForUser(courseId, userId) {
    const courseKey = String(courseId);
    const userKey = String(userId);

    // Use cache if present
    if (__enrollmentMapCache.has(courseKey)) {
        const cachedMap = __enrollmentMapCache.get(courseKey);
        return cachedMap.get(userKey) || null;
    }

    // Build the map (paginated)
    const map = new Map();
    let url = `/api/v1/courses/${courseKey}/enrollments?type[]=StudentEnrollment&per_page=100`;

    while (url) {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`Enrollments ${res.status}`);
        const data = await res.json();
        for (const e of data) {
            if (e?.user_id && e?.id) map.set(String(e.user_id), e.id);
        }
        // pagination
        const link = res.headers.get("Link");
        const next = link?.split(",").find(s => s.includes('rel="next"'));
        url = next ? next.match(/<([^>]+)>/)?.[1] ?? null : null;
    }

    __enrollmentMapCache.set(courseKey, map);
    return map.get(userKey) || null;
}

/**
 * Queue a grade override for a student (used during concurrent bulk updates)
 * Only executes if ENABLE_GRADE_OVERRIDE is true
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {number} average - Student's calculated average (0-4 scale)
 * @returns {Promise<void>}
 */
export async function queueOverride(courseId, userId, average) {
    if (!ENABLE_GRADE_OVERRIDE) return;

    try {
        const enrollmentId = await getEnrollmentIdForUser(courseId, userId);
        if (!enrollmentId) {
            if (VERBOSE_LOGGING) console.warn(`[override/concurrent] no enrollmentId for user ${userId}`);
            return;
        }

        const override = OVERRIDE_SCALE(average);
        await setOverrideScoreGQL(enrollmentId, override);
        if (VERBOSE_LOGGING) console.log(`[override/concurrent] user ${userId} → enrollment ${enrollmentId}: ${override}`);
    } catch (e) {
        console.warn(`[override/concurrent] failed for user ${userId}:`, e?.message || e);
    }
}

