// buildScripts/export-all-mermaid.js
// Batch export all .mmd files in ./documents (including subfolders) to .pdf using Mermaid CLI (ESM)

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root documents folder (contains statemachine.mmd and fileStructureDiagrams/)
const docsDir = path.join(__dirname, "..", "documents");

function exportMermaidInDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Recurse into subfolder (e.g., documents/fileStructureDiagrams)
            exportMermaidInDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".mmd")) {
            const output = fullPath.replace(/\.mmd$/, ".pdf");

            console.log(`Exporting ${path.relative(docsDir, fullPath)} → ${path.relative(docsDir, output)}`);

            execSync(
                `npx mmdc -i "${fullPath}" -o "${output}"`,
                { stdio: "inherit" }
            );
        }
    }
}

console.log(`Scanning for .mmd files under: ${docsDir}`);
exportMermaidInDir(docsDir);
console.log("Done! All Mermaid diagrams exported to PDF.");