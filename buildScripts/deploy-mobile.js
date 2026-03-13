import esbuild from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";

console.log("🚀 Deploying Mobile Production Build");
console.log("━".repeat(80));

// ============================================================================
// PRE-FLIGHT CHECKS
// ============================================================================

console.log("\n✓ Pre-flight Checks:");

// Check for uncommitted changes
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
// READ VERSION
// ============================================================================

const mobilePkg = JSON.parse(fs.readFileSync(new URL("../mobile/package.json", import.meta.url)));
const version = mobilePkg.version;
const tag = `mobile-v${version}`;

console.log(`   ✓ Version: ${version}`);

// ============================================================================
// BUILD MOBILE BUNDLE
// ============================================================================

console.log("\n📱 Building Mobile Bundle");
console.log("━".repeat(80));
console.log(`🔨 Building mobileInit.js (prod v${version})...`);

const buildMeta = getBuildMetadata("prod");
const outdir = "dist/mobile/prod";
ensureDir(outdir);

try {
    await esbuild.build({
        entryPoints: ["src/masteryDashboard/mobileInit.js"],
        outfile: `${outdir}/mobileInit.js`,
        bundle: true,
        minify: true,
        sourcemap: false,
        format: "iife",
        target: "es2017",
        define: {
            "ENV_NAME": JSON.stringify("prod"),
            "ENV_DEV": "false",
            "ENV_PROD": "true",
            "BUILD_VERSION": JSON.stringify(buildMeta.versionString),
        }
    });

    const size = fs.statSync(`${outdir}/mobileInit.js`).size;
    console.log(`   ✓ Built and minified (${formatSize(size)})`);
} catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
}

// ============================================================================
// CREATE GITHUB RELEASE
// ============================================================================

console.log("\n📦 GitHub Release");
console.log("━".repeat(80));

// Try to create release (ignore if already exists)
try {
    execSync(`gh release create ${tag} --title "Mobile ${tag}" --notes "Parent Mastery mobile release ${tag}"`, { stdio: "ignore" });
    console.log(`   ✓ Created release ${tag}`);
} catch {
    console.log(`   ℹ️  Release ${tag} already exists`);
}

// Upload bundle
console.log("\n📤 Uploading bundle...");
try {
    execSync(`gh release upload ${tag} dist/mobile/prod/mobileInit.js --clobber`, { stdio: "inherit" });
    console.log(`   ✓ Uploaded mobileInit.js`);
} catch (error) {
    console.error("❌ Upload failed:", error.message);
    process.exit(1);
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "━".repeat(80));
console.log(`✅ Mobile Production Deployment Complete!`);
console.log(`\n📦 Release: https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/tag/${tag}`);
console.log(`🕐 Built:   ${buildMeta.timestamp}`);
console.log(`\n💡 Note: This re-deployed to existing version ${version}`);
console.log(`   To create a new version, use: npm run release:mobile:patch/minor/major`);

