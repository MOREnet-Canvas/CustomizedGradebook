// src/services/gradeStatusService.js
/**
 * Grade Status Service
 *
 * Pure fetching service for custom grade statuses using Canvas GraphQL API.
 * Used by the Admin Dashboard Custom Grade Status Panel.
 *
 * Key responsibilities:
 * - Fetch custom grade statuses from root account
 * - Return normalized status data
 * - Handle GraphQL errors gracefully
 */

/**
 * Fetch custom grade statuses from root account
 *
 * Always fetches from root account (ID 1) regardless of current account context.
 * Returns empty array on error to allow graceful degradation.
 *
 * @param {Object} params - Parameters
 * @param {Object} params.ctx - Dashboard context with api and logger
 * @returns {Promise<Array>} Array of status objects: [{ id, _id, name, color }, ...]
 *
 * @example
 * const statuses = await getRootCustomGradeStatuses({ ctx });
 * // Returns: [
 * //   { id: "Q3VzdG9tR3JhZGVTdGF0dXMtMQ==", _id: "1", name: "Incomplete", color: "#FFD700" },
 * //   { id: "Q3VzdG9tR3JhZGVTdGF0dXMtMg==", _id: "2", name: "Excused", color: "#00FF00" }
 * // ]
 */
export async function getRootCustomGradeStatuses({ ctx }) {
    const rootAccountId = '1'; // Always fetch from root account
    
    const query = `
        query GetCustomGradeStatuses($accountId: ID!) {
            account(id: $accountId) {
                customGradeStatusesConnection {
                    nodes {
                        id
                        _id
                        name
                        color
                    }
                }
            }
        }
    `;

    const variables = {
        accountId: rootAccountId
    };

    try {
        ctx.logger.debug('[GradeStatusService] Fetching custom grade statuses from root account');
        
        const response = await ctx.api.graphql(query, variables, 'getCustomGradeStatuses');

        // Check for GraphQL errors
        if (response.errors) {
            ctx.logger.error('[GradeStatusService] GraphQL errors:', response.errors);
            return [];
        }

        // Extract and normalize data
        const nodes = response.data?.account?.customGradeStatusesConnection?.nodes || [];
        
        ctx.logger.debug(`[GradeStatusService] Fetched ${nodes.length} custom grade statuses`);
        
        return nodes;
    } catch (error) {
        ctx.logger.error('[GradeStatusService] Failed to fetch custom grade statuses:', error);
        return [];
    }
}

