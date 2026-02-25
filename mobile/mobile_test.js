(function () {
    function add(msg) {
        var pre = document.getElementById("cg-mobile-debug");
        if (!/\/courses\/\d+\/pages\/mastery-dashboard/.test(location.pathname)) return;
        if (!pre) {
            pre = document.createElement("pre");
            pre.id = "cg-mobile-debug";
            pre.style.position = "absolute";
            pre.style.left = "0";
            pre.style.right = "0";
            pre.style.bottom = "0";
            pre.style.width = "100%";
            pre.style.boxSizing = "border-box";
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

    add("📱 Parent App Front Page Fingerprint");
    add("href: " + location.href);
    add("path: " + location.pathname);
    add("title: " + document.title);
    add("has ENV: " + (typeof window.ENV !== "undefined"));
    add("body id: " + (document.body && document.body.id));
    add("body class: " + (document.body && document.body.className));
    // If the mastery dashboard root exists, prove we can inject content here
    var root = document.getElementById("parent-mastery-root");
    if (root) {
        root.innerHTML = '<div style="padding:12px;border:1px solid #ddd;border-radius:10px;margin:12px 0;">✅ Mobile theme JS can inject into Mastery Dashboard</div>';
    }
})();