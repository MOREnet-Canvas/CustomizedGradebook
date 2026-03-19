// src/masteryDashboard/teacherMasteryView.js
/**
 * Teacher Mastery View
 *
 * Renders a student picker for teachers on the mastery dashboard.
 * Features:
 * - Section filter dropdown (optional — filters the student list)
 * - Searchable student combobox (type-to-filter, keyboard navigable)
 * - "Viewing: [Name]" header bar with "← Change Student" link after selection
 *
 * Uses fetchCourseStudents / fetchCourseSections from enrollmentService.
 * Calls onStudentSelected(studentId, studentName) when teacher picks a student.
 */

import { fetchCourseStudents, fetchCourseSections } from '../services/enrollmentService.js';
import { logger } from '../utils/logger.js';

const FONT = "font-family:LatoWeb,'Lato Extended',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif;";

const ROSTER_KEY_PREFIX = 'cg_teacherRoster_';
const ROSTER_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getRosterFromCache(courseId) {
    try {
        const cached = sessionStorage.getItem(`${ROSTER_KEY_PREFIX}${courseId}`);
        if (!cached) return null;
        const { timestamp, students, sections } = JSON.parse(cached);
        if (Date.now() - timestamp > ROSTER_TTL_MS) {
            sessionStorage.removeItem(`${ROSTER_KEY_PREFIX}${courseId}`);
            logger.trace(`[TeacherMasteryView] Roster cache EXPIRED for course ${courseId}`);
            return null;
        }
        logger.debug(`[TeacherMasteryView] Roster cache HIT for course ${courseId} (${students.length} students)`);
        return { students, sections };
    } catch {
        return null;
    }
}

function saveRosterToCache(courseId, students, sections) {
    if (!students.length) return; // Don't cache a failed or empty fetch
    try {
        sessionStorage.setItem(`${ROSTER_KEY_PREFIX}${courseId}`, JSON.stringify({
            timestamp: Date.now(),
            students,
            sections
        }));
        logger.trace(`[TeacherMasteryView] Roster cached for course ${courseId} (${students.length} students)`);
    } catch {
        logger.warn(`[TeacherMasteryView] Could not cache roster — sessionStorage may be full`);
    }
}

/**
 * Render the teacher student picker into the dashboard container.
 *
 * @param {Object} options
 * @param {string|number} options.courseId - Canvas course ID
 * @param {Object} options.apiClient - CanvasApiClient instance
 * @param {HTMLElement} options.statusEl - #pm-status element
 * @param {HTMLElement} options.cardsEl - #pm-cards element
 * @param {Function} options.onStudentSelected - Callback(studentId, studentName)
 */
export async function renderTeacherMasteryView({ courseId, apiClient, statusEl, cardsEl, onStudentSelected }) {
    statusEl.textContent = "Loading student roster…";

    let students, sections;

    const cached = getRosterFromCache(courseId);
    if (cached) {
        ({ students, sections } = cached);
    } else {
        [students, sections] = await Promise.all([
            fetchCourseStudents(courseId, apiClient),
            fetchCourseSections(courseId, apiClient)
        ]);
        saveRosterToCache(courseId, students, sections);
    }

    if (students.length === 0) {
        statusEl.textContent = "No students found in this course.";
        return;
    }

    // Sort students by sortable name (Last, First)
    students.sort((a, b) => a.sortableName.localeCompare(b.sortableName));

    statusEl.textContent = "";
    renderPicker(cardsEl, students, sections, onStudentSelected);
}

/**
 * Build and inject the picker UI. Tracks state (selected section, search text) locally.
 * The dropdown list is appended to document.body so it escapes any ancestor
 * overflow:hidden or stacking-context created by border-radius on the dashboard container.
 */
