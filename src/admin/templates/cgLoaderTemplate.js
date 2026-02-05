// src/admin/templates/cgLoaderTemplate.js
/**
 * CG Loader Template (B)
 * 
 * This is the stable CG loader logic that gets combined with:
 * - A = External loader (district's Theme JS)
 * - C = Managed config block (generated from dashboard UI)
 * 
 * This template:
 * - Is an IIFE that loads the CG bundle
 * - Merges config safely from window.CG_MANAGED.config
 * - Determines bundle URL from window.CG_MANAGED.release
 * - Uses script ID guard to prevent duplicate loading
 */

export const CG_LOADER_TEMPLATE = `
(function () {
    // ========================================================================
    // CG LOADER - CONFIGURATION MERGE
    // ========================================================================

    // Initialize CG_CONFIG if not already present (allows pre-configuration)
    window.CG_CONFIG = window.CG_CONFIG || {};

    // Merge managed config if present (only for undefined keys)
    if (window.CG_MANAGED && window.CG_MANAGED.config) {
        for (const key in window.CG_MANAGED.config) {
            if (window.CG_CONFIG[key] === undefined) {
                window.CG_CONFIG[key] = window.CG_MANAGED.config[key];
            }
        }
    }

    // ========================================================================
    // CG LOADER - SCRIPT INJECTION
    // ========================================================================

    // Read release configuration from managed block
    const release = (window.CG_MANAGED && window.CG_MANAGED.release) || {
        channel: "prod",
        version: "v1.0.3",
        source: "github_release"
    };

    // Prevent duplicate loading
    const bundleId = "cg_" + release.channel + "_bundle";
    if (document.getElementById(bundleId)) {
        console.log(\`[CG] \${release.channel.toUpperCase()} bundle already loaded; skipping\`);
        return;
    }

    const script = document.createElement("script");
    script.id = bundleId;
    script.defer = true;

    // Determine script URL based on source and channel
    if (release.source === "github_release") {
        if (release.channel === "dev") {
            // Dev channel: use cache-busting query parameter
            const cacheBuster = Date.now();
            script.src = \`https://github.com/morenet-canvas/CustomizedGradebook/releases/download/dev/customGradebookInit.js?v=\${cacheBuster}\`;
        } else {
            // Prod channel: use version tag
            script.src = \`https://github.com/morenet-canvas/CustomizedGradebook/releases/download/\${release.version}/customGradebookInit.js\`;
        }
    } else if (release.source === "pages") {
        const cacheBuster = release.version || Date.now();
        script.src = \`https://morenet-canvas.github.io/CustomizedGradebook/dist/\${release.channel}/customGradebookInit.js?v=\${cacheBuster}\`;
    } else {
        console.error("[CG] Unknown release source:", release.source);
        return;
    }

    script.onload = () => console.log(\`[CG] Loaded customGradebookInit.js (\${release.channel.toUpperCase()} \${release.version})\`);
    script.onerror = () => console.error(\`[CG] Failed to load customGradebookInit.js (\${release.channel.toUpperCase()})\`);
    document.head.appendChild(script);
})();
`.trim();