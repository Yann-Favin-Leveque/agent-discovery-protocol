#!/usr/bin/env tsx
/**
 * batch-generate.ts
 *
 * Batch runner that processes the API catalog and generates manifests
 * for all listed APIs.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/batch-generate.ts \
 *     --catalog catalog.yaml \
 *     --output ./manifests/ \
 *     --concurrency 5 \
 *     --skip-existing
 */
import { program } from "commander";
import { readFile, access } from "fs/promises";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import pLimit from "p-limit";
import { convertOpenAPI } from "./convert-openapi.js";
import { scrapeDocs } from "./scrape-docs.js";
import { writeJson, log } from "./utils.js";
// ---- Entry point (CLI) ----
program
    .requiredOption("--catalog <path>", "Path to catalog.yaml")
    .requiredOption("--output <dir>", "Output directory for manifests")
    .option("--concurrency <n>", "Max concurrent operations", "5")
    .option("--skip-existing", "Skip APIs that already have manifests", false)
    .option("--category <cat>", "Only process APIs in this category")
    .option("--rewrite", "Use Claude API to rewrite descriptions", false)
    .parse();
const opts = program.opts();
async function main() {
    // Load catalog
    const catalogPath = resolve(opts.catalog);
    log.info(`Loading catalog from ${catalogPath}...`);
    const catalogRaw = await readFile(catalogPath, "utf-8");
    const catalog = parseYaml(catalogRaw);
    if (!catalog.apis || !Array.isArray(catalog.apis)) {
        log.error("Invalid catalog: missing 'apis' array");
        process.exit(1);
    }
    // Filter by category if specified
    let apis = catalog.apis;
    if (opts.category) {
        apis = apis.filter((a) => a.category === opts.category);
        log.info(`Filtered to ${apis.length} APIs in category "${opts.category}"`);
    }
    log.info(`Processing ${apis.length} APIs with concurrency ${opts.concurrency}...`);
    const limit = pLimit(parseInt(opts.concurrency, 10));
    const results = [];
    const tasks = apis.map((api) => limit(async () => {
        const result = await processApi(api);
        results.push(result);
        const statusIcon = result.success ? "[OK]   " : "[FAIL] ";
        const detail = result.success
            ? `${result.capabilityCount} capabilities`
            : result.error;
        console.log(`${statusIcon} ${api.domain} (${result.source}) — ${detail}`);
    }));
    await Promise.all(tasks);
    // Generate report
    const report = generateReport(results);
    const reportPath = join(resolve(opts.output), "_report.json");
    await writeJson(reportPath, report);
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log(`BATCH COMPLETE`);
    console.log(`  Total:   ${results.length}`);
    console.log(`  Success: ${report.successCount}`);
    console.log(`  Failed:  ${report.failureCount}`);
    console.log(`  Skipped: ${report.skippedCount}`);
    console.log(`  Report:  ${reportPath}`);
    console.log("=".repeat(60));
}
async function processApi(api) {
    const outputDir = join(resolve(opts.output), api.domain.replace(/\//g, "_"));
    // Skip existing if flag is set
    if (opts.skipExisting) {
        try {
            await access(join(outputDir, "manifest.json"));
            return {
                domain: api.domain,
                success: true,
                capabilityCount: -1,
                source: api.openapi ? "openapi" : "docs",
                error: "skipped (already exists)",
            };
        }
        catch {
            // File doesn't exist, proceed
        }
    }
    try {
        // Determine which converter to use
        if (api.openapi) {
            const source = api.type === "google-discovery" ? "google-discovery" : "openapi";
            const result = await convertOpenAPI(api.openapi, outputDir, api.domain, opts.rewrite);
            return {
                domain: api.domain,
                success: result.success,
                capabilityCount: result.capabilityCount,
                source,
                error: result.errors.length > 0 ? result.errors[0] : undefined,
            };
        }
        if (api.docs) {
            const result = await scrapeDocs(api.docs, api.domain, outputDir);
            return {
                domain: api.domain,
                success: result.success,
                capabilityCount: result.capabilityCount,
                source: "docs",
                error: result.errors.length > 0 ? result.errors[0] : undefined,
            };
        }
        return {
            domain: api.domain,
            success: false,
            capabilityCount: 0,
            source: "openapi",
            error: "No openapi or docs URL provided",
        };
    }
    catch (err) {
        return {
            domain: api.domain,
            success: false,
            capabilityCount: 0,
            source: api.openapi ? "openapi" : "docs",
            error: err.message,
        };
    }
}
function generateReport(results) {
    const skipped = results.filter((r) => r.error === "skipped (already exists)");
    const successes = results.filter((r) => r.success && r.error !== "skipped (already exists)");
    const failures = results.filter((r) => !r.success);
    return {
        timestamp: new Date().toISOString(),
        totalCount: results.length,
        successCount: successes.length,
        failureCount: failures.length,
        skippedCount: skipped.length,
        results,
        failures,
    };
}
main().catch((err) => {
    log.error(`Fatal: ${err.message}`);
    process.exit(1);
});
