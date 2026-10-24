// src/masteryOutlook/courseResetService.js
/**
 * Course reset — remove what Mastery Outlook setup created so a teacher can
 * start over.
 *
 * Removed (when selected):
 *   - "<Outcome> — Projected Score" assignments and their "— Projected Score Rubric"
 *   - the Mastery Outlook wiki page
 *   - mastery_outlook_cache.json, its folder, and the shared parent folder when empty
 *   - browser-only copies of that data (LMGB lock snapshot, rubric association cache)
 *
 * Never touched: the Current Score outcome / assignment / rubric, final grade
 * overrides, teacher-made assignments and outcomes, the Mastery View page, and
 * course settings. Outcome calculation methods stay "latest" — the plan warns.
 *
 * Safety:
 *   - An item is "verified" only when its Canvas ID is recorded in the cache
 *     AND its name matches our pattern. Unverified items are listed but start
 *     unchecked in the UI.
 *   - buildResetPlan is read-only. Nothing is deleted until executeResetPlan.
 *   - Children first (assignment → its rubric → page → cache file → folders).
 *     If anything fails, the cache file is kept so the reset can be run again.
 */

import { logger } from '../utils/logger.js';
import { AVG_ASSIGNMENT_NAME, PL_ASSIGNMENT_SUFFIX, PL_RUBRIC_SUFFIX } from '../config.js';
import { deleteAssignment } from '../services/assignmentService.js';
import { deleteRubric } from '../services/rubricService.js';
import { findMasteryOutlookPages, deletePage, MASTERY_OUTLOOK_ROOT_ID as OUTLOOK_ROOT_ID } from '../services/pageService.js';
import {
    readMasteryOutlookCache,
    findMasteryOutlookCacheFile,
    findMasteryOutlookFolders,
    deleteMasteryOutlookCacheFile,
    deleteMasteryOutlookFolder,
    lockedCurrentScoreStudentsFrom,
    clearLmgbLockSnapshot,
} from './masteryOutlookCacheService.js';
import { isCurrentScoreOutcome } from './outcomeTypes.js';
import { removeMasteryOutlookLink } from './sidebarLinkInjection.js';

const LOG = '[CourseReset]';

/** Item types, in the order they are deleted. */
export const RESET_ITEM_TYPES = Object.freeze({
    ASSIGNMENT: 'assignment',
    PAGE:       'page',
    CACHE_FILE: 'cacheFile',
    SUBFOLDER:  'subfolder',
    PARENT:     'parentFolder',
});

/**
 * @param {string} name
 * @returns {boolean} true for "<Outcome> — Projected Score" (never the Current Score assignment)
 */
export function isProjectedScoreAssignmentName(name) {
    return typeof name === 'string'
        && name !== AVG_ASSIGNMENT_NAME
        && name.endsWith(` — ${PL_ASSIGNMENT_SUFFIX}`);
}

/**
 * @param {string} title
 * @returns {boolean} true for "<Outcome> — Projected Score Rubric"
 */
export function isProjectedScoreRubricTitle(title) {
    return typeof title === 'string' && title.endsWith(` — ${PL_RUBRIC_SUFFIX}`);
}

/** Stable key for an item (used for UI selection). */
export function resetItemKey(item) {
    return `${item.type}:${item.id}`;
}

// ════════════════════════════════════════════════════════════════════
// Build the plan (read-only)
// ════════════════════════════════════════════════════════════════════

/**
 * Inventory what a reset would remove. Makes only GET requests.
 *
 * @param {string|number} courseId
 * @param {CanvasApiClient} apiClient
 * @returns {Promise<{
 *   courseId: string,
 *   items: Array<Object>,
 *   warnings: string[],
 *   latestOutcomeTitles: string[],
 *   lockedOverrideCount: number,
 *   cache: Object|null,
 *   submissionsByAssignment: Object<string, Object[]>
 * }>}
 */
