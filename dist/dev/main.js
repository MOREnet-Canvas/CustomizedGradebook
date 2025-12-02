(() => {
  // src/utils/logger.js
  function log(...args) {
    console.log("[DEV]", ...args);
  }

  // src/main.js
  log("Hello from ESBuild Dev Bundle!");
  alert("Bundler test loaded successfully!!!! v6");
})();
//# sourceMappingURL=main.js.map
