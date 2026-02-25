(function () {
    function add(msg) {
        var pre = document.getElementById("cg-mobile-debug");
        if (!pre) {
            pre = document.createElement("pre");
            pre.id = "cg-mobile-debug";
            pre.style.position = "fixed";
            pre.style.bottom = "0";
            pre.style.left = "0";
            pre.style.right = "0";
            pre.style.zIndex = "999999";
            pre.style.maxHeight = "40%";
            pre.style.overflow = "auto";
            pre.style.margin = "0";
            pre.style.padding = "10px";
            pre.style.fontSize = "12px";
            pre.style.background = "rgba(0,0,0,0.85)";
            pre.style.color = "white";
            pre.style.whiteSpace = "pre-wrap";
            document.body.appendChild(pre);
        }
        pre.textContent += msg + "\n";
    }

    add("✅ Mobile Theme JS Loaded");
    add("location.href: " + (location && location.href));
    add("document.URL: " + document.URL);
    add("has ENV: " + (typeof window.ENV !== "undefined"));
    add("has jQuery: " + (typeof window.jQuery !== "undefined"));
    add("body id: " + (document.body && document.body.id));
    add("body class: " + (document.body && document.body.className));
})();