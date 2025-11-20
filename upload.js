(function () {
    const script = document.createElement("script");
    script.src = "https://morenet-canvas.github.io/CustomizedGradebook/main.js?v=1";
    script.onload = () => console.log("Loaded external script from GitHub Pages");
    document.head.appendChild(script);
})();
