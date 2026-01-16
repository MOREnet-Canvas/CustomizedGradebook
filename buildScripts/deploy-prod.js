import { execSync } from "node:child_process";
import fs from "node:fs";

// Refuse to deploy if there are uncommitted changes
try {
    execSync("git diff --quiet", { stdio: "ignore" });        // working tree
    execSync("git diff --cached --quiet", { stdio: "ignore" }); // staged
} catch {
    console.error("[CG] Refusing to deploy: you have uncommitted changes.");
    console.error("[CG] Commit/stash your changes and try again.");
    process.exit(1);
}


const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url)));
const tag = `v${pkg.version}`;

try {
    execSync(`gh release create ${tag} --title ${tag} --notes "Production release ${tag}"`, { stdio: "ignore" });
} catch {}
execSync(`gh release upload ${tag} dist/prod/customGradebookInit.js --clobber`, { stdio: "inherit" });

console.log(`[CG] Uploaded prod build to release ${tag}`);
