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
 * @param {string} [options.variant] - Checkbox variant: 'default' or 'flush'
 * @returns {Object} { container, checkbox, label }
 */
export function createCheckbox({ label, id, checked = false, tooltip = '', attrs = {}, variant = 'default' }) {
    if (variant === 'flush') {
        // Canvas native flush pattern: <label class="checkbox flush">
        const container = createElement('label', {
            attrs: {
                class: 'checkbox flush',
                for: id
            }
        });

        // Hidden input for unchecked state (Rails pattern)
        const hiddenInput = createElement('input', {
            attrs: {
                type: 'hidden',
                name: attrs.name || id,
                value: '0'
            }
        });

        // Checkbox input
        const checkbox = createElement('input', {
            attrs: {
                type: 'checkbox',
                id,
                value: '1',
                ...attrs
            }
        });

        if (checked) {
            checkbox.checked = true;
        }

        // Label text with optional tooltip
        const labelText = label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '');

        // Append elements to label container
        container.appendChild(hiddenInput);
        container.appendChild(checkbox);

        // Add text node or HTML content
        if (tooltip) {
            const span = createElement('span', { html: labelText });
            container.appendChild(span);
        } else {
            container.appendChild(document.createTextNode(' ' + label));
        }

        return { container, checkbox, label: container };
    } else {
        // Default ic-Checkbox-group pattern
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
    }
}

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

/**
 * Create a Canvas-styled progress bar
 *
 * @param {Object} options - Progress bar options
 * @param {string} options.label - Label text
 * @param {number} [options.progress] - Progress percentage (0-100)
 * @param {string} [options.tooltip] - Tooltip text
 * @returns {Object} { container, progressBar, setProgress }
 */
export function createProgressBar({ label, progress = 0, tooltip = '' }) {
    const container = createElement('div', {
        attrs: { class: 'ic-Form-control' }
    });

    const labelEl = createElement('label', {
        attrs: { class: 'ic-Label' },
        html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
    });

    const barContainer = createElement('div', {
        attrs: { class: 'progress-bar__bar-container' }
    });

    const progressBar = createElement('div', {
        attrs: { class: 'progress-bar__bar' },
        style: { width: `${Math.min(100, Math.max(0, progress))}%` }
    });

    barContainer.appendChild(progressBar);
    container.appendChild(labelEl);
    container.appendChild(barContainer);

    // Helper function to update progress
    const setProgress = (newProgress) => {
        progressBar.style.width = `${Math.min(100, Math.max(0, newProgress))}%`;
    };

    return { container, progressBar, setProgress };
}

/**
 * Create a Canvas-styled radio button group
 *
 * @param {Object} options - Radio group options
 * @param {string} options.label - Group label text
 * @param {string} options.name - Radio group name (for grouping)
 * @param {Array} options.options - Array of {value, label, checked} objects
 * @param {string} [options.tooltip] - Tooltip text
 * @returns {Object} { container, radios, getSelectedValue }
 */
export function createRadioGroup({ label, name, options, tooltip = '' }) {
    const container = createElement('div', {
        attrs: { class: 'ic-Form-control ic-Form-control--radio' }
    });

    if (label) {
        const labelEl = createElement('label', {
            attrs: { class: 'ic-Label' },
            html: label + (tooltip ? ` <span class="cg-tip" title="${tooltip}">&#9432;</span>` : '')
        });
        container.appendChild(labelEl);
    }

    const radios = [];

    options.forEach((option, index) => {
        const radioWrapper = createElement('div', {
            attrs: { class: 'ic-Radio' }
        });

        const radioId = `${name}-${index}`;
        const radio = createElement('input', {
            attrs: {
                type: 'radio',
                id: radioId,
                name: name,
                value: option.value
            }
        });

        if (option.checked) {
            radio.checked = true;
        }

        const radioLabel = createElement('label', {
            attrs: { class: 'ic-Label', for: radioId },
            text: option.label
        });

        radioWrapper.appendChild(radio);
        radioWrapper.appendChild(radioLabel);
        container.appendChild(radioWrapper);

        radios.push(radio);
    });

    // Helper function to get selected value
    const getSelectedValue = () => {
        const selected = radios.find(r => r.checked);
        return selected ? selected.value : null;
    };

    return { container, radios, getSelectedValue };
}

