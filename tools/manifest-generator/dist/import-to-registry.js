#!/usr/bin/env tsx
/**
 * import-to-registry.ts
 *
 * Imports generated manifests into the registry via its API.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/import-to-registry.ts \
 *     --manifests ./manifests/ \
 *     --registry http://localhost:3000 \
 *     --tag community
 */
import { program } from "commander";
import { readFile, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { validateManifest, writeJson, log } from "./utils.js";
// ---- Entry point (CLI) ----
program
    .requiredOption("--manifests <dir>", "Directory containing generated manifests")
    .requiredOption("--registry <url>", "Registry base URL (e.g. http://localhost:3000)")
    .option("--tag <tag>", "Tag for imported services", "community")
    .option("--dry-run", "Validate but don't submit", false)
    .parse();
const opts = program.opts();
async function main() {
    const manifestsDir = resolve(opts.manifests);
    log.info(`Scanning ${manifestsDir} for manifests...`);
    // Find all manifest.json files
    const entries = await readdir(manifestsDir);
    const domains = [];
    for (const entry of entries) {
        if (entry.startsWith("_"))
            continue;
        const entryPath = join(manifestsDir, entry);
        const entryStat = await stat(entryPath);
        if (entryStat.isDirectory()) {
            try {
                await stat(join(entryPath, "manifest.json"));
                domains.push(entry);
            }
            catch {
                // No manifest.json, skip
            }
        }
    }
    log.info(`Found ${domains.length} manifests to import`);
    if (opts.dryRun) {
        log.info("DRY RUN — validating only, not submitting to registry");
    }
    const results = [];
    for (const domain of domains) {
        const manifestPath = join(manifestsDir, domain, "manifest.json");
        const result = await importManifest(domain, manifestPath);
        results.push(result);
        const icon = result.success ? "[OK]   " : "[FAIL] ";
        const detail = result.success ? (result.status || "imported") : result.error;
        console.log(`${icon} ${domain} — ${detail}`);
    }
    // Report
    const imported = results.filter((r) => r.success && r.status !== "skipped");
    const skipped = results.filter((r) => r.status === "skipped");
    const failed = results.filter((r) => !r.success);
    const report = {
        timestamp: new Date().toISOString(),
        registry: opts.registry,
        tag: opts.tag,
        dryRun: opts.dryRun,
        importedCount: imported.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        results,
    };
    const reportPath = join(manifestsDir, "_import-report.json");
    await writeJson(reportPath, report);
    console.log("\n" + "=".repeat(60));
    console.log("IMPORT COMPLETE");
    console.log(`  Imported:       ${imported.length}`);
    console.log(`  Skipped (dup):  ${skipped.length}`);
    console.log(`  Failed:         ${failed.length}`);
    console.log(`  Report:         ${reportPath}`);
    console.log("=".repeat(60));
}
async function importManifest(domain, manifestPath) {
    try {
        const raw = await readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(raw);
        // Validate
        const validation = validateManifest(manifest);
        if (!validation.valid) {
            return {
                domain,
                success: false,
                error: `Validation: ${validation.errors.slice(0, 3).join("; ")}`,
            };
        }
        if (opts.dryRun) {
            return { domain, success: true, status: "valid (dry run)" };
        }
        // Submit to registry
        const res = await fetch(`${opts.registry}/api/services`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ manifest }),
            signal: AbortSignal.timeout(15_000),
        });
        const body = await res.json();
        if (res.status === 201 || res.status === 200) {
            return { domain, success: true, status: "imported" };
        }
        if (res.status === 409) {
            return { domain, success: true, status: "skipped" };
        }
        return {
            domain,
            success: false,
            error: `HTTP ${res.status}: ${body.error || "Unknown error"}`,
        };
    }
    catch (err) {
        return {
            domain,
            success: false,
            error: err.message,
        };
    }
}
main().catch((err) => {
    log.error(`Fatal: ${err.message}`);
    process.exit(1);
});
