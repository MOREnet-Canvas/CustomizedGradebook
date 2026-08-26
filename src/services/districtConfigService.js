// src/services/districtConfigService.js
/**
 * District Config Service
 *
 * Fetches and resolves district-wide settings stored as a Canvas Files API JSON
 * file in the district config course (window.CG_DISTRICT_COURSE). This is an
 * opt-in accessor for call sites that want district-lockable behavior — it does
 * NOT feed into src/config.js, since config.js reads window.CG_CONFIG
 * synchronously at module-load time, before any async fetch here could resolve.
 *
 * No per-course settings store exists yet, so until one does, "unlocked"
 * behaves identically to "locked" in practice — the district value applies
 * either way. This is expected, not a defect (see getEffectiveValue below).
 *
 * Fetched fresh on every page load — no sessionStorage/persistent cache.
 * The in-flight fetch is memoized so multiple getEffectiveValue() calls on
 * the same page share one network round trip.
 */

import { logger } from '../utils/logger.js';

const PARENT_FOLDER_NAME = 'MOREnet_CustomizedGradebook';
const FOLDER_NAME = 'district_config';
const FILE_NAME = 'district_config.json';
const SCHEMA_VERSION = 1;

/** In-flight/resolved load promise, memoized for the lifetime of this page load only. */
let _loadPromise = null;

/**
 * Reset internal memoization. Test-only.
 */
export function _resetForTests() {
    _loadPromise = null;
}

/**
 * Load district config for this page load. Safe to call multiple times —
 * concurrent/subsequent calls in the same page load share one fetch.
 * Never throws; always resolves to a settings map (possibly empty).
 *
 * @param {import('../utils/canvasApiClient.js').CanvasApiClient} apiClient
 * @returns {Promise<Object>} settings map: { [key]: { value, locked } }
 */
export async function loadDistrictConfig(apiClient) {
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
        const districtCourseId = window.CG_DISTRICT_COURSE;
        if (!districtCourseId) {
            logger.debug('[DistrictConfigService] CG_DISTRICT_COURSE not set, skipping fetch');
            return {};
        }

        try {
            const fileData = await readDistrictConfigFile(districtCourseId, apiClient);
            return fileData?.settings ?? {};
        } catch (error) {
            logger.warn('[DistrictConfigService] Failed to load district config, using defaults', error);
            return {};
        }
    })();

    return _loadPromise;
}

/**
 * Resolve the effective value of a district-lockable setting.
 *
 * - Key absent from district settings -> perCourseValue ?? fallbackDefault
 * - locked: true                      -> district value wins outright
 * - locked: false                     -> perCourseValue ?? district value ?? fallbackDefault
 *
 * NOTE: No per-course settings store exists yet, so perCourseValue will
 * typically be undefined/null at every call site today. That means unlocked
 * currently behaves identically to locked in practice — this is expected,
 * not a defect, until a per-course store is built separately.
 *
 * @param {string} key
 * @param {*} perCourseValue - existing per-course value, if any (may be undefined/null)
 * @param {*} fallbackDefault - value to use if neither district nor per-course has one
 * @param {import('../utils/canvasApiClient.js').CanvasApiClient} apiClient
 * @returns {Promise<*>}
 */
export async function getEffectiveValue(key, perCourseValue, fallbackDefault, apiClient) {
    const settings = await loadDistrictConfig(apiClient);
    const entry = settings[key];

    if (!entry) {
        return perCourseValue ?? fallbackDefault;
    }

    if (entry.locked) {
        return entry.value;
    }

    return perCourseValue ?? entry.value ?? fallbackDefault;
}

// ═══════════════════════════════════════════════════════════════════════
// FILES API STORAGE
//
// Mirrors src/masteryOutlook/masteryOutlookCacheService.js's 3-step upload
// pattern, with one deliberate deviation: this file is never locked. Canvas
// checks the `locked` flag before `visibility_level` — a locked file blocks
// institution-visibility reads even for authenticated students (confirmed by
// live testing). Write access is already restricted by the district course's
// manage_files permission, so locking here adds no protection and would
// silently break student-side reads.
// ═══════════════════════════════════════════════════════════════════════

