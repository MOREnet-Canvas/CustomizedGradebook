// src/ui/buttons.js
import { inheritFontStylesFrom } from "../utils/dom.js";

const BRAND_COLOR_FALLBACK = "#0c7d9d";

export function makeButton({ label, id = null, onClick = null, type = "primary", tooltip = null }) {
    const button = document.createElement("button");

    button.textContent = label;
    if (id) button.id = id;
    if (tooltip) button.title = tooltip;

    // Try to inherit font styles from a known Canvas menu / button element (default settings are a bit too small)
    const foundFontStyles = inheritFontStylesFrom(".css-1f65ace-view-link", button);
    // If not found, fallback to default font styling
    if (!foundFontStyles) {
        button.style.fontSize = "14px";
        button.style.fontFamily = "inherit";
        button.style.fontWeight = "600";
    }

    // Basic button appearance
    button.style.marginLeft = "1rem";
    button.style.padding = "0.5rem 1rem";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
    button.style.transition = "background 0.3s, color 0.3s";

    const rootStyles = getComputedStyle(document.documentElement);
    const primaryButtonColor =
        rootStyles.getPropertyValue("--ic-brand-button--primary-bgd").trim() || BRAND_COLOR_FALLBACK;
    const textColor =
        rootStyles.getPropertyValue("--ic-brand-button--primary-text").trim() || "#ffffff";
    const secondaryButtonColor =
        rootStyles.getPropertyValue("--ic-brand-button--secondary-bgd").trim() || "#e0e0e0";
    const secondaryTextColor =
        rootStyles.getPropertyValue("--ic-brand-button--secondary-text").trim() || "#ffffff";

    if (type === "primary") {
        button.style.background = primaryButtonColor;
        button.style.color = textColor;
    } else if (type === "secondary") {
        button.style.background = secondaryButtonColor;
        button.style.color = secondaryTextColor;
        button.style.border = "1px solid #ccc";
    }

    if (onClick) {
        button.addEventListener("click", onClick);
    }

    return button;
}

export function createButtonColumnContainer() {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "row";
    container.style.gap = "0.01rem"; // spacing between buttons
    container.style.marginLeft = "1rem"; // optional spacing from the rest of the toolbar
    return container;
}