export async function buildResetPlan(courseId, apiClient) {
    const cache = await readMasteryOutlookCache(courseId, apiClient);
    const warnings = [];
    const items = [];

    if (!cache) {
        warnings.push('No Mastery Outlook data file was found, so nothing below can be verified. ' +
            'Items are unchecked — check only the ones you know Mastery Outlook created.');
    }

    // ── Projected Score assignments (+ their rubrics) ──
    const cachedPlIds = new Set(Object.values(cache?.pl_assignments ?? {})
        .map(p => String(p?.assignment_id ?? '')).filter(Boolean));
    const currentScore = cache?.avg_assignment ?? null;
    const protectedAssignmentIds = new Set([currentScore?.assignment_id].filter(Boolean).map(String));
    const protectedRubricIds = new Set([currentScore?.rubric_id].filter(Boolean).map(String));

    const found = await apiClient.getAllPages(
        // Filters go in the URL — getAllPages' second argument is fetch options
        `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(PL_ASSIGNMENT_SUFFIX)}&per_page=100`,
        {},
        'CourseReset:findAssignments'
    );

    const submissionsByAssignment = {};
    for (const a of found ?? []) {
        const id = String(a.id);
        if (!isProjectedScoreAssignmentName(a.name) || protectedAssignmentIds.has(id)) continue;

        const verified = cachedPlIds.has(id);
        const rubricId = a.rubric_settings?.id != null ? String(a.rubric_settings.id) : null;
        const rubricTitle = a.rubric_settings?.title ?? null;
        const rubric = rubricId && !protectedRubricIds.has(rubricId) && isProjectedScoreRubricTitle(rubricTitle)
            ? { id: rubricId, title: rubricTitle }
            : null;

        const submissions = await fetchSubmissions(courseId, id, apiClient);
        submissionsByAssignment[id] = submissions;

        items.push({
            type: RESET_ITEM_TYPES.ASSIGNMENT,
            id,
            name: a.name,
            verified,
            rubric,
            gradeCount: submissions.filter(s => s.score != null || (s.grade != null && s.grade !== '')).length,
            note: verified ? null : 'Not recorded in Mastery Outlook data',
        });
    }

    // ── Mastery Outlook page(s) — by title; a reset/recreate can leave numbered
    //    copies (mastery-outlook-3, -4, …) ──
    for (const page of await findMasteryOutlookPages(courseId, apiClient)) {
        const verified = String(page.body ?? '').includes(OUTLOOK_ROOT_ID);
        items.push({
            type: RESET_ITEM_TYPES.PAGE,
            id: page.url,
            name: `Page: ${page.title} (${page.url})`,
            verified,
            note: verified ? null : 'Page content was changed after setup',
        });
    }

    // ── Cache file + folders ──
    const { parent, subfolder } = await findMasteryOutlookFolders(courseId, apiClient);
    const cacheFile = await findMasteryOutlookCacheFile(courseId, apiClient);
    if (cacheFile) {
        const verified = Boolean(subfolder) && String(cacheFile.folder_id) === String(subfolder.id);
        items.push({
            type: RESET_ITEM_TYPES.CACHE_FILE,
            id: String(cacheFile.id),
            name: `File: ${cacheFile.display_name}`,
            verified,
            note: verified ? null : 'File is not in the Mastery Outlook folder',
        });
    }
    if (subfolder) {
        items.push({
            type: RESET_ITEM_TYPES.SUBFOLDER,
            id: String(subfolder.id),
            name: `Folder: ${parent.name}/${subfolder.name}`,
            verified: true,
            note: 'Removed only if empty',
        });
    }
    if (parent) {
        items.push({
            type: RESET_ITEM_TYPES.PARENT,
            id: String(parent.id),
            name: `Folder: ${parent.name}`,
            verified: true,
            note: 'Removed only if nothing else is in it',
        });
    }

    // ── Warnings ──
    const latestOutcomeTitles = await findLatestOutcomeTitles(courseId, apiClient);
    if (latestOutcomeTitles.length) {
        warnings.push('Every outcome below is set to the "Most Recent Score" calculation. The reset leaves it that way — ' +
            'change it in Outcomes if this course needs a different method: ' + latestOutcomeTitles.join(', ') + '.');
    }

    const lockedOverrideCount = cache ? lockedCurrentScoreStudentsFrom(cache).size : 0;
    if (lockedOverrideCount) {
        warnings.push(`${lockedOverrideCount} locked Current Score override${lockedOverrideCount === 1 ? '' : 's'} will become unlocked. ` +
            'The grades in Canvas stay, but the next Update Current Score can replace them.');
    }

    return {
        courseId: String(courseId),
        items,
        warnings,
        latestOutcomeTitles,
        lockedOverrideCount,
        cache,
        submissionsByAssignment,
    };
}

async function fetchSubmissions(courseId, assignmentId, apiClient) {
    try {
        return await apiClient.getAllPages(
            `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=submission_comments&per_page=100`,
            {},
            'CourseReset:fetchSubmissions'
        ) ?? [];
    } catch (err) {
        logger.warn(`${LOG} Could not read submissions for assignment ${assignmentId}:`, err?.message);
        return [];
    }
}

async function findLatestOutcomeTitles(courseId, apiClient) {
    try {
        const data = await apiClient.get(
            `/api/v1/courses/${courseId}/outcome_rollups?include[]=outcomes&per_page=1`,
            {},
            'CourseReset:outcomes'
        );
        return (data?.linked?.outcomes ?? [])
            .filter(o => o.calculation_method === 'latest' && !isCurrentScoreOutcome(o.title))
            .map(o => o.title);
    } catch (err) {
        logger.warn(`${LOG} Could not read outcome calculation methods:`, err?.message);
        return [];
    }
}

// ════════════════════════════════════════════════════════════════════
// Backup
// ════════════════════════════════════════════════════════════════════

/**
 * Build the backup JSON: the cache, the plan's items, and every saved Projected
 * Score grade and comment.
 *
 * @param {Object} plan - from buildResetPlan
 * @returns {Object}
 */
