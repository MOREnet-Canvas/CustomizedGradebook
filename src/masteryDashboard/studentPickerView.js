// src/masteryDashboard/studentPickerView.js
/**
 * Student Picker View - Shared UI Component
 *
 * Provides a reusable student picker interface with:
 * - Section filter dropdown (when multiple sections exist)
 * - Searchable student combobox (type-to-filter, keyboard navigable)
 * - "Viewing: [Name]" header bar with "← Change Student" link after selection
 *
 * Used by both teacherMasteryView.js and observerMasteryView.js
 */

import { injectStyles } from '../ui/styles.js';
import { STUDENT_PICKER_CSS } from './studentPickerStyles.js';

/**
 * Render the student picker UI
 *
 * @param {Object} options
 * @param {Array} options.students - Array of student objects {userId, name, sortableName, sectionId}
 * @param {Array} options.sections - Array of section objects {id, name}
 * @param {HTMLElement} options.cardsEl - Container element to render picker into
 * @param {Function} options.onStudentSelected - Callback(studentId, studentName) when student is selected
 * @param {Object} [options.autoSelectStudent] - Optional student object to auto-select on render
 */
export function renderStudentPicker({ students, sections, cardsEl, onStudentSelected, autoSelectStudent }) {
    injectStyles(STUDENT_PICKER_CSS, 'pm-student-picker-styles');

    // Sort students by sortable name (Last, First)
    const sortedStudents = [...students].sort((a, b) => a.sortableName.localeCompare(b.sortableName));

    let selectedSectionId = null;
    let activeIndex = -1;

    const pickerEl = document.createElement('div');
    pickerEl.id = 'student-picker';
    pickerEl.innerHTML = buildPickerHtml(sections);

    // Insert picker at the TOP of the page (before stat boxes)
    // Find the parent container and insert before the first child (student name div)
    const container = cardsEl.parentNode;
    const firstChild = container.firstChild;

    // If picker already exists from previous render, remove it
    const existingPicker = document.getElementById('student-picker');
    if (existingPicker) {
        existingPicker.remove();
    }

    // Insert picker at the very top (before student name)
    container.insertBefore(pickerEl, firstChild);

    // Clear the cards area (will be populated when student is selected)
    cardsEl.innerHTML = '';

    const sectionSelect = pickerEl.querySelector('#pm-section-select');
    const searchInput = pickerEl.querySelector('#pm-student-search');

    // Reuse an existing body-level dropdown if the picker was restored after "Change Student",
    // otherwise create a new one and append it to document.body.
    let dropdown = document.getElementById('pm-student-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'pm-student-dropdown';
        dropdown.setAttribute('role', 'listbox');
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
    let filteredStudents = [...sortedStudents];

    function getFilteredStudents() {
        const query = searchInput.value.trim().toLowerCase();
        return sortedStudents.filter(s => {
            const inSection = !selectedSectionId || s.sectionId === selectedSectionId;
            const matchesQuery = !query || s.name.toLowerCase().includes(query) || s.sortableName.toLowerCase().includes(query);
            return inSection && matchesQuery;
        });
    }

    function renderDropdown() {
        filteredStudents = getFilteredStudents();
        activeIndex = -1;

        if (filteredStudents.length === 0) {
            dropdown.innerHTML = `<div class="pm-dropdown-empty">No students found.</div>`;
        } else {
            dropdown.innerHTML = filteredStudents.map((s, i) => {
                const sectionLabel = sections.length > 1 && !selectedSectionId
                    ? `<span class="pm-dropdown-section">${escapeHtml(getSectionName(sections, s.sectionId))}</span>`
                    : '';
                return `<div role="option" data-index="${i}" data-user-id="${s.userId}" class="pm-dropdown-item">${escapeHtml(s.name)}${sectionLabel}</div>`;
            }).join('');
        }
        positionDropdown();
        dropdown.style.display = 'block';
    }

    function selectStudent(student) {
        dropdown.style.display = 'none';
        searchInput.value = '';

        // Hide the picker
        pickerEl.style.display = 'none';

        const header = ensureStudentHeader(cardsEl);
        updateStudentHeader(header, student.name, () => {
            // "Change Student" clicked — hide header, restore picker
            header.style.display = 'none';
            pickerEl.style.display = 'block';
            dropdown.style.display = 'none';
            searchInput.value = '';
            cardsEl.innerHTML = '';

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

    // Auto-select student if provided (for observers)
    if (autoSelectStudent) {
        // Use setTimeout to allow DOM to fully render first
        setTimeout(() => {
            selectStudent(autoSelectStudent);
        }, 0);
    }
}

/**
 * Create or retrieve the persistent student header element.
 * Lives as a sibling of cardsEl (inserted before it) so that
 * cardsEl.innerHTML assignments in renderStudentData never wipe it.
 */
function ensureStudentHeader(cardsEl) {
    let header = cardsEl.parentNode.querySelector('#pm-teacher-header');
    if (!header) {
        header = document.createElement('div');
        header.id = 'pm-teacher-header';
        header.style.display = 'none';
        cardsEl.parentNode.insertBefore(header, cardsEl.parentNode.firstChild);
    }
    return header;
}

/** Update the persistent header content and show it. */
function updateStudentHeader(header, studentName, onChangeStudent) {
    header.innerHTML = `<span class="pm-header-label">Viewing:</span><span class="pm-header-name">${escapeHtml(studentName)}</span><button id="pm-change-student" class="pm-change-student-btn">← Change Student</button>`;
    header.style.display = 'flex';
    header.querySelector('#pm-change-student').addEventListener('click', onChangeStudent);
}

/** Build the picker HTML shell */
function buildPickerHtml(sections) {
    const sectionRow = sections.length > 1 ? `
        <div class="pm-section-row">
            <label for="pm-section-select" class="pm-picker-label">Section</label>
            <select id="pm-section-select" class="pm-picker-select">
                <option value="">All Sections</option>
                ${sections.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
        </div>` : '';

    return `
        <div class="pm-picker">
            <div class="pm-picker-title">Select a Student</div>
            ${sectionRow}
            <div>
                <label for="pm-student-search" class="pm-picker-label">Student Name</label>
                <input id="pm-student-search" type="text" placeholder="Type to search…" autocomplete="off"
                       class="pm-picker-input" />
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