(function () {
    if (document.getElementById("cg_prod_bundle")) return;

    const script = document.createElement("script");
    script.id = "cg_prod_bundle";
    const cacheBuster = Date.now();

    script.src = `https://morenet-canvas.github.io/CustomizedGradebook/dist/prod/main.js?v=${cacheBuster}`;
    script.onload = () => console.log("[CG] Loaded PROD bundle");
    script.onerror = () => console.error("[CG] Failed to load PROD bundle");
    document.head.appendChild(script);
})();

