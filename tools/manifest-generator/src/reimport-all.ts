#!/usr/bin/env tsx
/**
 * reimport-all.ts
 *
 * Reads regenerated manifests from disk and fully replaces all capabilities
 * in the registry via PUT /api/admin/services/import.
 *
 * This is used after regenerating manifests (1 capability = 1 REST operation)
 * to update the production database with the new capability set.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/reimport-all.ts \
 *     --manifests ./manifests/ \
 *     --registry https://agent-dns.dev \
 *     --admin-secret <secret> \
 *     [--delay 300] \
 *     [--dry-run]
 */

import { program } from "commander";
import { readFile, readdir, stat } from "fs/promises";
import { join, resolve } from "path";

program
  .requiredOption("--manifests <dir>", "Manifests directory")
  .requiredOption("--registry <url>", "Registry URL")
  .requiredOption("--admin-secret <secret>", "Admin secret for auth")
  .option("--delay <ms>", "Delay between requests in ms", "300")
  .option("--dry-run", "Validate but don't submit", false)
  .parse();

const opts = program.opts<{
  manifests: string;
  registry: string;
  adminSecret: string;
  delay: string;
  dryRun: boolean;
}>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Result {
  domain: string;
  capabilities: number;
  success: boolean;
  error?: string;
}

async function main() {
  const manifestsDir = resolve(opts.manifests);
  const entries = await readdir(manifestsDir);
  const delayMs = parseInt(opts.delay, 10) || 300;

  console.log(`Scanning ${manifestsDir} for manifests to reimport...`);
  if (opts.dryRun) {
    console.log("DRY RUN — counting only, not submitting\n");
  }

  const results: Result[] = [];
  let totalCaps = 0;

  for (const folderName of entries) {
    if (folderName.startsWith("_")) continue;

    const manifestPath = join(manifestsDir, folderName, "manifest.json");
    try {
      await stat(manifestPath);
    } catch {
      continue; // No manifest.json
    }

    // Read manifest
    let manifest: Record<string, unknown>;
    try {
      const raw = await readFile(manifestPath, "utf-8");
      manifest = JSON.parse(raw);
    } catch {
      console.log(`[SKIP] ${folderName} — invalid manifest.json`);
      continue;
    }

    // Read capability details
    const capDir = join(manifestsDir, folderName, "capabilities");
    const capabilityDetails: Record<string, unknown> = {};
    try {
      const capFiles = await readdir(capDir);
      for (const file of capFiles) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(capDir, file), "utf-8");
          const detail = JSON.parse(raw);
          if (detail.name) {
            capabilityDetails[detail.name] = detail;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    } catch {
      // No capabilities directory
    }

    const capCount = Object.keys(capabilityDetails).length;
    totalCaps += capCount;

    if (opts.dryRun) {
      const domain = manifest.base_url ? new URL(manifest.base_url as string).hostname : folderName;
      console.log(`[DRY]  ${domain} — ${capCount} capabilities`);
      results.push({ domain, capabilities: capCount, success: true });
      continue;
    }

    // PUT to registry (full replacement)
    try {
      let url = `${opts.registry}/api/admin/services/import`;
      const body = JSON.stringify({
        manifest,
        capability_details: capabilityDetails,
        trust_level: "community",
      });

      let res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.adminSecret}`,
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });

      // Handle redirects
      if (res.status === 307 || res.status === 308) {
        const location = res.headers.get("location");
        if (location) {
          url = location.startsWith("http") ? location : new URL(location, url).toString();
          res = await fetch(url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${opts.adminSecret}`,
            },
            body,
            signal: AbortSignal.timeout(30_000),
          });
        }
      }

      const resBody = await res.json() as Record<string, unknown>;
      const domain = (resBody.domain as string) || folderName;

      if (res.ok && resBody.success) {
        console.log(`[OK]   ${domain} — ${resBody.capabilities_count || capCount} capabilities`);
        results.push({ domain, capabilities: capCount, success: true });
      } else {
        console.log(`[FAIL] ${domain} — ${resBody.error || `HTTP ${res.status}`}`);
        results.push({ domain, capabilities: capCount, success: false, error: String(resBody.error) });
      }

      await sleep(delayMs);
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`[FAIL] ${folderName} — ${msg}`);
      results.push({ domain: folderName, capabilities: capCount, success: false, error: msg });
    }
  }

  // Report
  const ok = results.filter((r) => r.success);
  const fail = results.filter((r) => !r.success);

  console.log("\n" + "=".repeat(60));
  console.log("FULL REIMPORT COMPLETE");
  console.log(`  Services processed: ${results.length}`);
  console.log(`  Total capabilities: ${totalCaps}`);
  console.log(`  Success:            ${ok.length}`);
  console.log(`  Failed:             ${fail.length}`);
  if (fail.length > 0) {
    console.log("  Failed domains:");
    for (const f of fail) {
      console.log(`    - ${f.domain}: ${f.error}`);
    }
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
