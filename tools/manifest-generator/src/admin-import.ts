#!/usr/bin/env tsx
/**
 * admin-import.ts
 *
 * Imports manifests via the admin API (bypasses blocklist + rate limits).
 * Also bulk-updates existing "unverified" services to "community".
 *
 * Usage:
 *   ADMIN_SECRET=xxx npx tsx src/admin-import.ts \
 *     --manifests ./manifests/ \
 *     --registry https://agent-dns.dev \
 *     --trust-level community \
 *     --upgrade-existing
 */

import { program } from "commander";
import { readFile, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import type { Manifest } from "./types.js";
import { validateManifest, writeJson, log } from "./utils.js";

program
  .requiredOption("--manifests <dir>", "Directory containing generated manifests")
  .requiredOption("--registry <url>", "Registry base URL")
  .requiredOption("--admin-secret <secret>", "Admin secret (or set ADMIN_SECRET env var)")
  .option("--trust-level <level>", "Trust level for imports", "community")
  .option("--upgrade-existing", "Also upgrade existing unverified services to the trust level", false)
  .option("--delay <ms>", "Delay between requests in ms", "200")
  .parse();

const opts = program.opts<{
  manifests: string;
  registry: string;
  adminSecret: string;
  trustLevel: string;
  upgradeExisting: boolean;
  delay: string;
}>();

const ADMIN_SECRET = opts.adminSecret || process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  log.error("ADMIN_SECRET is required. Pass --admin-secret or set ADMIN_SECRET env var.");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const authHeaders = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${ADMIN_SECRET}`,
};

/** POST with redirect handling */
async function adminPost(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  let url = `${opts.registry}${path}`;
  let res = await fetch(url, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 307 || res.status === 308) {
    const location = res.headers.get("location");
    if (location) {
      url = location.startsWith("http") ? location : new URL(location, url).toString();
      res = await fetch(url, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  const data = await res.json() as Record<string, unknown>;
  return { status: res.status, data };
}

/** PUT with redirect handling */
async function adminPut(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  let url = `${opts.registry}${path}`;
  let res = await fetch(url, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 307 || res.status === 308) {
    const location = res.headers.get("location");
    if (location) {
      url = location.startsWith("http") ? location : new URL(location, url).toString();
      res = await fetch(url, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  const data = await res.json() as Record<string, unknown>;
  return { status: res.status, data };
}

interface ImportResult {
  domain: string;
  action: "imported" | "upgraded" | "skipped" | "failed";
  detail?: string;
}

async function main() {
  const manifestsDir = resolve(opts.manifests);
  const delayMs = parseInt(opts.delay, 10) || 200;

  log.info(`Scanning ${manifestsDir} for manifests...`);

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
        // No manifest.json
      }
    }
  }

  log.info(`Found ${domains.length} manifests`);
  log.info(`Trust level: ${opts.trustLevel}`);
  log.info(`Upgrade existing: ${opts.upgradeExisting}`);

  const results: ImportResult[] = [];

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const manifestPath = join(manifestsDir, domain, "manifest.json");

    try {
      const raw = await readFile(manifestPath, "utf-8");
      const manifest: Manifest = JSON.parse(raw);

      // Validate locally first
      const validation = validateManifest(manifest);
      if (!validation.valid) {
        const r: ImportResult = { domain, action: "failed", detail: `Validation: ${validation.errors.slice(0, 2).join("; ")}` };
        results.push(r);
        console.log(`[FAIL]  ${domain} — ${r.detail}`);
        continue;
      }

      // Try admin import
      const { status, data } = await adminPost("/api/admin/services/import", {
        manifest,
        trust_level: opts.trustLevel,
      });

      if (status === 201) {
        results.push({ domain, action: "imported" });
        console.log(`[NEW]   ${domain} — imported as ${opts.trustLevel}`);
      } else if (status === 409 && opts.upgradeExisting) {
        // Already exists — upgrade trust level
        const { status: putStatus, data: putData } = await adminPut(
          `/api/admin/services/${encodeURIComponent(domain)}/trust`,
          { trust_level: opts.trustLevel }
        );

        if (putStatus === 200) {
          results.push({ domain, action: "upgraded" });
          console.log(`[UP]    ${domain} — upgraded to ${opts.trustLevel}`);
        } else {
          results.push({ domain, action: "failed", detail: `Upgrade failed: ${putData.error || putStatus}` });
          console.log(`[FAIL]  ${domain} — upgrade failed: ${putData.error || putStatus}`);
        }
      } else if (status === 409) {
        results.push({ domain, action: "skipped", detail: "already exists" });
        console.log(`[SKIP]  ${domain} — already exists`);
      } else {
        results.push({ domain, action: "failed", detail: `HTTP ${status}: ${data.error || JSON.stringify(data.errors || "Unknown")}` });
        console.log(`[FAIL]  ${domain} — HTTP ${status}: ${data.error || JSON.stringify(data.errors)}`);
      }
    } catch (err) {
      results.push({ domain, action: "failed", detail: (err as Error).message });
      console.log(`[FAIL]  ${domain} — ${(err as Error).message}`);
    }

    if (i < domains.length - 1) await sleep(delayMs);
  }

  // Summary
  const imported = results.filter((r) => r.action === "imported");
  const upgraded = results.filter((r) => r.action === "upgraded");
  const skipped = results.filter((r) => r.action === "skipped");
  const failed = results.filter((r) => r.action === "failed");

  const report = {
    timestamp: new Date().toISOString(),
    registry: opts.registry,
    trust_level: opts.trustLevel,
    upgrade_existing: opts.upgradeExisting,
    imported: imported.length,
    upgraded: upgraded.length,
    skipped: skipped.length,
    failed: failed.length,
    failures: failed.map((f) => ({ domain: f.domain, error: f.detail })),
  };

  const reportPath = join(manifestsDir, "_admin-import-report.json");
  await writeJson(reportPath, report);

  console.log("\n" + "=".repeat(60));
  console.log("ADMIN IMPORT COMPLETE");
  console.log(`  New imports:    ${imported.length}`);
  console.log(`  Upgraded:       ${upgraded.length}`);
  console.log(`  Skipped (dup):  ${skipped.length}`);
  console.log(`  Failed:         ${failed.length}`);
  console.log(`  Report:         ${reportPath}`);
  console.log("=".repeat(60));

  if (failed.length > 0) {
    console.log("\nFailed domains:");
    for (const f of failed) {
      console.log(`  ${f.domain}: ${f.detail}`);
    }
  }
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