/** Per-district-course memoized folder ID — folder structure never changes once created. */
const _cachedFolderIdByCourse = new Map();

function invalidateFolderCache(districtCourseId) {
    _cachedFolderIdByCourse.delete(String(districtCourseId));
}

/**
 * Ensure the folder structure exists: MOREnet_CustomizedGradebook/district_config/
 * Returns the folder ID of the district_config subfolder.
 *
 * Unlike masteryOutlookCacheService.js's equivalent, folders here are NOT
 * locked — this data must remain student-readable via visibility_level on
 * the file itself. Confirmed by live testing on morenetlab (course 581,
 * scripts/canvas-test/verifyVisibility.js): a locked folder blocks student
 * reads exactly like a locked file, even when the file inside it is unlocked
 * and visibility_level: institution. Locking either folder in this chain
 * would silently break student reads the same way locking the file does.
 *
 * @param {string} districtCourseId
 * @param {import('../utils/canvasApiClient.js').CanvasApiClient} apiClient
 * @returns {Promise<string>} Folder ID of district_config subfolder
 */
export async function ensureFolder(districtCourseId, apiClient) {
    const cacheKey = String(districtCourseId);
    const cached = _cachedFolderIdByCourse.get(cacheKey);
    if (cached) return cached;

    const rootFolder = await apiClient.get(
        `/api/v1/courses/${districtCourseId}/folders/root`,
        {},
        'districtConfigService:getRootFolder'
    );

    const parentFolderId = await ensureNamedFolder(
        districtCourseId,
        apiClient,
        PARENT_FOLDER_NAME,
        rootFolder.id
    );
    const folderId = await ensureNamedFolder(
        districtCourseId,
        apiClient,
        FOLDER_NAME,
        parentFolderId
    );

    logger.info(`[DistrictConfigService] Folder structure ready: ${PARENT_FOLDER_NAME}/${FOLDER_NAME} (id: ${folderId})`);
    _cachedFolderIdByCourse.set(cacheKey, folderId);
    return folderId;
}

/**
 * Find-or-create a folder by name under a given parent, without locking it.
 * @private
 */
async function ensureNamedFolder(districtCourseId, apiClient, name, parentFolderId) {
    const allFolders = await apiClient.get(
        `/api/v1/courses/${districtCourseId}/folders?per_page=100`,
        {},
        'districtConfigService:listFolders'
    );
    const existing = allFolders.find(f =>
        f.name === name &&
        f.parent_folder_id === parentFolderId &&
        !f.deleted
    );
    if (existing) {
        return existing.id;
    }

    try {
        const folder = await apiClient.post(
            `/api/v1/courses/${districtCourseId}/folders`,
            {
                name,
                parent_folder_id: parentFolderId,
                hidden: false,
                locked: false
            },
            {},
            'districtConfigService:createFolder'
        );
        return folder.id;
    } catch (error) {
        // Handle name conflict - folder may exist but wasn't found in initial search
        if (error.message.includes('already exists') || error.message.includes('taken')) {
            const allFoldersRetry = await apiClient.get(
                `/api/v1/courses/${districtCourseId}/folders?per_page=100`,
                {},
                'districtConfigService:listFoldersRetry'
            );
            const existingRetry = allFoldersRetry.find(f =>
                f.name === name && f.parent_folder_id === parentFolderId
            );
            if (existingRetry) {
                return existingRetry.id;
            }
        }
        throw new Error(`Could not create folder "${name}": ${error.message}`);
    }
}