/**
 * Create a Canvas-styled button
 *
 * @param {Object} options - Button options
 * @param {string} options.text - Button text
 * @param {string} [options.type] - Button type: 'primary' or 'secondary'
 * @param {boolean} [options.block] - Full-width block button
 * @param {boolean} [options.disabled] - Disabled state
 * @param {Function} [options.onClick] - Click handler
 * @param {Object} [options.attrs] - Additional button attributes
 * @returns {HTMLElement} Button element
 */
export function createButton({ text, type = 'primary', block = false, disabled = false, onClick = null, attrs = {} }) {
    const classes = ['Button'];

    if (type === 'primary') {
        classes.push('Button--primary');
    } else if (type === 'secondary') {
        classes.push('Button--secondary');
    }

    if (block) {
        classes.push('Button--block');
    }

    const button = createElement('button', {
        attrs: {
            type: 'button',
            class: classes.join(' '),
            ...(disabled ? { disabled: 'true' } : {}),
            ...attrs
        },
        text
    });

    if (onClick) {
        button.addEventListener('click', onClick);
    }

    return button;
}


/**
 * Create a Canvas-styled dropdown menu
 *
 * @param {Object} options - Dropdown options
 * @param {string} options.triggerText - Trigger button text
 * @param {Array} options.items - Array of {text, icon, onClick} objects
 * @param {boolean} [options.block] - Full-width block button
 * @returns {Object} { container, trigger, menu }
 */
export function createDropdown({ triggerText, items, block = false }) {
    const container = createElement('div', {
        attrs: { class: 'al-dropdown__container' }
    });

    const trigger = createElement('a', {
        attrs: {
            class: block ? 'al-trigger Button Button--block' : 'al-trigger Button',
            role: 'button',
            href: '#'
        }
    });

    trigger.textContent = triggerText + ' ';
    const arrow = createElement('i', {
        attrs: { class: 'icon-mini-arrow-down' }
    });
    trigger.appendChild(arrow);

    const menu = createElement('ul', {
        attrs: {
            class: 'al-options',
            role: 'menu',
            tabindex: '0',
            'aria-hidden': 'true',
            'aria-expanded': 'false'
        }
    });

    items.forEach(item => {
        const li = createElement('li');
        const link = createElement('a', {
            attrs: {
                href: '#',
                class: item.icon || '',
                tabindex: '-1',
                role: 'menuitem'
            },
            text: item.text
        });

        if (item.onClick) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                item.onClick(e);
            });
        }

        li.appendChild(link);
        menu.appendChild(li);
    });

    container.appendChild(trigger);
    container.appendChild(menu);

    return { container, trigger, menu };
}

/**
 * Create a Canvas-styled item group list container
 *
 * @param {Object} options - List options
 * @param {string} [options.id] - List ID
 * @returns {HTMLElement} List container (ul.ig-list)
 */
export function createItemGroupList({ id = '' } = {}) {
    return createElement('ul', {
        attrs: {
            class: 'ig-list',
            ...(id ? { id } : {})
        }
    });
}

/**
 * Create a Canvas-styled item group row (list item)
 *
 * @param {Object} options - Row options
 * @param {string} options.title - Item title
 * @param {string} options.href - Link URL
 * @param {string} [options.icon] - Icon class (e.g., 'icon-assignment', 'icon-quiz')
 * @param {Array} [options.details] - Array of detail objects {label, value}
 * @param {boolean} [options.published] - Published state
 * @param {Array} [options.menuItems] - Array of menu items {text, href, onClick}
 * @returns {Object} { listItem, titleLink, menuTrigger }
 */
