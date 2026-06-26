// src/ui/banner.js
import { getCourseId } from "../utils/canvas.js";
import { k } from "../utils/keys.js";
import { brandPrimary } from "./brandColors.js";

/**
 * Display a floating notification banner anchored to the Canvas content area.
 * Removes any existing banners unless `allowMultiple` is true.
 *
 * @param {Object} [options={}]
 * @param {string} [options.text=""] - Banner message text
 * @param {number|null} [options.duration=null] - Auto-hide delay in ms; null keeps the banner until manually removed
 * @param {string} [options.top="20px"] - CSS top offset for banner position
 * @param {string} [options.right="20px"] - CSS right offset for banner position
 * @param {boolean} [options.center=false] - If true, centers the banner horizontally instead of right-aligning
 * @param {string} [options.backgroundColor] - Banner background color (defaults to Canvas brand primary)
 * @param {string} [options.textColor="#ffffff"] - Banner text color
 * @param {boolean} [options.allowMultiple=false] - If true, existing banners are not removed before showing this one
 * @param {string} [options.ariaLive="polite"] - ARIA live region setting: "polite", "assertive", or "off"
 * @returns {HTMLElement} The created banner element
 */
export function showFloatingBanner({
                                text = "",
                                duration = null,              // null = stays until removed; number = auto-hide after ms
                                top = "20px",
                                right = "20px",
                                center = false,
                                backgroundColor = brandPrimary(),
                                textColor = "#ffffff",
                                allowMultiple = false,         // keep existing banners?
                                ariaLive = "polite"            // "polite" | "assertive" | "off"
                            } = {}) {
    // Remove existing banners unless explicitly allowed
    if (!allowMultiple) {
        document.querySelectorAll(".floating-banner").forEach(b => b.remove());
    }

    const baseElement =
        document.querySelector(".ic-Layout-contentMain") ||
        document.querySelector(".ic-app-header__menu-list-item__link") ||
        document.body;

    const styles = getComputedStyle(baseElement);
    const fontFamily = styles.fontFamily;
    const fontSize = styles.fontSize;
    const fontWeight = styles.fontWeight;

    // Create banner
    const banner = document.createElement("div");
    banner.className = "floating-banner";
    banner.setAttribute("role", "status");
    if (ariaLive && ariaLive !== "off") banner.setAttribute("aria-live", ariaLive);

    // Core positioning + style
    Object.assign(banner.style, {
        position: "fixed",
        top,
        background: backgroundColor,
        padding: "10px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
        zIndex: "9999",
        fontSize,
        color: textColor,
        fontFamily,
        fontWeight,
        display: "inline-flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "min(90vw, 720px)",
        lineHeight: "1.35",
        wordBreak: "break-word"
    });

    if (center) {
        banner.style.left = "50%";
        banner.style.transform = "translateX(-50%)";
    } else {
        banner.style.right = right;
    }

    // Message node to keep the X button separate
    const msg = document.createElement("span");
    msg.className = "floating-banner__text";
    banner.appendChild(msg);

    // Dismiss "X"
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss message");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
        cursor: "pointer",
        fontWeight: "bold",
        border: "none",
        background: "transparent",
        color: "inherit",
        fontSize,
        lineHeight: "1"
    });
    closeBtn.onclick = () => destroy();
    banner.appendChild(closeBtn);

    document.body.appendChild(banner);

    // --- Messaging control (sticky, queue, soft) ---
    let lockedUntil = 0;
    let pending = null;
    let holdTimer = null;
    let autoTimer = null;

    const now = () => Date.now();
    const isLocked = () => now() < lockedUntil;

    // const apply = (textValue) => { msg.textContent = textValue; };
    // Only get course ID if we're on a course page (not all-grades page)
    const courseId = window.location.pathname.includes('/courses/') ? getCourseId() : null;
    const apply = (textValue) => {
        msg.textContent = textValue;
        if (courseId) localStorage.setItem(k('bannerLast', courseId), textValue);
    };

    const unlockAndFlush = () => {
        lockedUntil = 0;
        if (pending != null) {
            apply(pending);
            pending = null;
        }
    };


    banner.setText = (newText) => {
        if (isLocked()) {
            pending = newText; // keep only the latest
        } else {
            apply(newText);
        }
    };

    banner.hold = (newText, ms = 3000) => {
        const now = Date.now();
        // If currently locked, just queue the text; don't extend the lock
        if (now < lockedUntil) {
            pending = newText;       // will show when the current hold ends
            return;
        }

        lockedUntil = now + ms;
        apply(newText);

        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
            lockedUntil = 0;
            if (pending != null) {
                apply(pending);
                pending = null;
            }
        }, ms);
    };

    // Non-sticky update ignored during a hold
    banner.soft = (newText) => {
        if (!isLocked()) apply(newText);
    };

    // Remove with fade-out
    function destroy() {
        if (holdTimer) clearTimeout(holdTimer);
        if (autoTimer) clearTimeout(autoTimer);
        banner.style.transition = "opacity 150ms";
        banner.style.opacity = "0";
        setTimeout(() => banner.remove(), 160);
    }
    banner.removeBanner = destroy; // expose a named remover

    // Initial text
    (duration === "hold")
        ? banner.hold(text, 3000) // convenience: allow duration="hold"
        : banner.setText(text);

    // Auto-dismiss if a number is provided
    if (typeof duration === "number" && isFinite(duration) && duration >= 0) {
        autoTimer = setTimeout(destroy, duration);
    }

    closeBtn.onclick = () => {
        destroy();
    };

    // Save banner text for status pill restoration
    (duration === "hold") ? banner.hold(text, 3000) : banner.setText(text);

    return banner;
}
