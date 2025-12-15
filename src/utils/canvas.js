// src/utils/canvas.js
import { AVG_ASSIGNMENT_NAME } from "../config.js";
import { logger } from "./logger.js";

export function getCourseId() {
    const envCourseId = ENV?.COURSE_ID;
    const pathCourseId = window.location.pathname.match(/courses\/(\d+)/)?.[1] ?? null;
    const courseId = envCourseId || pathCourseId;

    if (!courseId) {
        logger.error("Course ID not found on page.");
        return null;
    }

    return courseId;
}

export function getTokenCookie(name) {
    const cookies = document.cookie.split(";").map(cookie => cookie.trim());
    let cookieValue = null;
    let i = 0;
    while (i < cookies.length && cookieValue === null) {
        const cookie = cookies[i].split("=", 2);
        if (cookie[0] === name) {
            cookieValue = decodeURIComponent(cookie[1]);
        }
        i++;
    }
    if (!cookieValue) {
        throw new Error("CSRF token / cookie not found.");
    }
    return cookieValue;
}

export function getUserRoleGroup() {
    const userId = ENV?.current_user_id ? String(ENV.current_user_id) : "unknown_user";
    const cacheKeyGroup = `roleGroup_${userId}`;
    const cacheKeyDebug = `roleGroup_debug_${userId}`;

    const cachedGroup = sessionStorage.getItem(cacheKeyGroup);
    if (cachedGroup) {
        return cachedGroup;
    }

    const collected = new Set();

    if (Array.isArray(ENV?.current_user_roles)) {
        ENV.current_user_roles.forEach(r => collected.add(String(r)));
    }
    if (Array.isArray(ENV?.current_user_types)) {
        ENV.current_user_types.forEach(r => collected.add(String(r)));
    }

    if (ENV?.current_user_is_admin) collected.add("admin");
    if (ENV?.current_user_is_student) collected.add("student");
    if (ENV?.current_user_is_teacher) collected.add("teacher");
    if (ENV?.current_user_is_observer) collected.add("observer");

    const normRoles = Array.from(collected).map(r => r.toLowerCase());

    logger.debug("[role debug] userId:", userId);
    logger.debug("[role debug] normalized roles:", normRoles);

    const teacherLike = ["teacher", "admin", "root_admin", "designer", "ta", "accountadmin"];
    const studentLike = ["student", "observer"];

    let group = "other";
    if (normRoles.some(r => studentLike.includes(r))) {
        group = "student_like";
    } else if (normRoles.some(r => teacherLike.includes(r))) {
        group = "teacher_like";
    }

    sessionStorage.setItem(cacheKeyGroup, group);
    sessionStorage.setItem(
        cacheKeyDebug,
        JSON.stringify({ userId, normRoles, decided: group })
    );

    return group;
}

export function isDashboardPage() {
    const path = window.location.pathname;
    return path === "/" || path.startsWith("/dashboard");
}

export async function courseHasAvgAssignment() {
    const courseId = getCourseId();
    if (!courseId) return false;

    const cacheKey = `hasAvgAssignment_${courseId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
        return cached === "true";
    }

    try {
        const response = await fetch(
            `/api/v1/courses/${courseId}/assignments?search_term=${encodeURIComponent(
                AVG_ASSIGNMENT_NAME
            )}`
        );
        const assignments = await response.json();
        const hasAvg = assignments.some(a => a.name === AVG_ASSIGNMENT_NAME);
        sessionStorage.setItem(cacheKey, hasAvg ? "true" : "false");
        return hasAvg;
    } catch (e) {
        console.warn("Could not verify assignment existence:", e);
        return false;
    }
}