export function createItemGroupRow({
    title,
    href,
    icon = 'icon-assignment',
    details = [],
    published = false,
    menuItems = []
}) {
    // List item wrapper
    const listItem = createElement('li');

    // Row container
    const row = createElement('div', {
        attrs: {
            class: published ? 'ig-row ig-published' : 'ig-row'
        }
    });

    // Layout wrapper
    const layout = createElement('div', {
        attrs: { class: 'ig-row__layout' }
    });

    // 1. Type icon
    const typeIcon = createElement('div', {
        attrs: {
            class: 'ig-type-icon',
            'aria-hidden': 'true'
        }
    });
    const iconEl = createElement('i', {
        attrs: { class: icon }
    });
    typeIcon.appendChild(iconEl);

    // 2. Info section
    const info = createElement('div', {
        attrs: { class: 'ig-info' }
    });

    const titleLink = createElement('a', {
        attrs: {
            href: href,
            class: 'ig-title'
        },
        text: title
    });

    const detailsContainer = createElement('div', {
        attrs: { class: 'ig-details' }
    });

    details.forEach(detail => {
        const detailItem = createElement('div', {
            attrs: { class: 'ig-details__item' }
        });
        if (detail.label) {
            const label = createElement('b', { text: detail.label });
            detailItem.appendChild(label);
            detailItem.appendChild(document.createTextNode(' ' + detail.value));
        } else {
            detailItem.textContent = detail.value;
        }
        detailsContainer.appendChild(detailItem);
    });

    info.appendChild(titleLink);
    info.appendChild(detailsContainer);


    // 3. Admin section
    const admin = createElement('div', {
        attrs: { class: 'ig-admin' }
    });

    // Settings menu
    let menuTrigger = null;
    if (menuItems.length > 0) {
        const menuWrapper = createElement('div', {
            attrs: { class: 'inline-block' }
        });

        menuTrigger = createElement('a', {
            attrs: {
                class: 'al-trigger al-trigger-gray',
                href: '#',
                role: 'button'
            }
        });

        const settingsIcon = createElement('i', { attrs: { class: 'icon-settings' } });
        const arrowIcon = createElement('i', { attrs: { class: 'icon-mini-arrow-down' } });
        const srText = createElement('span', {
            attrs: { class: 'screenreader-only' },
            text: 'Manage'
        });

        menuTrigger.appendChild(settingsIcon);
        menuTrigger.appendChild(arrowIcon);
        menuTrigger.appendChild(srText);

        const menu = createElement('ul', {
            attrs: { class: 'al-options' }
        });

        menuItems.forEach(item => {
            const li = createElement('li');
            const link = createElement('a', {
                attrs: { href: item.href || '#' },
                text: item.text
            });

            if (item.onClick) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    item.onClick(e);
                });
            }

            li.appendChild(link);
            menu.appendChild(li);
        });

        menuWrapper.appendChild(menuTrigger);
        menuWrapper.appendChild(menu);
        admin.appendChild(menuWrapper);
    }

    // Assemble layout
    layout.appendChild(typeIcon);
    layout.appendChild(info);
    layout.appendChild(admin);
    row.appendChild(layout);
    listItem.appendChild(row);

    return {
        listItem,
        titleLink,
        menuTrigger
    };
}

/**
 * Create Canvas-styled breadcrumb navigation
 *
 * @param {Object} options - Breadcrumb options
 * @param {Array} options.items - Array of breadcrumb items {text, href, icon}
 * @param {boolean} [options.showToggle] - Show hamburger menu toggle
 * @returns {Object} { container, nav, toggle }
 */
export function createBreadcrumbs({ items, showToggle = true }) {
    const container = createElement('div', {
        attrs: { class: 'ic-app-nav-toggle-and-crumbs ic-app-nav-toggle-and-crumbs--theme-preview' }
    });

    let toggle = null;
    if (showToggle) {
        toggle = createElement('button', {
            attrs: {
                type: 'button',
                'aria-hidden': 'true',
                class: 'Button Button--link ic-app-course-nav-toggle'
            }
        });
        const hamburgerIcon = createElement('i', {
            attrs: { class: 'icon-hamburger' }
        });
        toggle.appendChild(hamburgerIcon);
        container.appendChild(toggle);
    }

    const crumbsWrapper = createElement('div', {
        attrs: { class: 'ic-app-crumbs' }
    });

    const nav = createElement('nav', {
        attrs: {
            'aria-label': 'breadcrumbs',
            id: 'breadcrumbs',
            role: 'navigation'
        }
    });

    const ol = createElement('ol');

    items.forEach((item, index) => {
        const li = createElement('li', {
            attrs: index === 0 && item.icon ? { class: 'home' } : {}
        });

        const link = createElement('a', {
            attrs: { href: item.href || '#' }
        });

        const span = createElement('span', {
            attrs: { class: 'ellipsible' }
        });

        if (item.icon) {
            const icon = createElement('i', {
                attrs: {
                    class: item.icon,
                    ...(item.text ? { title: item.text } : {})
                }
            });
            span.appendChild(icon);
        } else {
            span.textContent = item.text;
        }

        link.appendChild(span);
        li.appendChild(link);
        ol.appendChild(li);
    });

    nav.appendChild(ol);
    crumbsWrapper.appendChild(nav);
    container.appendChild(crumbsWrapper);

    return { container, nav, toggle };
}


