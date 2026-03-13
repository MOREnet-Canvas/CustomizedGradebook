#!/usr/bin/env node
import esbuild from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";

// Get version bump type from command line argument
const bumpType = process.argv[2];
if (!bumpType || !['patch', 'minor', 'major'].includes(bumpType)) {
    console.error("Usage: npm run release:patch/minor/major");
    process.exit(1);
}

console.log(`🚀 Starting Main Release: ${bumpType.toUpperCase()}`);
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
    console.error("\n❌ Refusing to release: you have uncommitted changes.");
    console.error("   Commit/stash your changes and try again.");
    process.exit(1);
}

// Check on main branch
try {
    const branch = execSync("git branch --show-current").toString().trim();
    if (branch !== "main") {
        console.warn(`   ⚠️  Warning: You're on branch '${branch}', not 'main'`);
    } else {
        console.log("   ✓ On branch: main");
    }
} catch {}

// ============================================================================
// VERSION BUMP
// ============================================================================

console.log("\n✓ Version Bump:");

// Read current version
const pkg = JSON.parse(fs.readFileSync("package.json", 'utf8'));
const oldVersion = pkg.version;

// Use npm version to bump (creates annotated tag automatically)
execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: "ignore" });

// Read new version
const newPkg = JSON.parse(fs.readFileSync("package.json", 'utf8'));
const newVersion = newPkg.version;
const tag = `v${newVersion}`;

console.log(`   • Updated package.json: ${oldVersion} → ${newVersion}`);

// Commit the version change
execSync(`git add package.json`, { stdio: "ignore" });
execSync(`git commit -m "${newVersion}"`, { stdio: "ignore" });
console.log(`   • Committed: "${newVersion}"`);

// Create annotated git tag
execSync(`git tag -a ${tag} -m "Release ${newVersion}"`, { stdio: "ignore" });
console.log(`   • Created annotated tag: ${tag}`);

// ============================================================================
// GIT PUSH
// ============================================================================

console.log("\n✓ Git Push:");

execSync(`git push --follow-tags`, { stdio: "ignore" });
console.log(`   • Pushed commits to origin/main`);
console.log(`   • Pushed tag ${tag}`);

// ============================================================================
// BUILD
// ============================================================================

console.log("\n✓ Build:");

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
    } catch {}

    return {
        timestamp,
        gitHash,
        versionString: `${timestamp} (${mode}, ${gitHash})`
    };
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const buildMeta = getBuildMetadata("prod");
const outdir = "dist/prod";
ensureDir(outdir);

console.log(`   🔨 Building customGradebookInit.js (prod v${newVersion})...`);

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
            "ENV_NAME": JSON.stringify("prod"),
            "ENV_DEV": "false",
            "ENV_PROD": "true",
            "BUILD_VERSION": JSON.stringify(buildMeta.versionString),
        }
    });

    const size = fs.statSync(`${outdir}/customGradebookInit.js`).size;
    console.log(`   • Built and minified (${(size / 1024).toFixed(0)} KB)`);
} catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
}




// ============================================================================
// GITHUB RELEASE
// ============================================================================

console.log("\n✓ GitHub Release:");

// Create release
try {
    execSync(`gh release create ${tag} --title "${tag}" --notes "Production release ${tag}"`, { stdio: "ignore" });
    console.log(`   • Created release ${tag}`);
} catch {
    console.log(`   • Release ${tag} already exists`);
}

// Upload bundle
execSync(`gh release upload ${tag} dist/prod/customGradebookInit.js --clobber`, { stdio: "ignore" });
console.log(`   • Uploaded customGradebookInit.js`);

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "━".repeat(80));
console.log(`✅ Release ${tag} Complete!`);
console.log(`\n📦 Release: https://github.com/MOREnet-Canvas/CustomizedGradebook/releases/tag/${tag}`);
console.log(`🕐 Built:   ${buildMeta.timestamp}`);
console.log(`\n💡 Note: Version manifest will auto-update via GitHub Actions`);
console.log(`   Workflow: update-version-manifest.yml`);