function renderPicker(cardsEl, allStudents, sections, onStudentSelected) {
    let selectedSectionId = null;
    let activeIndex = -1;

    const pickerEl = document.createElement('div');
    pickerEl.id = 'teacher-picker';
    pickerEl.innerHTML = buildPickerHtml(sections);
    cardsEl.innerHTML = '';
    cardsEl.appendChild(pickerEl);

    const sectionSelect = pickerEl.querySelector('#pm-section-select');
    const searchInput = pickerEl.querySelector('#pm-student-search');

    // Reuse an existing body-level dropdown if the picker was restored after "Change Student",
    // otherwise create a new one and append it to document.body.
    let dropdown = document.getElementById('pm-student-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'pm-student-dropdown';
        dropdown.setAttribute('role', 'listbox');
        dropdown.style.cssText = `display:none; position:absolute; background:#fff; border:1px solid #ccc; border-top:none; border-radius:0 0 6px 6px; max-height:320px; overflow-y:auto; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;`;
        document.body.appendChild(dropdown);
    }

    // Position the dropdown directly below the search input using viewport coordinates.
    function positionDropdown() {
        const rect = searchInput.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
        dropdown.style.left = (rect.left + window.scrollX) + 'px';
        dropdown.style.width = rect.width + 'px';
    }

    // Visible student list, recomputed on filter changes
    let filteredStudents = [...allStudents];

    function getFilteredStudents() {
        const query = searchInput.value.trim().toLowerCase();
        return allStudents.filter(s => {
            const inSection = !selectedSectionId || s.sectionId === selectedSectionId;
            const matchesQuery = !query || s.name.toLowerCase().includes(query) || s.sortableName.toLowerCase().includes(query);
            return inSection && matchesQuery;
        });
    }

    function renderDropdown() {
        filteredStudents = getFilteredStudents();
        activeIndex = -1;

        if (filteredStudents.length === 0) {
            dropdown.innerHTML = `<div style="padding:10px 12px; ${FONT} font-size:0.9rem; color:#888;">No students found.</div>`;
        } else {
            dropdown.innerHTML = filteredStudents.map((s, i) => {
                const sectionLabel = sections.length > 1 && !selectedSectionId
                    ? `<span style="color:#888; font-size:0.8rem; margin-left:6px;">${escapeHtml(getSectionName(sections, s.sectionId))}</span>`
                    : '';
                return `<div role="option" data-index="${i}" data-user-id="${s.userId}" style="padding:8px 12px; cursor:pointer; ${FONT} font-size:0.95rem; color:#333; border-bottom:1px solid #f0f0f0; line-height:1.4;" onmouseenter="this.style.background='#f5f5f5';" onmouseleave="this.style.background='';">${escapeHtml(s.name)}${sectionLabel}</div>`;
            }).join('');
        }
        positionDropdown();
        dropdown.style.display = 'block';
    }

    function selectStudent(student) {
        dropdown.style.display = 'none';
        searchInput.value = '';
        const header = ensureTeacherHeader(cardsEl);
        updateTeacherHeader(header, student.name, () => {
            // "Change Student" clicked — hide header, restore picker
            header.style.display = 'none';
            cardsEl.innerHTML = '';
            cardsEl.appendChild(pickerEl);
            dropdown.style.display = 'none';
            searchInput.value = '';

            // Reset header stat boxes to blank state
            const clearText = (id, val = '') => { const el = document.getElementById(id); if (el) el.textContent = val; };
            const clearHtml = (id) => { const el = document.getElementById(id); if (el) el.innerHTML = ''; };
            clearText('pm-student-name');
            clearText('pm-subtitle');
            clearText('pm-stat-score', '—');
            clearText('pm-stat-score-label');
            clearHtml('pm-stat-mastered');
            clearText('pm-stat-mastered-label');
            const banner = document.getElementById('pm-missing-banner');
            if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }
            clearHtml('pm-comment-toggle-slot');
            clearHtml('pm-comment-panel-container');
        });
        onStudentSelected(student.userId, student.name);
    }

    function highlightItem(index) {
        const items = dropdown.querySelectorAll('[role="option"]');
        items.forEach((el, i) => { el.style.background = i === index ? '#e8f0fe' : ''; });
    }

    // Section filter — only wired up when the select element exists (courses with >1 section)
    if (sectionSelect) {
        sectionSelect.addEventListener('change', () => {
            selectedSectionId = sectionSelect.value || null;
            renderDropdown();
        });
    }

    // Search input — filter on each keystroke
    searchInput.addEventListener('input', renderDropdown);

    // Show dropdown on focus
    searchInput.addEventListener('focus', renderDropdown);

    // Reposition on scroll/resize so the body-level dropdown tracks the input
    window.addEventListener('scroll', positionDropdown, { passive: true });
    window.addEventListener('resize', positionDropdown, { passive: true });

    // Hide dropdown when clicking outside both the picker and the dropdown itself
    document.addEventListener('click', (e) => {
        if (!pickerEl.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    }, { capture: true });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('[role="option"]');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            highlightItem(activeIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            highlightItem(activeIndex);
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            selectStudent(filteredStudents[activeIndex]);
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    // Click on dropdown item
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('[role="option"]');
        if (!item) return;
        selectStudent(filteredStudents[Number(item.dataset.index)]);
    });
}