/**
 * Create Canvas-styled context navigation (sidebar nav)
 *
 * @param {Object} options - Navigation options
 * @param {Array} options.items - Array of nav items {text, href, active, onClick}
 * @param {string} [options.ariaLabel] - ARIA label for navigation
 * @returns {Object} { container, nav, links }
 */
export function createContextNav({ items, ariaLabel = 'context' }) {
    const container = createElement('div', {
        attrs: { class: 'list-view' }
    });

    const nav = createElement('nav', {
        attrs: {
            class: 'theme-preview',
            'aria-label': ariaLabel,
            role: 'navigation'
        }
    });

    const ul = createElement('ul');

    const links = [];

    items.forEach(item => {
        const li = createElement('li');
        const link = createElement('a', {
            attrs: {
                href: item.href || '#',
                ...(item.active ? { class: 'active' } : {})
            },
            text: item.text
        });

        if (item.onClick) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                item.onClick(e);
            });
        }

        li.appendChild(link);
        ul.appendChild(li);
        links.push(link);
    });

    nav.appendChild(ul);
    container.appendChild(nav);

    return { container, nav, links };
}

/**
 * Create a Canvas-styled table
 *
 * @param {Object} options - Table options
 * @param {Array} options.headers - Array of header strings
 * @param {Array} options.rows - Array of row arrays (each row is array of cell data)
 * @param {boolean} [options.hover] - Enable hover effect on rows
 * @param {boolean} [options.striped] - Enable striped rows
 * @param {Function} [options.cellRenderer] - Custom cell renderer function(cellData, rowIndex, colIndex)
 * @returns {Object} { table, thead, tbody }
 */
