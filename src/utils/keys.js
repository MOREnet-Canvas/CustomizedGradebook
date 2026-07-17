// src/utils/keys.js
/**
 * Build a namespaced localStorage/sessionStorage key for a given course.
 *
 * @param {string} name - Base key name (e.g. "cg_courseSnapshot")
 * @param {string|number} courseId - Canvas course ID
 * @returns {string} Composite key in the form `${name}_${courseId}`
 */
export const k = (name, courseId) => `${name}_${courseId}`;
