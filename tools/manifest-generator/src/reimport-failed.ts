#!/usr/bin/env tsx
/**
 * reimport-failed.ts
 *
 * Reimports only the 69 previously failed services after fix-failed.ts has patched them.
 * Same logic as reimport-all.ts but filtered to the known failed domains.
 */

import { program } from "commander";
import { readFile, readdir, stat } from "fs/promises";
import { join, resolve } from "path";

program
  .requiredOption("--manifests <dir>", "Manifests directory")
  .requiredOption("--registry <url>", "Registry URL")
  .requiredOption("--admin-secret <secret>", "Admin secret for auth")
  .option("--delay <ms>", "Delay between requests in ms", "200")
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

const FAILED_FOLDERS = [
  "api-ssl.bitly.com", "api.1password.com", "api.algolia.com", "api.auth0.com",
  "api.bamboohr.com", "api.braintreegateway.com", "api.chartmogul.com",
  "api.chatwoot.com", "api.clearbit.com", "api.cloudflare.com_dns",
  "api.coinbase.com", "api.coursera.org", "api.crisp.chat", "api.cronofy.com",
  "api.dub.co", "api.fauna.com", "api.firebase.google.com_auth",
  "api.freshbooks.com", "api.freshdesk.com", "api.front.com",
  "api.fullstory.com", "api.gusto.com", "api.heap.io", "api.hellosign.com",
  "api.helpscout.net", "api.hotjar.com", "api.hubspot.com_marketing",
  "api.ipgeolocation.io", "api.knock.app", "api.mailchimp.com",
  "api.mapbox.com", "api.meilisearch.com", "api.mercury.com",
  "api.mindee.com", "api.moodle.com", "api.namecheap.com", "api.netlify.com",
  "api.opencagedata.com", "api.openrouteservice.org", "api.paypal.com",
  "api.pendo.io", "api.postmarkapp.com", "api.quickbooks.com",
  "api.sanity.io", "api.smartlook.com", "api.sparkpost.com",
  "api.square.com", "api.storyblok.com", "api.stripe.com",
  "api.supabase.io", "api.supabase.io_auth", "api.tawk.to",
  "api.telegram.org", "api.twilio.com", "api.typesense.org",
  "api.udemy.com", "api.vercel.com", "api.wave.com", "api.youtube.com",
  "api.zendesk.com", "api.zoom.us", "app.loops.so", "cdn.contentful.com",
  "customsearch.googleapis.com", "docs.googleapis.com",
  "gmail.googleapis.com", "graph.facebook.com_messenger",
  "maps.googleapis.com", "slack.com_api",
];

interface Result {
  domain: string;
  capabilities: number;
  success: boolean;
  error?: string;
}

async function main() {
  const manifestsDir = resolve(opts.manifests);
  const delayMs = parseInt(opts.delay, 10) || 200;

  console.log(`Reimporting ${FAILED_FOLDERS.length} previously failed services...`);
  if (opts.dryRun) console.log("DRY RUN — not submitting\n");

  const results: Result[] = [];
  let totalCaps = 0;

  for (const folderName of FAILED_FOLDERS) {
    const manifestPath = join(manifestsDir, folderName, "manifest.json");
    try {
      await stat(manifestPath);
    } catch {
      console.log(`[SKIP] ${folderName} — no manifest.json`);
      continue;
    }

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
        } catch { /* skip */ }
      }
    } catch { /* no capabilities dir */ }

    const capCount = Object.keys(capabilityDetails).length;
    totalCaps += capCount;

    if (opts.dryRun) {
      console.log(`[DRY]  ${folderName} — ${capCount} capabilities`);
      results.push({ domain: folderName, capabilities: capCount, success: true });
      continue;
    }

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
        const errMsg = resBody.errors
          ? JSON.stringify(resBody.errors)
          : (resBody.error || `HTTP ${res.status}`);
        console.log(`[FAIL] ${domain} — ${errMsg}`);
        results.push({ domain, capabilities: capCount, success: false, error: String(errMsg) });
      }

      await sleep(delayMs);
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`[FAIL] ${folderName} — ${msg}`);
      results.push({ domain: folderName, capabilities: capCount, success: false, error: msg });
    }
  }

  const ok = results.filter((r) => r.success);
  const fail = results.filter((r) => !r.success);

  console.log(`\n${"=".repeat(60)}`);
  console.log("REIMPORT OF FIXED SERVICES COMPLETE");
  console.log(`  Services processed: ${results.length}`);
  console.log(`  Total capabilities: ${totalCaps}`);
  console.log(`  Success:            ${ok.length}`);
  console.log(`  Failed:             ${fail.length}`);
  if (fail.length > 0) {
    console.log("  Still failing:");
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
