(function () {
    const script = document.createElement("script");
    script.src = "https://morenet-canvas.github.io/CustomizedGradebook/dist/dev/main.js?v=dev1";
    script.onload = () => console.log("[CG] Loaded DEV bundle from GitHub");
    document.head.appendChild(script);
})();
