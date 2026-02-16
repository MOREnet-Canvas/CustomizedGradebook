// src/admin/canvasFormHelpers.js
/**
 * Canvas Form Helpers
 *
 * Helper functions for creating Canvas-styled form controls using ic-* classes.
 * These helpers eliminate inline styling and use Canvas's native UI framework.
 */

import { createElement } from './domHelpers.js';

/**
 * Create a Canvas-styled form group with label and input
 *
 * @param {Object} options - Form group options
 * @param {string} options.label - Label text
 * @param {string} options.id - Input ID
 * @param {string} options.type - Input type (text, number, etc.)
 * @param {string} [options.value] - Input value
 * @param {string} [options.placeholder] - Input placeholder
 * @param {string} [options.tooltip] - Tooltip text
 * @param {Object} [options.attrs] - Additional input attributes
 * @returns {Object} { container, input, label }
 */
export function createFormGroup({ label, id, type = 'text', value = '', placeholder = '', tooltip = '', attrs = {} }) {
    const container = createElement('div', {
        attrs: { class: 'ic-Form-group' }
    });

    const formControl = createElement('div', {
        attrs: { class: 'ic-Form-control' }
    });

    const labelEl = createElement('label', {
        attrs: { class: 'ic-Label', for: id },
        html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
    });

    const input = createElement('input', {
        attrs: {
            class: 'ic-Input',
            type,
            id,
            value,
            placeholder,
            ...attrs
        }
    });

    formControl.appendChild(labelEl);
    formControl.appendChild(input);
    container.appendChild(formControl);

    return { container, input, label: labelEl };
}

/**
 * Create a Canvas-styled select dropdown
 *
 * @param {Object} options - Select options
 * @param {string} options.label - Label text
 * @param {string} options.id - Select ID
 * @param {Array} options.options - Array of {value, text} objects
 * @param {string} [options.value] - Selected value
 * @param {string} [options.tooltip] - Tooltip text
 * @param {Object} [options.attrs] - Additional select attributes
 * @returns {Object} { container, select, label }
 */