/**
 * Create or retrieve the persistent teacher header element.
 * Lives as a sibling of cardsEl (inserted before it) so that
 * cardsEl.innerHTML assignments in renderStudentData never wipe it.
 */
function ensureTeacherHeader(cardsEl) {
    let header = cardsEl.parentNode.querySelector('#pm-teacher-header');
    if (!header) {
        header = document.createElement('div');
        header.id = 'pm-teacher-header';
        header.style.cssText = `display:none; justify-content:space-between; align-items:center; padding:8px 4px 12px; border-bottom:1px solid #e0e0e0; margin-bottom:10px;`;
        cardsEl.parentNode.insertBefore(header, cardsEl.parentNode.firstChild);
    }
    return header;
}

/** Update the persistent header content and show it. */
function updateTeacherHeader(header, studentName, onChangeStudent) {
    header.innerHTML = `<span style="${FONT} font-size:0.9rem; color:#555;">Viewing:</span><span style="${FONT} font-size:1rem; font-weight:700; color:#333; margin-left:6px; flex:1;">${escapeHtml(studentName)}</span><button id="pm-change-student" style="${FONT} font-size:0.85rem; color:#0374B5; background:none; border:none; cursor:pointer; padding:4px 8px; text-decoration:underline;">← Change Student</button>`;
    header.style.display = 'flex';
    header.querySelector('#pm-change-student').addEventListener('click', onChangeStudent);
}

/** Build the picker HTML shell */
function buildPickerHtml(sections) {
    const sectionRow = sections.length > 1 ? `
        <div style="margin-bottom:10px;">
            <label for="pm-section-select" style="${FONT} font-size:0.85rem; color:#555; display:block; margin-bottom:4px;">Section</label>
            <select id="pm-section-select" style="${FONT} width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:6px; font-size:0.95rem; color:#333; background:#fff;">
                <option value="">All Sections</option>
                ${sections.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
        </div>` : '';

    return `
        <div style="padding:4px 0 12px;">
            <div style="${FONT} font-size:1rem; font-weight:700; color:#333; margin-bottom:12px;">Select a Student</div>
            ${sectionRow}
            <div>
                <label for="pm-student-search" style="${FONT} font-size:0.85rem; color:#555; display:block; margin-bottom:4px;">Student Name</label>
                <input id="pm-student-search" type="text" placeholder="Type to search…" autocomplete="off"
                       style="${FONT} width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:6px; font-size:0.95rem; color:#333; box-sizing:border-box;" />
            </div>
        </div>`;
}

function getSectionName(sections, sectionId) {
    return sections.find(s => s.id === sectionId)?.name ?? '';
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]
    );
}