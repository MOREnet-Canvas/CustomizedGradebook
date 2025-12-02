(function () {
    const script = document.createElement("script");
    script.src = "https://morenet-canvas.github.io/CustomizedGradebook/dist/prod/main.js?v=prod1";
    script.onload = () => console.log("[CG] Loaded PROD bundle from GitHub");
    document.head.appendChild(script);
})();

