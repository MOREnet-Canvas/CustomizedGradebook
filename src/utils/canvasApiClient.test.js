// src/utils/canvasApiClient.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CanvasApiClient } from './canvasApiClient.js';
import * as errorHandler from './errorHandler.js';

// Mock dependencies
vi.mock('./errorHandler.js', () => ({
    safeFetch: vi.fn(),
    safeJsonParse: vi.fn(),
}));

vi.mock('./logger.js', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

describe('CanvasApiClient', () => {
    let mockSafeFetch;
    let mockSafeJsonParse;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        
        // Setup mock implementations
        mockSafeFetch = errorHandler.safeFetch;
        mockSafeJsonParse = errorHandler.safeJsonParse;
        
        // Mock document.cookie
        Object.defineProperty(document, 'cookie', {
            writable: true,
            value: '_csrf_token=test-csrf-token-12345',
        });
    });

    // ===== HIGH VALUE: Constructor & Token Caching =====

    describe('Constructor & Token Caching', () => {
        test('caches CSRF token from cookie on initialization', () => {
            const client = new CanvasApiClient();
            expect(client.csrfToken).toBe('test-csrf-token-12345');
        });

        test('throws error if CSRF token not found', () => {
            document.cookie = '';
            
            expect(() => {
                new CanvasApiClient();
            }).toThrow('CSRF token not found - user may not be authenticated');
        });

        test('decodes URL-encoded CSRF token', () => {
            document.cookie = '_csrf_token=test%20token%2Bspecial%3Dchars';
            
            const client = new CanvasApiClient();
            expect(client.csrfToken).toBe('test token+special=chars');
        });

        test('finds CSRF token among multiple cookies', () => {
            document.cookie = 'session_id=abc123; _csrf_token=my-token; user_id=456';
            
            const client = new CanvasApiClient();
            expect(client.csrfToken).toBe('my-token');
        });

        test('reuses cached token for multiple requests', async () => {
            const client = new CanvasApiClient();
            const mockResponse = { data: 'test' };
            
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue(mockResponse);

            await client.get('/api/v1/test1');
            await client.get('/api/v1/test2');
            await client.post('/api/v1/test3', { foo: 'bar' });

            // Token should be cached - document.cookie only read once in constructor
            expect(client.csrfToken).toBe('test-csrf-token-12345');
        });
    });

    // ===== HIGH VALUE: CSRF Token Injection =====

    describe('CSRF Token Injection', () => {
        test('injects CSRF token in X-CSRF-Token header for all requests', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.get('/api/v1/test');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-CSRF-Token': 'test-csrf-token-12345'
                    })
                }),
                'get'
            );
        });

        test('injects authenticity_token in request body for POST', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { foo: 'bar' });

            const callArgs = mockSafeFetch.mock.calls[0];
            const bodyString = callArgs[1].body;
            const bodyData = JSON.parse(bodyString);

            expect(bodyData.authenticity_token).toBe('test-csrf-token-12345');
            expect(bodyData.foo).toBe('bar');
        });

        test('injects authenticity_token in request body for PUT', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.put('/api/v1/test', { foo: 'bar' });

            const callArgs = mockSafeFetch.mock.calls[0];
            const bodyString = callArgs[1].body;
            const bodyData = JSON.parse(bodyString);

            expect(bodyData.authenticity_token).toBe('test-csrf-token-12345');
        });

        test('does not override existing authenticity_token in body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { 
                foo: 'bar',
                authenticity_token: 'custom-token'
            });

            const callArgs = mockSafeFetch.mock.calls[0];
            const bodyString = callArgs[1].body;
            const bodyData = JSON.parse(bodyString);

            expect(bodyData.authenticity_token).toBe('custom-token');
        });

        test('uses both header and body token (belt and suspenders)', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { foo: 'bar' });

            const callArgs = mockSafeFetch.mock.calls[0];
            const headers = callArgs[1].headers;
            const bodyData = JSON.parse(callArgs[1].body);

            expect(headers['X-CSRF-Token']).toBe('test-csrf-token-12345');
            expect(bodyData.authenticity_token).toBe('test-csrf-token-12345');
        });
    });

    // ===== HIGH VALUE: HTTP Method Implementations =====

    describe('HTTP Methods', () => {
        test('GET request uses correct method and no body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({ data: 'test' });

            await client.get('/api/v1/courses/123');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/courses/123',
                expect.objectContaining({
                    method: 'GET',
                    body: null
                }),
                'get'
            );
        });

        test('POST request uses correct method and includes body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({ id: '456' });

            await client.post('/api/v1/courses/123/assignments', {
                assignment: { name: 'Test' }
            });

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/courses/123/assignments',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(String)
                }),
                'post'
            );
        });

        test('PUT request uses correct method and includes body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.put('/api/v1/courses/123/assignments/456', {
                assignment: { name: 'Updated' }
            });

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/courses/123/assignments/456',
                expect.objectContaining({
                    method: 'PUT',
                    body: expect.any(String)
                }),
                'put'
            );
        });

        test('DELETE request uses correct method and no body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.delete('/api/v1/courses/123/assignments/456');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/courses/123/assignments/456',
                expect.objectContaining({
                    method: 'DELETE',
                    body: null
                }),
                'delete'
            );
        });
    });

    // ===== HIGH VALUE: GraphQL Support =====

    describe('GraphQL Method', () => {
        test('sends GraphQL query to /api/graphql endpoint', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({ data: { user: { name: 'Test' } } });

            const query = 'query { user { name } }';
            await client.graphql(query);

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/graphql',
                expect.any(Object),
                'graphql'
            );
        });

        test('includes query and variables in request body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            const query = 'mutation SetOverride($enrollmentId: ID!) { setOverrideScore(input: { enrollmentId: $enrollmentId }) }';
            const variables = { enrollmentId: '123' };

            await client.graphql(query, variables);

            const callArgs = mockSafeFetch.mock.calls[0];
            const bodyData = JSON.parse(callArgs[1].body);

            expect(bodyData.query).toBe(query);
            expect(bodyData.variables).toEqual(variables);
        });

        test('uses POST method for GraphQL', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.graphql('query { test }');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/graphql',
                expect.objectContaining({
                    method: 'POST'
                }),
                'graphql'
            );
        });

        test('includes CSRF token in GraphQL requests', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.graphql('query { test }');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/graphql',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-CSRF-Token': 'test-csrf-token-12345'
                    })
                }),
                'graphql'
            );
        });
    });

    // ===== MEDIUM VALUE: Request Configuration =====

    describe('Request Configuration', () => {
        test('sets Content-Type to application/json by default', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { foo: 'bar' });

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                }),
                'post'
            );
        });

        test('sets credentials to same-origin', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.get('/api/v1/test');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    credentials: 'same-origin'
                }),
                'get'
            );
        });

        test('allows custom headers via options', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.get('/api/v1/test', {
                headers: {
                    'Accept': 'application/json',
                    'X-Custom-Header': 'custom-value'
                }
            });

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Accept': 'application/json',
                        'X-Custom-Header': 'custom-value',
                        'X-CSRF-Token': 'test-csrf-token-12345'
                    })
                }),
                'get'
            );
        });

        test('custom headers do not override CSRF token', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { foo: 'bar' }, {
                headers: {
                    'X-CSRF-Token': 'should-be-overridden'
                }
            });

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-CSRF-Token': 'test-csrf-token-12345'
                    })
                }),
                'post'
            );
        });
    });

    // ===== MEDIUM VALUE: Error Handling Integration =====

    describe('Error Handling', () => {
        test('propagates errors from safeFetch', async () => {
            const client = new CanvasApiClient();
            const testError = new Error('Network error');
            mockSafeFetch.mockRejectedValue(testError);

            await expect(client.get('/api/v1/test')).rejects.toThrow('Network error');
        });

        test('propagates errors from safeJsonParse', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            const parseError = new Error('Invalid JSON');
            mockSafeJsonParse.mockRejectedValue(parseError);

            await expect(client.get('/api/v1/test')).rejects.toThrow('Invalid JSON');
        });

        test('passes context parameter to safeFetch for error logging', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.get('/api/v1/test', {}, 'customContext');

            expect(mockSafeFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Object),
                'customContext'
            );
        });

        test('passes context parameter to safeJsonParse for error logging', async () => {
            const client = new CanvasApiClient();
            const mockResponse = {};
            mockSafeFetch.mockResolvedValue(mockResponse);
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { foo: 'bar' }, {}, 'createTest');

            expect(mockSafeJsonParse).toHaveBeenCalledWith(
                mockResponse,
                'createTest'
            );
        });
    });

    // ===== MEDIUM VALUE: Response Handling =====

    describe('Response Handling', () => {
        test('returns parsed JSON response from GET', async () => {
            const client = new CanvasApiClient();
            const mockData = { id: '123', name: 'Test Assignment' };
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue(mockData);

            const result = await client.get('/api/v1/courses/123/assignments/456');

            expect(result).toEqual(mockData);
        });

        test('returns parsed JSON response from POST', async () => {
            const client = new CanvasApiClient();
            const mockData = { id: '789', created: true };
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue(mockData);

            const result = await client.post('/api/v1/test', { foo: 'bar' });

            expect(result).toEqual(mockData);
        });

        test('handles empty response body', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue(null);

            const result = await client.delete('/api/v1/test');

            expect(result).toBeNull();
        });

        test('calls safeJsonParse with response from safeFetch', async () => {
            const client = new CanvasApiClient();
            const mockResponse = { status: 200, ok: true };
            mockSafeFetch.mockResolvedValue(mockResponse);
            mockSafeJsonParse.mockResolvedValue({ data: 'test' });

            await client.get('/api/v1/test');

            expect(mockSafeJsonParse).toHaveBeenCalledWith(mockResponse, 'get');
        });
    });

    // ===== MEDIUM VALUE: Special Cases =====

    describe('Special Cases', () => {
        test('handles CSV content type for outcome import', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({ id: '123' });

            await client.post('/api/v1/courses/123/outcome_imports',
                'vendor_guid,object_type,title\n"test",outcome,"Test Outcome"',
                {
                    headers: {
                        'Content-Type': 'text/csv'
                    }
                }
            );

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/courses/123/outcome_imports',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'text/csv',
                        'X-CSRF-Token': 'test-csrf-token-12345'
                    })
                }),
                'post'
            );
        });

        test('handles null data parameter', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', null);

            const callArgs = mockSafeFetch.mock.calls[0];
            expect(callArgs[1].body).toBeNull();
        });

        test('handles undefined data parameter', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', undefined);

            const callArgs = mockSafeFetch.mock.calls[0];
            expect(callArgs[1].body).toBeNull();
        });

        test('handles empty object data parameter', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', {});

            const callArgs = mockSafeFetch.mock.calls[0];
            const bodyData = JSON.parse(callArgs[1].body);

            expect(bodyData.authenticity_token).toBe('test-csrf-token-12345');
        });

        test('handles nested data structures', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            const complexData = {
                assignment: {
                    name: 'Test',
                    rubric: {
                        criteria: [
                            { description: 'Criterion 1', points: 10 }
                        ]
                    }
                }
            };

            await client.post('/api/v1/test', complexData);

            const callArgs = mockSafeFetch.mock.calls[0];
            const bodyData = JSON.parse(callArgs[1].body);

            expect(bodyData.assignment.rubric.criteria[0].description).toBe('Criterion 1');
            expect(bodyData.authenticity_token).toBe('test-csrf-token-12345');
        });
    });

    // ===== MEDIUM VALUE: Integration with safeFetch =====

    describe('safeFetch Integration', () => {
        test('passes all fetch options to safeFetch', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            const customOptions = {
                headers: { 'Accept': 'application/json' },
                signal: new AbortController().signal,
            };

            await client.get('/api/v1/test', customOptions);

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    signal: customOptions.signal,
                    credentials: 'same-origin',
                    method: 'GET'
                }),
                'get'
            );
        });

        test('merges custom options with default options', async () => {
            const client = new CanvasApiClient();
            mockSafeFetch.mockResolvedValue({});
            mockSafeJsonParse.mockResolvedValue({});

            await client.post('/api/v1/test', { foo: 'bar' }, {
                cache: 'no-cache',
                redirect: 'follow'
            });

            expect(mockSafeFetch).toHaveBeenCalledWith(
                '/api/v1/test',
                expect.objectContaining({
                    cache: 'no-cache',
                    redirect: 'follow',
                    method: 'POST',
                    credentials: 'same-origin'
                }),
                'post'
            );
        });
    });
});

