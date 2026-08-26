// src/services/districtConfigService.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
    loadDistrictConfig,
    getEffectiveValue,
    readDistrictConfigFile,
    _resetForTests
} from './districtConfigService.js';

vi.mock('../utils/logger.js', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

function makeApiClient(overrides = {}) {
    return {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        ...overrides
    };
}

describe('districtConfigService', () => {
    let apiClient;

    beforeEach(() => {
        vi.clearAllMocks();
        _resetForTests();
        delete window.CG_DISTRICT_COURSE;
        global.fetch = vi.fn();
    });

    describe('loadDistrictConfig', () => {
        test('resolves to {} and never calls apiClient when CG_DISTRICT_COURSE is unset', async () => {
            apiClient = makeApiClient();

            const result = await loadDistrictConfig(apiClient);

            expect(result).toEqual({});
            expect(apiClient.get).not.toHaveBeenCalled();
        });

        test('fetches and parses settings on success', async () => {
            window.CG_DISTRICT_COURSE = '581';
            const settings = { ENABLE_GRADE_CUSTOM_STATUS: { value: true, locked: false } };
            apiClient = makeApiClient({
                get: vi.fn().mockResolvedValue([
                    { display_name: 'district_config.json', folder_id: 1, 'content-type': 'application/json', url: 'https://x/file' }
                ])
            });
            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify({ schemaVersion: 1, settings })
            });

            const result = await loadDistrictConfig(apiClient);

            expect(result).toEqual(settings);
        });

        test('resolves to {} when the file cannot be found', async () => {
            window.CG_DISTRICT_COURSE = '581';
            apiClient = makeApiClient({ get: vi.fn().mockResolvedValue([]) });

            const result = await loadDistrictConfig(apiClient);

            expect(result).toEqual({});
        });

        test('resolves to {} when apiClient.get throws', async () => {
            window.CG_DISTRICT_COURSE = '581';
            apiClient = makeApiClient({ get: vi.fn().mockRejectedValue(new Error('network error')) });

            const result = await loadDistrictConfig(apiClient);

            expect(result).toEqual({});
        });

        test('resolves to {} on malformed JSON', async () => {
            window.CG_DISTRICT_COURSE = '581';
            apiClient = makeApiClient({
                get: vi.fn().mockResolvedValue([
                    { display_name: 'district_config.json', folder_id: 1, 'content-type': 'application/json', url: 'https://x/file' }
                ])
            });
            global.fetch.mockResolvedValue({ ok: true, text: async () => 'not json' });

            const result = await loadDistrictConfig(apiClient);

            expect(result).toEqual({});
        });

        test('resolves to {} when schemaVersion is missing or mismatched', async () => {
            window.CG_DISTRICT_COURSE = '581';
            apiClient = makeApiClient({
                get: vi.fn().mockResolvedValue([
                    { display_name: 'district_config.json', folder_id: 1, 'content-type': 'application/json', url: 'https://x/file' }
                ])
            });
            global.fetch.mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify({ settings: { X: { value: true, locked: true } } })
            });

            const result = await loadDistrictConfig(apiClient);

            expect(result).toEqual({});
        });

        test('memoizes the in-flight fetch — concurrent calls share one network round trip', async () => {
            window.CG_DISTRICT_COURSE = '581';
            apiClient = makeApiClient({ get: vi.fn().mockResolvedValue([]) });

            const [a, b] = await Promise.all([
                loadDistrictConfig(apiClient),
                loadDistrictConfig(apiClient)
            ]);

            expect(a).toEqual(b);
            expect(apiClient.get).toHaveBeenCalledTimes(1);
        });

        test('does NOT persist across separate page loads — a fresh call after reset re-fetches', async () => {
            window.CG_DISTRICT_COURSE = '581';
            apiClient = makeApiClient({ get: vi.fn().mockResolvedValue([]) });

            await loadDistrictConfig(apiClient);
            _resetForTests(); // simulates a new page load — no sessionStorage cache exists
            await loadDistrictConfig(apiClient);

            expect(apiClient.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('readDistrictConfigFile', () => {
        test('returns null when download response is not ok', async () => {
            apiClient = makeApiClient({
                get: vi.fn().mockResolvedValue([
                    { display_name: 'district_config.json', folder_id: 1, 'content-type': 'application/json', url: 'https://x/file' }
                ])
            });
            global.fetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });

            const result = await readDistrictConfigFile('581', apiClient);

            expect(result).toBeNull();
        });
    });

    describe('getEffectiveValue', () => {
        beforeEach(() => {
            window.CG_DISTRICT_COURSE = '581';
        });

        function apiClientWithSettings(settings) {
            return makeApiClient({
                get: vi.fn().mockResolvedValue([
                    { display_name: 'district_config.json', folder_id: 1, 'content-type': 'application/json', url: 'https://x/file' }
                ]),
                _settings: settings
            });
        }

        beforeEach(() => {
            global.fetch = vi.fn().mockImplementation(async () => ({
                ok: true,
                text: async () => JSON.stringify({ schemaVersion: 1, settings: global.__testSettings ?? {} })
            }));
        });

        test('key absent from district settings -> perCourseValue ?? fallbackDefault', async () => {
            global.__testSettings = {};
            apiClient = apiClientWithSettings({});

            const result = await getEffectiveValue('ENFORCE_COURSE_OVERRIDE', undefined, false, apiClient);

            expect(result).toBe(false);
        });

        test('locked: true -> district value wins regardless of perCourseValue', async () => {
            global.__testSettings = { ENFORCE_COURSE_OVERRIDE: { value: true, locked: true } };
            apiClient = apiClientWithSettings(global.__testSettings);

            const result = await getEffectiveValue('ENFORCE_COURSE_OVERRIDE', false, false, apiClient);

            expect(result).toBe(true);
        });

        test('locked: false, perCourseValue present -> perCourseValue wins', async () => {
            global.__testSettings = { ENFORCE_COURSE_OVERRIDE: { value: true, locked: false } };
            apiClient = apiClientWithSettings(global.__testSettings);

            const result = await getEffectiveValue('ENFORCE_COURSE_OVERRIDE', false, false, apiClient);

            expect(result).toBe(false);
        });

        test('locked: false, perCourseValue absent -> district value wins (no per-course store exists yet, so this is currently equivalent to locked)', async () => {
            global.__testSettings = { ENFORCE_COURSE_OVERRIDE: { value: true, locked: false } };
            apiClient = apiClientWithSettings(global.__testSettings);

            const result = await getEffectiveValue('ENFORCE_COURSE_OVERRIDE', undefined, false, apiClient);

            expect(result).toBe(true);
        });
    });
});
