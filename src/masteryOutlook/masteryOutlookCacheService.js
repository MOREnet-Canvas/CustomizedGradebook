// src/MasteryOutlook/outcomesCacheService.js
/**
 * Outcomes Cache Service
 *
 * Handles reading and writing the outcomes cache file to Canvas Files API.
 * Cache file: MOREnet_CustomizedGradebook/mastery_outlook_cache/mastery_outlook_cache.json
 * Permissions: locked (unpublished), hidden: false (teachers can access)
 *
 * Schema versioning: Files with mismatched schemaVersion are discarded.
 */

import { logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Schema version for outcomes cache structure.
 * If cache.metadata.schemaVersion does not match this, cache is discarded.
 */
const SCHEMA_VERSION = '1.0';

const PARENT_FOLDER_NAME = 'MOREnet_CustomizedGradebook';
const FOLDER_NAME = 'mastery_outlook_cache';
const FILE_NAME = 'mastery_outlook_cache.json';

// ═══════════════════════════════════════════════════════════════════════
// FOLDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ensure the folder structure exists: MOREnet_CustomizedGradebook/mastery_outlook_cache/
 * Returns the folder ID of the mastery_outlook_cache subfolder.
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<string>} Folder ID of mastery_outlook_cache subfolder
 */
export async function ensureFolder(courseId, apiClient) {
    try {
        // Step 1: Get root folder ID
        const rootFolder = await apiClient.get(
            `/api/v1/courses/${courseId}/folders/root`,
            {},
            'ensureFolder:getRootFolder'
        );
        const rootFolderId = rootFolder.id;
        logger.debug(`[outcomesCacheService] Root folder ID: ${rootFolderId}`);

        // Step 2: Ensure parent folder exists
        const parentFolderId = await ensureParentFolder(courseId, apiClient, rootFolderId);

        // Step 3: Ensure subfolder exists
        const folderId = await ensureSubfolder(courseId, apiClient, parentFolderId);

        logger.info(`[outcomesCacheService] Folder structure ready: ${PARENT_FOLDER_NAME}/${FOLDER_NAME} (id: ${folderId})`);
        return folderId;

    } catch (error) {
        logger.error('[outcomesCacheService] Failed to ensure folder structure', error);
        throw new Error(`Could not create cache folder: ${error.message}`);
    }
}

/**
 * Ensure parent folder (MOREnet_CustomizedGradebook) exists
 * @private
 */
async function ensureParentFolder(courseId, apiClient, rootFolderId) {
    // Try to find existing parent folder
    try {
        const allFolders = await apiClient.get(
            `/api/v1/courses/${courseId}/folders?per_page=100`,
            {},
            'ensureFolder:listFolders'
        );
        const existing = allFolders.find(f => f.name === PARENT_FOLDER_NAME && !f.deleted);

        if (existing) {
            logger.debug(`[outcomesCacheService] Parent folder exists (id: ${existing.id})`);
            await lockFolder(apiClient, existing.id);
            return existing.id;
        }
    } catch (error) {
        logger.warn('[outcomesCacheService] Could not list folders, will try to create parent', error);
    }

    // Create parent folder
    try {
        const folder = await apiClient.post(
            `/api/v1/courses/${courseId}/folders`,
            {
                name: PARENT_FOLDER_NAME,
                parent_folder_id: rootFolderId,
                hidden: false,  // Visible to teachers
                locked: true    // UNPUBLISHED - blocks student access
            },
            {},
            'ensureFolder:createParentFolder'
        );
        logger.info(`[outcomesCacheService] Parent folder created (id: ${folder.id})`);
        await lockFolder(apiClient, folder.id);
        return folder.id;

    } catch (error) {
        // Handle name conflict - folder may exist but wasn't found in initial search
        if (error.message.includes('already exists') || error.message.includes('taken')) {
            logger.debug('[outcomesCacheService] Parent folder name conflict, searching again...');
            const allFolders = await apiClient.get(
                `/api/v1/courses/${courseId}/folders?per_page=100`,
                {},
                'ensureFolder:listFoldersRetry'
            );
            const existing = allFolders.find(f => f.name === PARENT_FOLDER_NAME);

            if (existing) {
                logger.info(`[outcomesCacheService] Found existing parent folder (id: ${existing.id})`);
                await lockFolder(apiClient, existing.id);
                return existing.id;
            }
        }

        throw new Error(`Could not create parent folder: ${error.message}`);
    }
}

