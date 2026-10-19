import esbuild from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";

// Pilot build: prod-like (minified, prod log level) bundle published to the
// rolling `pilot` GitHub release. Loaders route teacher-like users in
// window.CG_MANAGED.release.pilotCourseIds to it; everyone else stays on prod.

console.log("🚀 Deploying Pilot Build");
console.log("━".repeat(80));

// ============================================================================
// PRE-FLIGHT CHECKS
// ============================================================================

console.log("\n✓ Pre-flight Checks:");

// Clean tree so every pilot build maps to a commit
try {
    execSync("git diff --quiet", { stdio: "ignore" });
    execSync("git diff --cached --quiet", { stdio: "ignore" });
    console.log("   ✓ No uncommitted changes");
} catch {
    console.error("\n❌ Refusing to deploy: you have uncommitted changes.");
    console.error("   Commit/stash your changes and try again.");
    process.exit(1);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getBuildMetadata(mode) {
    const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    let gitHash = "unknown";
    try {
        gitHash = execSync("git rev-parse --short HEAD").toString().trim();
    } catch (e) {
        console.warn("⚠️  Could not read git hash");
    }

    return {
        timestamp,
        gitHash,
        versionString: `${timestamp} (${mode}, ${gitHash})`
    };
}

function formatSize(bytes) {
    return `${(bytes / 1024).toFixed(0)} KB`;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ============================================================================
// BUILD MAIN BUNDLE
// ============================================================================

console.log("\n📦 Building Main Bundle");
console.log("━".repeat(80));
console.log("🔨 Building customGradebookInit.js (pilot)...");

const buildMeta = getBuildMetadata("pilot");
const outdir = "dist/pilot";
ensureDir(outdir);

try {
    await esbuild.build({
        entryPoints: ["src/customGradebookInit.js"],
        outfile: `${outdir}/customGradebookInit.js`,
        bundle: true,
        minify: true,
        sourcemap: false,
        format: "iife",
        target: "es2017",
        define: {
            "ENV_NAME": JSON.stringify("pilot"),
            "ENV_DEV": "false",
            "ENV_PROD": "true",
            "BUILD_VERSION": JSON.stringify(buildMeta.versionString),
        }
    });

    const size = fs.statSync(`${outdir}/customGradebookInit.js`).size;
    console.log(`   ✓ Built and minified (${formatSize(size)})`);
} catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
}

// ============================================================================
// GITHUB RELEASE (rolling "pilot" pre-release)
// ============================================================================

console.log("\n📦 GitHub Release");
console.log("━".repeat(80));

try {
    execSync(`gh release create pilot --prerelease --title "pilot" --notes "Rolling pilot build — loaded by teachers in pilotCourseIds"`, { stdio: "ignore" });
    console.log("   ✓ Created release pilot");
} catch {
    console.log("   ℹ️  Release pilot already exists");
}

console.log("\n📤 Uploading bundle...");
try {
    execSync(`gh release upload pilot ${outdir}/customGradebookInit.js --clobber`, { stdio: "inherit" });
    console.log("   ✓ Uploaded customGradebookInit.js");
} catch (error) {
    console.error("❌ Upload failed:", error.message);
    process.exit(1);
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "━".repeat(80));
console.log("✅ Pilot Deployment Complete!");
console.log("\n🔗 Release: https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/tag/pilot");
console.log(`🕐 Built:   ${buildMeta.timestamp} (${buildMeta.gitHash})`);