/**
 * Write district config to Canvas Files API.
 *
 * @param {string} districtCourseId
 * @param {import('../utils/canvasApiClient.js').CanvasApiClient} apiClient
 * @param {Object} settings - settings map: { [key]: { value, locked } }
 * @returns {Promise<Object>} Canvas file object
 */
export async function writeDistrictConfig(districtCourseId, apiClient, settings) {
    try {
        const folderId = await ensureFolder(districtCourseId, apiClient);

        const fileData = {
            schemaVersion: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            settings
        };

        const jsonContent = JSON.stringify(fileData, null, 2);
        const fileSize = new Blob([jsonContent]).size;

        // Step 1: Request upload instructions
        const uploadInstructions = await apiClient.post(
            `/api/v1/courses/${districtCourseId}/files`,
            {
                name: FILE_NAME,
                size: fileSize,
                content_type: 'application/json',
                parent_folder_id: folderId,
                on_duplicate: 'overwrite'
            },
            {},
            'districtConfigService:requestUpload'
        );

        // Step 2: Upload file to Canvas storage
        const formData = new FormData();
        Object.entries(uploadInstructions.upload_params).forEach(([key, value]) => {
            formData.append(key, value);
        });
        formData.append('file', new Blob([jsonContent], { type: 'application/json' }), FILE_NAME);

        const uploadResponse = await fetch(uploadInstructions.upload_url, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();

        // Step 3: Set visibility (NOT locked — see file header comment for why).
        const fileId = uploadResult.id;
        const finalFile = await apiClient.put(
            `/api/v1/files/${fileId}`,
            {
                locked: false,
                hidden: false,
                visibility_level: 'institution'
            },
            {},
            'districtConfigService:setVisibility'
        );

        logger.info(`[DistrictConfigService] District config written successfully (file id: ${fileId})`);
        return finalFile;

    } catch (error) {
        logger.error('[DistrictConfigService] Failed to write district config', error);
        invalidateFolderCache(districtCourseId);
        throw new Error(`Could not write district config: ${error.message}`);
    }
}

/**
 * Read district config from Canvas Files API.
 *
 * Returns null if the file does not exist, the schema version doesn't match,
 * or the file is corrupted/invalid JSON. Never throws.
 *
 * @param {string} districtCourseId
 * @param {import('../utils/canvasApiClient.js').CanvasApiClient} apiClient
 * @returns {Promise<Object|null>}
 */
export async function readDistrictConfigFile(districtCourseId, apiClient) {
    try {
        const searchResults = await apiClient.get(
            `/api/v1/courses/${districtCourseId}/files`,
            {
                search_term: FILE_NAME,
                content_types: ['application/json'],
                per_page: 10
            },
            'districtConfigService:searchFile'
        );

        const configFile = searchResults.find(f =>
            f.display_name === FILE_NAME &&
            f.folder_id &&
            f['content-type'] === 'application/json'
        );

        if (!configFile) {
            logger.debug('[DistrictConfigService] No district config file found');
            return null;
        }

        const fileResponse = await fetch(configFile.url, { credentials: 'include' });
        if (!fileResponse.ok) {
            throw new Error(`Failed to download district config: ${fileResponse.status} ${fileResponse.statusText}`);
        }

        const jsonText = await fileResponse.text();
        const fileData = JSON.parse(jsonText);

        if (fileData.schemaVersion !== SCHEMA_VERSION) {
            logger.warn(
                `[DistrictConfigService] Schema version mismatch. ` +
                `Expected: ${SCHEMA_VERSION}, Found: ${fileData.schemaVersion ?? 'none'}. Discarding.`
            );
            return null;
        }

        return fileData;

    } catch (error) {
        if (error.message.includes('JSON')) {
            logger.error('[DistrictConfigService] District config file is corrupted (invalid JSON)', error);
        } else {
            logger.error('[DistrictConfigService] Failed to read district config', error);
        }
        return null;
    }
}

export { SCHEMA_VERSION, FILE_NAME, FOLDER_NAME, PARENT_FOLDER_NAME };
