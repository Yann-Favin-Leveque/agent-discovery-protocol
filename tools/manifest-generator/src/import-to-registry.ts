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
import type { Manifest } from "./types.js";
import { validateManifest, writeJson, log } from "./utils.js";

// ---- Entry point (CLI) ----

program
  .requiredOption("--manifests <dir>", "Directory containing generated manifests")
  .requiredOption("--registry <url>", "Registry base URL (e.g. http://localhost:3000)")
  .option("--tag <tag>", "Tag for imported services", "community")
  .option("--dry-run", "Validate but don't submit", false)
  .option("--delay <ms>", "Delay between requests in ms", "500")
  .option("--retry-429", "Retry on rate limit with exponential backoff", false)
  .parse();

const opts = program.opts<{
  manifests: string;
  registry: string;
  tag: string;
  dryRun: boolean;
  delay: string;
  retry429: boolean;
}>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Main ----

interface ImportResult {
  domain: string;
  success: boolean;
  error?: string;
  status?: string;
}

async function main() {
  const manifestsDir = resolve(opts.manifests);
  log.info(`Scanning ${manifestsDir} for manifests...`);

  // Find all manifest.json files
  const entries = await readdir(manifestsDir);
  const domains: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith("_")) continue;
    const entryPath = join(manifestsDir, entry);
    const entryStat = await stat(entryPath);
    if (entryStat.isDirectory()) {
      try {
        await stat(join(entryPath, "manifest.json"));
        domains.push(entry);
      } catch {
        // No manifest.json, skip
      }
    }
  }

  log.info(`Found ${domains.length} manifests to import`);

  if (opts.dryRun) {
    log.info("DRY RUN — validating only, not submitting to registry");
  }

  const results: ImportResult[] = [];

  const delayMs = parseInt(opts.delay, 10) || 500;

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const manifestPath = join(manifestsDir, domain, "manifest.json");
    let result = await importManifest(domain, manifestPath);

    // Retry on rate limit with exponential backoff
    if (opts.retry429 && !result.success && result.error?.includes("429")) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const backoff = delayMs * Math.pow(2, attempt);
        log.warn(`Rate limited on ${domain}, retrying in ${backoff}ms (attempt ${attempt}/3)...`);
        await sleep(backoff);
        result = await importManifest(domain, manifestPath);
        if (result.success || !result.error?.includes("429")) break;
      }
    }

    results.push(result);

    const icon = result.success ? "[OK]   " : "[FAIL] ";
    const detail = result.success ? (result.status || "imported") : result.error;
    console.log(`${icon} ${domain} — ${detail}`);

    // Throttle between requests
    if (i < domains.length - 1 && !opts.dryRun) {
      await sleep(delayMs);
    }
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

async function importManifest(domain: string, manifestPath: string): Promise<ImportResult> {
  try {
    const raw = await readFile(manifestPath, "utf-8");
    const manifest: Manifest = JSON.parse(raw);

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

    // Submit to registry (follow redirects manually for POST)
    const payload = JSON.stringify({ manifest });
    let url = `${opts.registry}/api/services`;
    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    // Handle 307/308 redirects (re-POST to new location)
    if (res.status === 307 || res.status === 308) {
      const location = res.headers.get("location");
      if (location) {
        url = location.startsWith("http") ? location : new URL(location, url).toString();
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(15_000),
        });
      }
    }

    const body = await res.json() as Record<string, unknown>;

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
  } catch (err) {
    return {
      domain,
      success: false,
      error: (err as Error).message,
    };
  }
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