export function createSelectGroup({ label, id, options, value = '', tooltip = '', attrs = {} }) {
    const container = createElement('div', {
        attrs: { class: 'ic-Form-group' }
    });

    const formControl = createElement('div', {
        attrs: { class: 'ic-Form-control' }
    });

    const labelEl = createElement('label', {
        attrs: { class: 'ic-Label', for: id },
        html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
    });

    const select = createElement('select', {
        attrs: {
            class: 'ic-Input',
            id,
            ...attrs
        }
    });

    options.forEach(opt => {
        const option = createElement('option', {
            attrs: { value: opt.value },
            text: opt.text
        });
        if (opt.value === value) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    formControl.appendChild(labelEl);
    formControl.appendChild(select);
    container.appendChild(formControl);

    return { container, select, label: labelEl };
}

/**
 * Create a Canvas-styled checkbox
 *
 * @param {Object} options - Checkbox options
 * @param {string} options.label - Label text
 * @param {string} options.id - Checkbox ID
 * @param {boolean} [options.checked] - Checked state
 * @param {string} [options.tooltip] - Tooltip text
 * @param {Object} [options.attrs] - Additional checkbox attributes
 * @returns {Object} { container, checkbox, label }
 */
export function createCheckbox({ label, id, checked = false, tooltip = '', attrs = {} }) {
    const container = createElement('div', {
        attrs: { class: 'ic-Checkbox-group' }
    });

    const formControl = createElement('div', {
        attrs: { class: 'ic-Form-control ic-Form-control--checkbox' }
    });

    const checkbox = createElement('input', {
        attrs: {
            type: 'checkbox',
            id,
            ...attrs
        }
    });

    if (checked) {
        checkbox.checked = true;
    }

    const labelEl = createElement('label', {
        attrs: { class: 'ic-Label', for: id },
        html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
    });

    formControl.appendChild(checkbox);
    formControl.appendChild(labelEl);
    container.appendChild(formControl);

    return { container, checkbox, label: labelEl };


/**
 * Create a Canvas Super Toggle (switch-style toggle)
 *
 * @param {Object} options - Toggle options
 * @param {string} options.label - Label text
 * @param {string} options.id - Toggle ID
 * @param {boolean} [options.checked] - Checked state
 * @param {string} [options.tooltip] - Tooltip text
 * @param {Object} [options.attrs] - Additional input attributes
 * @returns {Object} { container, checkbox, label }
 */
export function createSuperToggle({ label, id, checked = false, tooltip = '', attrs = {} }) {
    const container = createElement('label', {
        attrs: { class: 'ic-Super-toggle--ui-switch', for: id }
    });

    const labelDiv = createElement('div', {
        attrs: { class: 'ic-Label' },
        html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
    });

    const checkbox = createElement('input', {
        attrs: {
            type: 'checkbox',
            id,
            class: 'ic-Super-toggle__input',
            ...attrs
        }
    });

    if (checked) {
        checkbox.checked = true;
    }

    const toggleContainer = createElement('div', {
        attrs: {
            class: 'ic-Super-toggle__container',
            'aria-hidden': 'true',
            'data-checked': 'On',
            'data-unchecked': 'Off'
        }
    });

    const leftOption = createElement('div', {
        attrs: { class: 'ic-Super-toggle__option--LEFT' }
    });
    leftOption.appendChild(createElement('i', { attrs: { class: 'icon-muted' } }));

    const switchEl = createElement('div', {
        attrs: { class: 'ic-Super-toggle__switch' }
    });

    const rightOption = createElement('div', {
        attrs: { class: 'ic-Super-toggle__option--RIGHT' }
    });
    rightOption.appendChild(createElement('i', { attrs: { class: 'icon-unmuted' } }));

    toggleContainer.appendChild(leftOption);
    toggleContainer.appendChild(switchEl);
    toggleContainer.appendChild(rightOption);

    container.appendChild(labelDiv);
    container.appendChild(checkbox);
    container.appendChild(toggleContainer);

    return { container, checkbox, label: labelDiv };
}

/**
 * Create a Canvas-styled textarea
 *
 * @param {Object} options - Textarea options
 * @param {string} options.label - Label text
 * @param {string} options.id - Textarea ID
 * @param {string} [options.value] - Textarea value
 * @param {string} [options.placeholder] - Textarea placeholder
 * @param {number} [options.rows] - Number of rows
 * @param {string} [options.tooltip] - Tooltip text
 * @param {Object} [options.attrs] - Additional textarea attributes
 * @returns {Object} { container, textarea, label }
 */
export function createTextarea({ label, id, value = '', placeholder = '', rows = 10, tooltip = '', attrs = {} }) {
    const container = createElement('div', {
        attrs: { class: 'ic-Form-group' }
    });

    const formControl = createElement('div', {
        attrs: { class: 'ic-Form-control' }
    });

    const labelEl = createElement('label', {
        attrs: { class: 'ic-Label', for: id },
        html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
    });

    const textarea = createElement('textarea', {
        attrs: {
            class: 'ic-Input',
            id,
            rows: String(rows),
            placeholder,
            ...attrs
        },
        text: value
    });

    formControl.appendChild(labelEl);
    formControl.appendChild(textarea);
    container.appendChild(formControl);

    return { container, textarea, label: labelEl };
}

/**
 * Create a collapsible panel using cg-panel classes
 *
 * @param {string} title - Panel title
 * @param {boolean} [collapsed] - Initial collapsed state
 * @returns {Object} { panel, header, body, footer, toggle }
 */
export function createCollapsiblePanel(title, collapsed = false) {
    const panel = createElement('div', {
        attrs: { class: collapsed ? 'cg-panel cg-panel--collapsed' : 'cg-panel' }
    });

    const header = createElement('div', {
        attrs: { class: 'cg-panel__header' }
    });

    const headerTitle = createElement('div', {
        attrs: { class: 'cg-panel__header-title' },
        text: title
    });

    const headerToggle = createElement('div', {
        attrs: { class: 'cg-panel__header-toggle' },
        text: collapsed ? '▼' : '▲'
    });

    header.appendChild(headerTitle);
    header.appendChild(headerToggle);

    const body = createElement('div', {
        attrs: { class: 'cg-panel__body' }
    });

    const footer = createElement('div', {
        attrs: { class: 'cg-panel__footer' }
    });

    // Toggle collapse on header click
    header.addEventListener('click', () => {
        const isCollapsed = panel.classList.contains('cg-panel--collapsed');
        if (isCollapsed) {
            panel.classList.remove('cg-panel--collapsed');
            headerToggle.textContent = '▲';
        } else {
            panel.classList.add('cg-panel--collapsed');
            headerToggle.textContent = '▼';
        }
    });

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    return { panel, header, body, footer, toggle: headerToggle };
}