#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Get version bump type from command line argument
const bumpType = process.argv[2];
if (!bumpType || !['patch', 'minor', 'major'].includes(bumpType)) {
    console.error("[CG Mobile] Usage: node buildScripts/release-mobile.js <patch|minor|major>");
    process.exit(1);
}

// Refuse to release if there are uncommitted changes
try {
    execSync("git diff --quiet", { stdio: "ignore" });        // working tree
    execSync("git diff --cached --quiet", { stdio: "ignore" }); // staged
} catch {
    console.error("[CG Mobile] Refusing to release: you have uncommitted changes.");
    console.error("[CG Mobile] Commit/stash your changes and try again.");
    process.exit(1);
}

// Read current mobile package.json
const mobilePkgPath = path.join(process.cwd(), 'mobile', 'package.json');
const mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8'));

// Parse current version
const [major, minor, patch] = mobilePkg.version.split('.').map(Number);

// Bump version based on type
let newVersion;
if (bumpType === 'major') {
    newVersion = `${major + 1}.0.0`;
} else if (bumpType === 'minor') {
    newVersion = `${major}.${minor + 1}.0`;
} else { // patch
    newVersion = `${major}.${minor}.${patch + 1}`;
}

console.log(`[CG Mobile] Bumping version: ${mobilePkg.version} → ${newVersion}`);

// Update package.json
mobilePkg.version = newVersion;
fs.writeFileSync(mobilePkgPath, JSON.stringify(mobilePkg, null, 2) + '\n');

// Commit the version change
execSync(`git add mobile/package.json`, { stdio: "inherit" });
execSync(`git commit -m "Bump mobile version to ${newVersion}"`, { stdio: "inherit" });

// Create git tag
const tag = `mobile-v${newVersion}`;
execSync(`git tag ${tag}`, { stdio: "inherit" });
console.log(`[CG Mobile] Created tag: ${tag}`);

// Push with tags
execSync(`git push --follow-tags`, { stdio: "inherit" });
console.log(`[CG Mobile] Pushed to GitHub with tags`);

// Build production bundle
console.log(`[CG Mobile] Building production bundle...`);
execSync(`npm run build:mobile:prod`, { stdio: "inherit" });

// Deploy to GitHub Release
try {
    execSync(`gh release create ${tag} --title "Mobile ${tag}" --notes "Parent Mastery mobile release ${tag}"`, { stdio: "ignore" });
} catch {
    // Release might already exist, that's okay
}
execSync(`gh release upload ${tag} dist/mobile/prod/mobileInit.js --clobber`, { stdio: "inherit" });

console.log(`[CG Mobile] ✓ Released ${tag} successfully!`);