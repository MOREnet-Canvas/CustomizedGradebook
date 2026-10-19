// scripts/canvas-test/canvasClient.js
/**
 * Shared Bearer-token Canvas API client for the standalone morenetlab
 * verification harness in this directory.
 *
 * This is a TEST-ONLY tool, completely separate from the application's own
 * Canvas API access. Application code (src/services/districtConfigService.js,
 * src/utils/canvasApiClient.js, districtSettings/districtSettings.html) always
 * authenticates via session cookie + CSRF token and must never use Bearer
 * token auth. This file exists only so a Node script (no browser session
 * available) can independently re-verify Canvas platform behavior.
 *
 * Hard-guarded to morenetlab only — see assertTestInstance() below.
 */

const CANVAS_HOST = process.env.CANVAS_TEST_HOST || 'morenetlab.instructure.com';
const TOKEN = process.env.CANVAS_TEST_TOKEN;

function assertTestInstance() {
    if (!CANVAS_HOST.includes('morenetlab')) {
        throw new Error(
            `Refusing to run: CANVAS_TEST_HOST ("${CANVAS_HOST}") does not look like the ` +
            `morenetlab test instance. This harness must never target morenet.instructure.com ` +
            `(production), regardless of what the token is technically capable of reaching.`
        );
    }
    if (!TOKEN) {
        throw new Error(
            'CANVAS_TEST_TOKEN environment variable is required. See scripts/canvas-test/README.md.'
        );
    }
}

assertTestInstance();

const BASE_URL = `https://${CANVAS_HOST}`;

/**
 * @param {string} method
 * @param {string} path - e.g. '/api/v1/courses/581/files'
 * @param {Object} [opts]
 * @param {number|string} [opts.asUserId] - Canvas user ID to masquerade as (requires
 *   "Act as User" permission on the token's own account). Omit to call as the token's
 *   own (admin) user.
 * @param {Object} [opts.body] - JSON body for POST/PUT.
 * @param {URLSearchParams|Object} [opts.query] - extra query params.
 * @returns {Promise<Response>} raw fetch Response — caller reads .status/.json()/.text()
 */
export async function canvasRequest(method, path, opts = {}) {
    const { asUserId, body, query } = opts;
    const url = new URL(BASE_URL + path);
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value);
        }
    }
    if (asUserId) {
        url.searchParams.set('as_user_id', String(asUserId));
    }

    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    return res;
}

export const canvasGet = (path, opts) => canvasRequest('GET', path, opts);
export const canvasPost = (path, opts) => canvasRequest('POST', path, opts);
export const canvasPut = (path, opts) => canvasRequest('PUT', path, opts);
export const canvasDelete = (path, opts) => canvasRequest('DELETE', path, opts);

export { BASE_URL, CANVAS_HOST };
