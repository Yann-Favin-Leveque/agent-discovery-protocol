#!/usr/bin/env tsx
/**
 * import-capability-details.ts
 *
 * Reads capability detail JSONs from disk and uploads them to the registry
 * via the PATCH /api/admin/services/import endpoint.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/import-capability-details.ts \
 *     --manifests ./manifests/ \
 *     --registry https://agent-dns.dev \
 *     --admin-secret <secret>
 *     [--delay 300]
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

  console.log(`Scanning ${manifestsDir} for capability details...`);
  if (opts.dryRun) {
    console.log("DRY RUN — counting only, not submitting\n");
  }

  const results: Result[] = [];
  let totalCaps = 0;

  for (const folderName of entries) {
    if (folderName.startsWith("_")) continue;

    const capDir = join(manifestsDir, folderName, "capabilities");
    try {
      await stat(capDir);
    } catch {
      continue; // No capabilities directory
    }

    // Resolve the real domain from the manifest's base_url (folder name may differ)
    let domain = folderName;
    try {
      const manifestRaw = await readFile(join(manifestsDir, folderName, "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw);
      if (manifest.base_url) {
        domain = new URL(manifest.base_url).hostname;
      }
    } catch {
      // Fall back to folder name
    }

    const capFiles = await readdir(capDir);
    const details: Record<string, unknown> = {};

    for (const file of capFiles) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(capDir, file), "utf-8");
        const detail = JSON.parse(raw);
        if (detail.name) {
          details[detail.name] = detail;
        }
      } catch {
        // Skip invalid JSON files
      }
    }

    const capCount = Object.keys(details).length;
    if (capCount === 0) continue;

    totalCaps += capCount;

    if (opts.dryRun) {
      console.log(`[DRY]  ${domain} — ${capCount} capabilities`);
      results.push({ domain, capabilities: capCount, success: true });
      continue;
    }

    // PATCH to registry
    try {
      let url = `${opts.registry}/api/admin/services/import`;
      let res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.adminSecret}`,
        },
        body: JSON.stringify({ domain, capability_details: details }),
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });

      // Handle redirects
      if (res.status === 307 || res.status === 308) {
        const location = res.headers.get("location");
        if (location) {
          url = location.startsWith("http") ? location : new URL(location, url).toString();
          res = await fetch(url, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${opts.adminSecret}`,
            },
            body: JSON.stringify({ domain, capability_details: details }),
            signal: AbortSignal.timeout(15_000),
          });
        }
      }

      const body = await res.json() as Record<string, unknown>;

      if (res.ok && body.success) {
        const data = body.data as Record<string, unknown>;
        console.log(`[OK]   ${domain} — ${data.capabilities_updated} capabilities updated`);
        results.push({ domain, capabilities: capCount, success: true });
      } else {
        console.log(`[FAIL] ${domain} — ${body.error || `HTTP ${res.status}`}`);
        results.push({ domain, capabilities: capCount, success: false, error: String(body.error) });
      }

      await sleep(delayMs);
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`[FAIL] ${domain} — ${msg}`);
      results.push({ domain, capabilities: capCount, success: false, error: msg });
    }
  }

  // Report
  const ok = results.filter((r) => r.success);
  const fail = results.filter((r) => !r.success);

  console.log("\n" + "=".repeat(60));
  console.log("CAPABILITY DETAIL IMPORT COMPLETE");
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
