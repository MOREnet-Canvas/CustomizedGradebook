
import esbuild from "esbuild";
import { existsSync, mkdirSync } from "fs";

const mode = process.argv[2] || "dev";

const outdir = mode === "prod" ? "dist/prod" : "dist/dev";

// Ensure output folder exists
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

esbuild.build({
    entryPoints: ["src/main.js"],
    outfile: `${outdir}/main.js`,
    bundle: true,
    minify: mode === "prod",
    sourcemap: mode === "dev",
    format: "iife", // Immediately-invoked function expression — safe for Canvas
    target: "es2017"
}).then(() => {
    console.log(`✔️  Built ${mode} bundle → ${outdir}/main.js`);
}).catch(() => process.exit(1));
