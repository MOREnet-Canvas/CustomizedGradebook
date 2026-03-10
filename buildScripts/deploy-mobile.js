import { execSync } from "node:child_process";
import fs from "node:fs";

// Refuse to deploy if there are uncommitted changes
try {
    execSync("git diff --quiet", { stdio: "ignore" });        // working tree
    execSync("git diff --cached --quiet", { stdio: "ignore" }); // staged
} catch {
    console.error("[CG Mobile] Refusing to deploy: you have uncommitted changes.");
    console.error("[CG Mobile] Commit/stash your changes and try again.");
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(new URL("../mobile/package.json", import.meta.url)));
const tag = `mobile-v${pkg.version}`;

try {
    execSync(`gh release create ${tag} --title "Mobile ${tag}" --notes "Parent Mastery mobile release ${tag}"`, { stdio: "ignore" });
} catch {}
execSync(`gh release upload ${tag} dist/mobile/prod/mobileInit.js --clobber`, { stdio: "inherit" });

console.log(`[CG Mobile] Uploaded mobile module to release ${tag}`);