export function createTable({ headers, rows, hover = true, striped = false, cellRenderer = null }) {
    const classes = ['ic-Table'];
    if (hover) classes.push('ic-Table--hover-row');
    if (striped) classes.push('ic-Table--striped');

    const table = createElement('table', {
        attrs: { class: classes.join(' ') }
    });

    // Create thead
    const thead = createElement('thead');
    const headerRow = createElement('tr');

    headers.forEach(headerText => {
        const th = createElement('th', {
            text: headerText
        });
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create tbody
    const tbody = createElement('tbody');

    rows.forEach((rowData, rowIndex) => {
        const tr = createElement('tr');

        rowData.forEach((cellData, colIndex) => {
            const td = createElement('td');

            if (cellRenderer) {
                const rendered = cellRenderer(cellData, rowIndex, colIndex);
                if (typeof rendered === 'string') {
                    td.innerHTML = rendered;
                } else if (rendered instanceof HTMLElement) {
                    td.appendChild(rendered);
                } else {
                    td.textContent = cellData;
                }
            } else if (typeof cellData === 'object' && cellData.html) {
                td.innerHTML = cellData.html;
            } else if (typeof cellData === 'object' && cellData.element) {
                td.appendChild(cellData.element);
            } else {
                td.textContent = cellData;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    return { table, thead, tbody };
}

/**
 * Create a Canvas-styled grid row
 *
 * @param {Object} options - Grid row options
 * @param {Array} options.columns - Array of column configs {xs, sm, md, lg, offsetXs, offsetSm, offsetMd, offsetLg, content}
 * @returns {Object} { row, columns }
 */
export function createGridRow({ columns }) {
    const row = createElement('div', {
        attrs: { class: 'grid-row' }
    });

    const columnElements = [];

    columns.forEach(col => {
        const classes = [];

        // Size classes (e.g., col-xs-12, col-md-3)
        if (col.xs) classes.push(`col-xs-${col.xs}`);
        if (col.sm) classes.push(`col-sm-${col.sm}`);
        if (col.md) classes.push(`col-md-${col.md}`);
        if (col.lg) classes.push(`col-lg-${col.lg}`);

        // Offset classes (e.g., off-md-1)
        if (col.offsetXs) classes.push(`off-xs-${col.offsetXs}`);
        if (col.offsetSm) classes.push(`off-sm-${col.offsetSm}`);
        if (col.offsetMd) classes.push(`off-md-${col.offsetMd}`);
        if (col.offsetLg) classes.push(`off-lg-${col.offsetLg}`);

        const column = createElement('div', {
            attrs: { class: classes.join(' ') }
        });

        if (col.content) {
            if (typeof col.content === 'string') {
                column.innerHTML = col.content;
            } else if (col.content instanceof HTMLElement) {
                column.appendChild(col.content);
            }
        }

        row.appendChild(column);
        columnElements.push(column);
    });

    return { row, columns: columnElements };
}


/**
 * Create Canvas-styled tabs (jQuery UI tabs)
 *
 * @param {Object} options - Tabs options
 * @param {string} [options.id] - Tabs container ID
 * @param {Array} options.tabs - Array of tab objects {label, content, active}
 * @returns {Object} { container, nav, panels, activate }
 */
export function createTabs({ id = '', tabs }) {
    const containerId = id || `tabs-${Date.now()}`;

    const container = createElement('div', {
        attrs: {
            id: containerId,
            class: 'ui-tabs ui-widget ui-widget-content ui-corner-all'
        }
    });

    // Create tab navigation
    const nav = createElement('ul', {
        attrs: {
            class: 'ui-tabs-nav ui-helper-reset ui-helper-clearfix ui-widget-header ui-corner-all',
            role: 'tablist'
        }
    });

    const panels = [];
    const tabElements = [];

    tabs.forEach((tab, index) => {
        const tabId = `${containerId}-tab-${index}`;
        const panelId = `${containerId}-panel-${index}`;
        const anchorId = `${containerId}-anchor-${index}`;
        const isActive = tab.active || index === 0;

        // Create tab list item
        const li = createElement('li', {
            attrs: {
                class: isActive
                    ? 'ui-state-default ui-corner-top ui-tabs-active ui-state-active'
                    : 'ui-state-default ui-corner-top',
                role: 'tab',
                tabindex: isActive ? '0' : '-1',
                'aria-controls': panelId,
                'aria-labelledby': anchorId,
                'aria-selected': isActive ? 'true' : 'false'
            }
        });

        const anchor = createElement('a', {
            attrs: {
                href: `#${panelId}`,
                class: 'ui-tabs-anchor',
                role: 'presentation',
                tabindex: '-1',
                id: anchorId
            },
            text: tab.label
        });

        li.appendChild(anchor);
        nav.appendChild(li);
        tabElements.push({ li, anchor });

        // Create tab panel
        const panel = createElement('div', {
            attrs: {
                id: panelId,
                'aria-labelledby': anchorId,
                class: 'ui-tabs-panel ui-widget-content ui-corner-bottom',
                role: 'tabpanel',
                'aria-expanded': isActive ? 'true' : 'false',
                'aria-hidden': isActive ? 'false' : 'true'
            }
        });

        if (!isActive) {
            panel.style.display = 'none';
        }

        if (typeof tab.content === 'string') {
            panel.textContent = tab.content;
        } else if (tab.content instanceof HTMLElement) {
            panel.appendChild(tab.content);
        }

        panels.push(panel);
    });

    container.appendChild(nav);
    panels.forEach(panel => container.appendChild(panel));

    // Activate function to switch tabs
    const activate = (tabIndex) => {
        if (tabIndex < 0 || tabIndex >= tabs.length) return;

        // Deactivate all tabs
        tabElements.forEach((tab, i) => {
            tab.li.className = 'ui-state-default ui-corner-top';
            tab.li.setAttribute('tabindex', '-1');
            tab.li.setAttribute('aria-selected', 'false');

            panels[i].style.display = 'none';
            panels[i].setAttribute('aria-expanded', 'false');
            panels[i].setAttribute('aria-hidden', 'true');
        });

        // Activate selected tab
        const selectedTab = tabElements[tabIndex];
        selectedTab.li.className = 'ui-state-default ui-corner-top ui-tabs-active ui-state-active';
        selectedTab.li.setAttribute('tabindex', '0');
        selectedTab.li.setAttribute('aria-selected', 'true');

        panels[tabIndex].style.display = 'block';
        panels[tabIndex].setAttribute('aria-expanded', 'true');
        panels[tabIndex].setAttribute('aria-hidden', 'false');
    };

    // Add click handlers
    tabElements.forEach((tab, index) => {
        tab.anchor.addEventListener('click', (e) => {
            e.preventDefault();
            activate(index);
        });
    });

    return { container, nav, panels, activate };
}

/**
 * Create Canvas-styled accordion (jQuery UI accordion)
 *
 * @param {Object} options - Accordion options
 * @param {string} [options.id] - Accordion container ID
 * @param {Array} options.sections - Array of section objects {title, content, expanded}
 * @param {boolean} [options.mini] - Use mini variant
 * @returns {Object} { container, sections, expand, collapse, toggle }
 */
export function createAccordion({ id = '', sections, mini = true }) {
    const containerId = id || `accordion-${Date.now()}`;

    const classes = ['accordion'];
    if (mini) classes.push('ui-accordion--mini');

    const container = createElement('div', {
        attrs: {
            id: containerId,
            class: classes.join(' ')
        }
    });

    const sectionElements = [];

    sections.forEach((section, index) => {
        const isExpanded = section.expanded || false;

        // Create header
        const header = createElement('h3', {
            attrs: {
                class: isExpanded ? 'ui-accordion-header ui-state-active' : 'ui-accordion-header',
                role: 'tab',
                'aria-expanded': isExpanded ? 'true' : 'false',
                'aria-selected': isExpanded ? 'true' : 'false',
                tabindex: '0'
            }
        });

        const headerLink = createElement('a', {
            attrs: { href: '#' },
            text: section.title
        });

        header.appendChild(headerLink);

        // Create content wrapper
        const contentWrapper = createElement('div', {
            attrs: {
                class: 'ui-accordion-content',
                role: 'tabpanel',
                'aria-hidden': isExpanded ? 'false' : 'true'
            }
        });

        if (!isExpanded) {
            contentWrapper.style.display = 'none';
        }

        const contentPadding = createElement('div', {
            attrs: { class: 'pad-box-mini' }
        });

        if (typeof section.content === 'string') {
            contentPadding.textContent = section.content;
        } else if (section.content instanceof HTMLElement) {
            contentPadding.appendChild(section.content);
        }

        contentWrapper.appendChild(contentPadding);

        container.appendChild(header);
        container.appendChild(contentWrapper);

        sectionElements.push({ header, contentWrapper, headerLink });
    });

    // Expand function
    const expand = (sectionIndex) => {
        if (sectionIndex < 0 || sectionIndex >= sections.length) return;

        const section = sectionElements[sectionIndex];
        section.header.className = 'ui-accordion-header ui-state-active';
        section.header.setAttribute('aria-expanded', 'true');
        section.header.setAttribute('aria-selected', 'true');
        section.contentWrapper.style.display = 'block';
        section.contentWrapper.setAttribute('aria-hidden', 'false');
    };

    // Collapse function
    const collapse = (sectionIndex) => {
        if (sectionIndex < 0 || sectionIndex >= sections.length) return;

        const section = sectionElements[sectionIndex];
        section.header.className = 'ui-accordion-header';
        section.header.setAttribute('aria-expanded', 'false');
        section.header.setAttribute('aria-selected', 'false');
        section.contentWrapper.style.display = 'none';
        section.contentWrapper.setAttribute('aria-hidden', 'true');
    };

    // Toggle function
    const toggle = (sectionIndex) => {
        if (sectionIndex < 0 || sectionIndex >= sections.length) return;

        const section = sectionElements[sectionIndex];
        const isExpanded = section.header.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
            collapse(sectionIndex);
        } else {
            expand(sectionIndex);
        }
    };

    // Add click handlers
    sectionElements.forEach((section, index) => {
        section.headerLink.addEventListener('click', (e) => {
            e.preventDefault();
            toggle(index);
        });
    });

    return { container, sections: sectionElements, expand, collapse, toggle };
}


/**
 * Create a Canvas-styled content box
 *
 * @param {Object} options - Content box options
 * @param {HTMLElement|string} [options.content] - Content to wrap
 * @param {boolean} [options.mini] - Use mini variant
 * @returns {HTMLElement} Content box element
 */
export function createContentBox({ content = null, mini = false } = {}) {
    const box = createElement('div', {
        attrs: { class: mini ? 'content-box-mini' : 'content-box' }
    });

    if (content) {
        if (typeof content === 'string') {
            box.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            box.appendChild(content);
        }
    }

    return box;
}