/**
 * Ensure subfolder (mastery_outlook_cache) exists
 * @private
 */
async function ensureSubfolder(courseId, apiClient, parentFolderId) {
    // Try to find existing subfolder
    try {
        const allFolders = await apiClient.get(
            `/api/v1/courses/${courseId}/folders?per_page=100`,
            {},
            'ensureFolder:listFolders'
        );
        const existing = allFolders.find(f =>
            f.name === FOLDER_NAME &&
            f.parent_folder_id === parentFolderId &&
            !f.deleted
        );

        if (existing) {
            logger.debug(`[outcomesCacheService] Subfolder exists (id: ${existing.id})`);
            await lockFolder(apiClient, existing.id);
            return existing.id;
        }
    } catch (error) {
        logger.warn('[outcomesCacheService] Could not list folders, will try to create subfolder', error);
    }

    // Create subfolder
    try {
        const folder = await apiClient.post(
            `/api/v1/courses/${courseId}/folders`,
            {
                name: FOLDER_NAME,
                parent_folder_id: parentFolderId,
                hidden: false,  // Visible to teachers
                locked: true    // UNPUBLISHED - blocks student access
            },
            {},
            'ensureFolder:createSubfolder'
        );
        logger.info(`[outcomesCacheService] Subfolder created (id: ${folder.id})`);
        await lockFolder(apiClient, folder.id);
        return folder.id;

    } catch (error) {
        // Handle name conflict
        if (error.message.includes('already exists') || error.message.includes('taken')) {
            logger.debug('[outcomesCacheService] Subfolder name conflict, searching again...');
            const allFolders = await apiClient.get(
                `/api/v1/courses/${courseId}/folders?per_page=100`,
                {},
                'ensureFolder:listFoldersRetry'
            );
            const existing = allFolders.find(f =>
                f.name === FOLDER_NAME &&
                f.parent_folder_id === parentFolderId
            );

            if (existing) {
                logger.info(`[outcomesCacheService] Found existing subfolder (id: ${existing.id})`);
                await lockFolder(apiClient, existing.id);
                return existing.id;
            }
        }

        throw new Error(`Could not create subfolder: ${error.message}`);
    }
}

/**
 * Ensure folder is locked (unpublished) to prevent student access
 * @private
 */
async function lockFolder(apiClient, folderId) {
    try {
        await apiClient.put(
            `/api/v1/folders/${folderId}`,
            {
                hidden: false,           // Teachers can see it
                locked: true,            // UNPUBLISHED - students blocked
                unlock_at: '',
                lock_at: '',
                visibility_level: 'inherit'
            },
            {},
            'lockFolder'
        );
        logger.debug(`[outcomesCacheService] Folder ${folderId} set to UNPUBLISHED`);
    } catch (error) {
        logger.warn(`[outcomesCacheService] Could not lock folder ${folderId}`, error);
        // Non-fatal - folder may already be locked
    }
}

// ═══════════════════════════════════════════════════════════════════════
// WRITE CACHE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Write outcomes cache to Canvas Files API
 *
 * 3-step process:
 * 1. Request upload URL from Canvas
 * 2. Upload file to that URL
 * 3. Confirm upload completion
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @param {Object} cacheData - Complete outcomes cache data structure
 * @returns {Promise<Object>} Canvas file object
 */
