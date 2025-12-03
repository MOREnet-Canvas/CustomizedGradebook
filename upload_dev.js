(function () {
    if (document.getElementById("cg_dev_bundle")) {
        console.log("[CG] Dev bundle already loaded; skipping");
        return;
    }

    const script = document.createElement("script");
    const cacheBuster = Date.now(); // new number every load

    script.src = `https://morenet-canvas.github.io/CustomizedGradebook/dist/dev/main.js?v=${cacheBuster}`;
    script.onload = () => console.log("[CG] Loaded DEV bundle from GitHub (no cache)");
    script.onerror = () => console.error("[CG] Failed to load DEV bundle from GitHub");
    document.head.appendChild(script);
})();