export function buildResetBackup(plan) {
    return {
        exportedAt: new Date().toISOString(),
        courseId: plan.courseId,
        items: plan.items,
        warnings: plan.warnings,
        cache: plan.cache,
        submissions: Object.fromEntries(Object.entries(plan.submissionsByAssignment ?? {}).map(([id, subs]) => [
            id,
            subs.map(s => ({
                user_id: s.user_id,
                score: s.score,
                grade: s.grade,
                graded_at: s.graded_at,
                comments: (s.submission_comments ?? []).map(c => ({
                    author: c.author_name, at: c.created_at, comment: c.comment,
                })),
            })),
        ])),
    };
}

/**
 * Download the backup as a JSON file.
 *
 * @param {Object} plan - from buildResetPlan
 * @returns {string} the file name
 */
export function downloadResetBackup(plan) {
    const fileName = `mastery-outlook-backup-course-${plan.courseId}-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(buildResetBackup(plan), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return fileName;
}

// ════════════════════════════════════════════════════════════════════
// Execute
// ════════════════════════════════════════════════════════════════════

/**
 * Delete the selected items, children first. Continues past errors; if any
 * delete fails, the cache file and folders are kept so a second run can still
 * verify what's left.
 *
 * @param {Object} plan - from buildResetPlan
 * @param {Set<string>|string[]} selectedKeys - resetItemKey() values to delete
 * @param {CanvasApiClient} apiClient
 * @param {Function} [onProgress] - (message: string) => void
 * @returns {Promise<{ deleted: Object[], failed: Array<{item: Object, error: string}>, kept: Array<{item: Object, reason: string}> }>}
 */
export async function executeResetPlan(plan, selectedKeys, apiClient, onProgress = () => {}) {
    const selected = new Set(selectedKeys);
    const courseId = plan.courseId;
    const result = { deleted: [], failed: [], kept: [] };
    const pick = type => plan.items.filter(i => i.type === type && selected.has(resetItemKey(i)));

    const attempt = async (item, label, fn) => {
        onProgress(label);
        try {
            await fn();
            result.deleted.push(item);
            return true;
        } catch (err) {
            logger.warn(`${LOG} ${label} failed:`, err);
            result.failed.push({ item, error: err?.message ?? String(err) });
            return false;
        }
    };

    // 1. Projected Score assignments, then each one's rubric
    for (const item of pick(RESET_ITEM_TYPES.ASSIGNMENT)) {
        const ok = await attempt(item, `Deleting ${item.name}…`, () => deleteAssignment(courseId, item.id, apiClient));
        if (ok) clearRubricAssociationCache(courseId, item.id);
        if (!item.rubric) continue;
        const rubricItem = { type: 'rubric', id: item.rubric.id, name: item.rubric.title };
        if (!ok) {
            result.kept.push({ item: rubricItem, reason: 'Its assignment could not be deleted' });
            continue;
        }
        await attempt(rubricItem, `Deleting ${item.rubric.title}…`, () => deleteRubric(courseId, item.rubric.id, apiClient));
    }

    // 2. Mastery Outlook page
    for (const item of pick(RESET_ITEM_TYPES.PAGE)) {
        const ok = await attempt(item, 'Deleting the Mastery Outlook page…', () => deletePage(courseId, item.id, apiClient));
        if (ok) removeMasteryOutlookLink();
    }

    // 3. Cache file and folders — only once everything else is gone
    const dataItems = [RESET_ITEM_TYPES.CACHE_FILE, RESET_ITEM_TYPES.SUBFOLDER, RESET_ITEM_TYPES.PARENT].flatMap(pick);
    if (result.failed.length) {
        dataItems.forEach(item => result.kept.push({ item, reason: 'Kept so the reset can be run again' }));
        return result;
    }

    let cacheGone = true;
    for (const item of pick(RESET_ITEM_TYPES.CACHE_FILE)) {
        cacheGone = await attempt(item, 'Deleting Mastery Outlook data…', () => deleteMasteryOutlookCacheFile(courseId, item.id, apiClient));
    }
    if (cacheGone) clearLmgbLockSnapshot(courseId);

    for (const item of [...pick(RESET_ITEM_TYPES.SUBFOLDER), ...pick(RESET_ITEM_TYPES.PARENT)]) {
        if (!cacheGone) {
            result.kept.push({ item, reason: 'The data file is still in it' });
            continue;
        }
        if (!(await isFolderEmpty(item.id, apiClient))) {
            result.kept.push({ item, reason: 'Other files are still in it' });
            continue;
        }
        await attempt(item, `Deleting ${item.name}…`, () => deleteMasteryOutlookFolder(courseId, item.id, apiClient));
    }

    return result;
}

async function isFolderEmpty(folderId, apiClient) {
    try {
        const [folders, files] = await Promise.all([
            apiClient.get(`/api/v1/folders/${folderId}/folders?per_page=1`, {}, 'CourseReset:subfolders'),
            apiClient.get(`/api/v1/folders/${folderId}/files?per_page=1`, {}, 'CourseReset:files'),
        ]);
        return !(folders?.length) && !(files?.length);
    } catch {
        return false;   // can't tell — keep it
    }
}

function clearRubricAssociationCache(courseId, assignmentId) {
    try {
        localStorage.removeItem(`cg_rubric_assoc_${courseId}_${assignmentId}`);
    } catch {
        // storage unavailable — nothing to clear
    }
}