export async function writeOutcomesCache(courseId, apiClient, cacheData) {
    try {
        // Ensure folder exists
        const folderId = await ensureFolder(courseId, apiClient);

        // Add schema version to metadata
        const cacheWithVersion = {
            ...cacheData,
            metadata: {
                ...cacheData.metadata,
                schemaVersion: SCHEMA_VERSION
            }
        };

        const jsonContent = JSON.stringify(cacheWithVersion, null, 2);
        const fileSize = new Blob([jsonContent]).size;

        logger.info(`[outcomesCacheService] Writing cache (${fileSize} bytes) to Canvas Files...`);

        // Step 1: Request upload instructions
        const uploadInstructions = await apiClient.post(
            `/api/v1/courses/${courseId}/files`,
            {
                name: FILE_NAME,
                size: fileSize,
                content_type: 'application/json',
                parent_folder_id: folderId,
                on_duplicate: 'overwrite'  // Replace existing file
            },
            {},
            'writeOutcomesCache:requestUpload'
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

        // Step 3: Confirm upload and lock file
        const fileId = uploadResult.id;
        const finalFile = await apiClient.put(
            `/api/v1/files/${fileId}`,
            {
                locked: true,            // UNPUBLISHED
                hidden: false,           // Teachers can access
                visibility_level: 'inherit'
            },
            {},
            'writeOutcomesCache:lockFile'
        );

        logger.info(`[outcomesCacheService] Cache written successfully (file id: ${fileId})`);
        return finalFile;

    } catch (error) {
        logger.error('[outcomesCacheService] Failed to write cache', error);
        throw new Error(`Could not write outcomes cache: ${error.message}`);
    }
}


// ═══════════════════════════════════════════════════════════════════════
// READ CACHE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Read outcomes cache from Canvas Files API
 *
 * Returns null if:
 * - Cache file does not exist
 * - Schema version does not match SCHEMA_VERSION
 * - File is corrupted/invalid JSON
 *
 * @param {string} courseId - Canvas course ID
 * @param {CanvasApiClient} apiClient - Canvas API client instance
 * @returns {Promise<Object|null>} Parsed cache data, or null if unavailable/invalid
 */
export async function readOutcomesCache(courseId, apiClient) {
    try {
        logger.info('[outcomesCacheService] Reading cache from Canvas Files...');

        // Step 1: Search for the cache file
        const searchResults = await apiClient.get(
            `/api/v1/courses/${courseId}/files`,
            {
                search_term: FILE_NAME,
                content_types: ['application/json'],
                per_page: 10
            },
            'readOutcomesCache:searchFile'
        );

        // Find exact match in mastery_outlook_cache folder
        const cacheFile = searchResults.find(f =>
            f.display_name === FILE_NAME &&
            f.folder_id &&
            f['content-type'] === 'application/json'
        );

        if (!cacheFile) {
            logger.info('[outcomesCacheService] No cache file found');
            return null;
        }

        logger.debug(`[outcomesCacheService] Cache file found (id: ${cacheFile.id})`);

        // Step 2: Download file content
        const fileResponse = await fetch(cacheFile.url, {
            credentials: 'include'
        });

        if (!fileResponse.ok) {
            throw new Error(`Failed to download cache: ${fileResponse.status} ${fileResponse.statusText}`);
        }

        const jsonText = await fileResponse.text();
        const cacheData = JSON.parse(jsonText);

        // Step 3: Validate schema version
        const cacheVersion = cacheData.metadata?.schemaVersion;

        if (cacheVersion !== SCHEMA_VERSION) {
            logger.warn(
                `[outcomesCacheService] Schema version mismatch. ` +
                `Expected: ${SCHEMA_VERSION}, Found: ${cacheVersion || 'none'}. ` +
                `Discarding cache.`
            );
            return null;
        }

        logger.info('[outcomesCacheService] Cache loaded successfully');
        return cacheData;

    } catch (error) {
        if (error.message.includes('JSON')) {
            logger.error('[outcomesCacheService] Cache file is corrupted (invalid JSON)', error);
        } else {
            logger.error('[outcomesCacheService] Failed to read cache', error);
        }
        return null;  // Treat all read errors as "no cache"
    }
}

/**
 * Export schema version for external validation
 */
export { SCHEMA_VERSION };