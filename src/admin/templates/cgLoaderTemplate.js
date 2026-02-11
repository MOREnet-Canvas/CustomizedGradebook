// src/admin/templates/cgLoaderTemplate.js
/**
 * CG Loader Template (Section C)
 *
 * This is the stable CG loader logic that gets combined with:
 * - A = External loader (district's Theme JS)
 * - B = Managed config block (generated from dashboard UI)
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
    // CG LOADER - GRADES GATE (PREVENT FLASH)
    // ========================================================================

    // Hide the Canvas /grades table ASAP to prevent flash (Theme CSS uses this gate)
    const addGradesGate = () => {
        if (document.body
            && window.location.pathname === '/grades'
            && document.body.classList.contains('responsive_student_grades_page')) {
            document.body.classList.add('cg_processing_grades');
        }
    };

    addGradesGate();
    document.addEventListener('DOMContentLoaded', addGradesGate, { once: true });

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

    // ========================================================================
    // HELPER FUNCTIONS (defined before use)
    // ========================================================================

    function loadScriptSync() {
        const script = document.createElement("script");
        script.id = bundleId;
        script.defer = true;

        // Determine script URL based on source and channel
        if (release.source === "github_release") {
            if (release.channel === "dev") {
                // Dev channel: use cache-busting query parameter
                const cacheBuster = Date.now();
                script.src = \`https://github.com/morenet-canvas/CustomizedGradebook/releases/download/dev/customGradebookInit.js?v=\${cacheBuster}\`;
            } else if (release.channel === "beta") {
                // Beta channel: use GitHub's /releases/latest/download/ redirect
                // This automatically fetches the most recent production release without version pinning
                // WARNING: May receive breaking changes without notice - use for testing only
                script.src = \`https://github.com/morenet-canvas/CustomizedGradebook/releases/latest/download/customGradebookInit.js\`;
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
    }

    function loadScript(version) {
        console.log(\`[CG] Loading auto-patch version: \${version}\`);
        const script = document.createElement("script");
        script.id = bundleId;
        script.defer = true;
        script.src = \`https://github.com/morenet-canvas/CustomizedGradebook/releases/download/\${version}/customGradebookInit.js\`;
        script.onload = () => console.log(\`[CG] Loaded customGradebookInit.js (AUTO-PATCH \${version})\`);
        script.onerror = () => console.error(\`[CG] Failed to load customGradebookInit.js (AUTO-PATCH \${version})\`);
        document.head.appendChild(script);
    }

    // ========================================================================
    // CHANNEL-SPECIFIC LOADING LOGIC
    // ========================================================================

    // Auto-patch channel: fetch version from manifest
    if (release.channel === "auto-patch" && release.versionTrack) {
        console.log(\`[CG] Auto-patch mode: fetching version manifest for track "\${release.versionTrack}"\`);
        const manifestUrl = "https://morenet-canvas.github.io/CustomizedGradebook/versions.json";
        const fallbackVersion = release.version || "v1.0.3";
        const cacheBuster = Date.now();

        fetch(\`\${manifestUrl}?t=\${cacheBuster}\`)
            .then(response => {
                console.log(\`[CG] Manifest fetch response: \${response.status} \${response.statusText}\`);
                if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
                return response.json();
            })
            .then(manifest => {
                console.log(\`[CG] Manifest loaded:\`, manifest);
                const resolvedVersion = manifest[release.versionTrack];
                if (!resolvedVersion) {
                    console.warn(\`[CG] Version track "\${release.versionTrack}" not found in manifest, using fallback: \${fallbackVersion}\`);
                    loadScript(fallbackVersion);
                } else {
                    console.log(\`[CG] Resolved \${release.versionTrack} → \${resolvedVersion}\`);
                    loadScript(resolvedVersion);
                }
            })
            .catch(error => {
                console.warn(\`[CG] Failed to fetch version manifest: \${error.message}, using fallback: \${fallbackVersion}\`);
                loadScript(fallbackVersion);
            });
        return;
    }

    // Standard channels: load immediately
    loadScriptSync();
})();
`.trim();