
import esbuild from "esbuild";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";

const mode = process.argv[2] || "dev";

const outdir = mode === "prod" ? "dist/prod" : "dist/dev";

// ---- Build Timestamp ----
function formatTimestampCentral(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).formatToParts(date);

    let y, m, d, h, min, s, ampm;

    for (const p of parts) {
        if (p.type === "year") y = p.value;
        if (p.type === "month") m = p.value;
        if (p.type === "day") d = p.value;
        if (p.type === "hour") h = p.value;
        if (p.type === "minute") min = p.value;
        if (p.type === "second") s = p.value;
        if (p.type === "dayPeriod") ampm = p.value.toUpperCase();
    }

    return `${y}-${m}-${d} ${h}:${min}:${s} ${ampm}`;
}

const humanTime = formatTimestampCentral(new Date());


// ---- Git Commit Hash ----
let gitHash = "unknown";
try {
    gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
    console.warn("Warning: Could not read git hash:", e);
}

const versionString = `${humanTime} (${mode}, ${gitHash})`;

// Ensure output folder exists
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

esbuild.build({
    entryPoints: ["src/customGradebookInit.js"],
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
