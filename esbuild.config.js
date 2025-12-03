
import esbuild from "esbuild";
import { execSync } from "child_process";

import { existsSync, mkdirSync } from "fs";

const mode = process.argv[2] || "dev";

const outdir = mode === "prod" ? "dist/prod" : "dist/dev";

// ---- Build Timestamp ----
function formatTimestamp(d) {
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const seconds = d.getSeconds().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const year = d.getFullYear();

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${ampm}`;
}

// ---- Git Commit Hash ----
let gitHash = "unknown";
try {
    gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
    console.warn("Warning: Could not read git hash:", e);
}

const humanTime = formatTimestamp(new Date());
const versionString = `${humanTime} (${mode}, ${gitHash})`;

// Ensure output folder exists
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

esbuild.build({
    entryPoints: ["src/main.js"],
    outfile: `${outdir}/main.js`,
    bundle: true,
    minify: mode === "prod",
    sourcemap: mode === "dev",
    format: "iife", // Immediately-invoked function expression — safe for Canvas
    target: "es2017",
    define: {
        "ENV_NAME": JSON.stringify(mode),          // "dev" or "prod"
        "ENV_DEV": mode === "dev" ? "true" : "false",
        "ENV_PROD": mode === "prod" ? "true" : "false",
        "BUILD_VERSION": JSON.stringify(versionString),
    }
}).then(() => {
    console.log(`✔️  Built ${mode} bundle → ${outdir}/main.js`);
}).catch(() => process.exit(1));
