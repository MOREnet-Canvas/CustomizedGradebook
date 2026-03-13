import esbuild from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("🚀 Deploying Dev Builds");
console.log("━".repeat(80));

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

console.log("\n📦 Main Bundle (Desktop)");
console.log("━".repeat(80));
console.log("🔨 Building customGradebookInit.js (dev)...");

const mainMeta = getBuildMetadata("dev");
const mainOutdir = "dist/dev";
ensureDir(mainOutdir);

try {
    await esbuild.build({
        entryPoints: ["src/customGradebookInit.js"],
        outfile: `${mainOutdir}/customGradebookInit.js`,
        bundle: true,
        minify: false,
        sourcemap: true,
        format: "iife",
        target: "es2017",
        define: {
            "ENV_NAME": JSON.stringify("dev"),
            "ENV_DEV": "true",
            "ENV_PROD": "false",
            "BUILD_VERSION": JSON.stringify(mainMeta.versionString),
        }
    });

    const mainSize = fs.statSync(`${mainOutdir}/customGradebookInit.js`).size;
    const mapSize = fs.statSync(`${mainOutdir}/customGradebookInit.js.map`).size;
    console.log(`   ✓ Built (${formatSize(mainSize)} + ${formatSize(mapSize)} map)`);
} catch (error) {
    console.error("❌ Main build failed:", error.message);
    process.exit(1);
}

// Upload main
console.log("\n📤 Uploading to release: dev");
try {
    execSync("gh release upload dev dist/dev/customGradebookInit.js dist/dev/customGradebookInit.js.map --clobber", { stdio: "inherit" });
    console.log("   ✓ Uploaded customGradebookInit.js");
    console.log("   ✓ Uploaded customGradebookInit.js.map");
} catch (error) {
    console.error("❌ Upload failed:", error.message);
    process.exit(1);
}

// ============================================================================
// BUILD MOBILE BUNDLE
// ============================================================================

console.log("\n📱 Mobile Bundle (Parent App)");
console.log("━".repeat(80));
console.log("🔨 Building mobileInit.js (dev)...");

const mobileMeta = getBuildMetadata("dev");
const mobileOutdir = "dist/mobile/dev";
ensureDir(mobileOutdir);

try {
    await esbuild.build({
        entryPoints: ["src/masteryDashboard/mobileInit.js"],
        outfile: `${mobileOutdir}/mobileInit.js`,
        bundle: true,
        minify: false,
        sourcemap: false,
        format: "iife",
        target: "es2017",
        define: {
            "ENV_NAME": JSON.stringify("dev"),
            "ENV_DEV": "true",
            "ENV_PROD": "false",
            "BUILD_VERSION": JSON.stringify(mobileMeta.versionString),
        }
    });

    const mobileSize = fs.statSync(`${mobileOutdir}/mobileInit.js`).size;
    console.log(`   ✓ Built (${formatSize(mobileSize)})`);
} catch (error) {
    console.error("❌ Mobile build failed:", error.message);
    process.exit(1);
}

// Upload mobile
console.log("\n📤 Uploading to release: mobile-dev");
try {
    execSync("gh release upload mobile-dev dist/mobile/dev/mobileInit.js --clobber", { stdio: "inherit" });
    console.log("   ✓ Uploaded mobileInit.js");
} catch (error) {
    console.error("❌ Upload failed:", error.message);
    process.exit(1);
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "━".repeat(80));
console.log("✅ Dev Deployment Complete!");
console.log("\n🔗 Main:   https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/tag/dev");
console.log("🔗 Mobile: https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/tag/mobile-dev");
console.log(`🕐 Built:  ${mainMeta.timestamp}`);

