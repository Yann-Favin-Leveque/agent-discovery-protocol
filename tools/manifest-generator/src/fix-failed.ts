#!/usr/bin/env tsx
/**
 * fix-failed.ts
 *
 * Fixes the 69 manifests that failed validation (HTTP 422) during reimport.
 * Issues:
 *   1. Absolute detail_url pointing to agent-dns.dev → convert to relative paths
 *   2. camelCase capability names → convert to snake_case
 *   3. Invalid auth types (http_basic) → convert to api_key
 *   4. Missing OAuth2 fields → add placeholders or switch to api_key
 *   5. Template variables in base_url → replace with concrete URL
 *
 * Also fixes capability detail JSON files to match renamed capabilities.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/fix-failed.ts --manifests ./tools/manifest-generator/manifests/
 *   npx tsx tools/manifest-generator/src/fix-failed.ts --manifests ./tools/manifest-generator/manifests/ --dry-run
 */

import { program } from "commander";
import { readFile, writeFile, readdir, stat, rename } from "fs/promises";
import { join, resolve } from "path";

program
  .requiredOption("--manifests <dir>", "Manifests directory")
  .option("--dry-run", "Show what would change without writing", false)
  .parse();

const opts = program.opts<{ manifests: string; dryRun: boolean }>();

// The 69 failed domains
const FAILED_DOMAINS = [
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

/** Convert camelCase to snake_case */
function toSnakeCase(name: string): string {
  // Insert underscore before uppercase letters, then lowercase everything
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    // Clean up double underscores
    .replace(/__+/g, "_")
    // Remove leading/trailing underscores
    .replace(/^_|_$/g, "");
}

/** Check if name passes the validator regex */
function isValidSnakeCase(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/** Fix template variables in base_url */
function fixBaseUrl(baseUrl: string, folderName: string): string {
  // Common template patterns and their fixes
  const fixes: Record<string, string> = {
    "https://{dc}.api.mailchimp.com": "https://us1.api.mailchimp.com",
    "https://{store_name}.myshopify.com": "https://store.myshopify.com",
    "https://{your-fusionauth-host}": "https://fusionauth.example.com",
    "https://{instance}.salesforce.com": "https://login.salesforce.com",
    "https://{store_domain}": "https://store.myshopify.com",
  };

  // Check exact matches first
  if (fixes[baseUrl]) return fixes[baseUrl];

  // Check if URL contains template variables
  if (baseUrl.includes("{") && baseUrl.includes("}")) {
    // Replace template vars with reasonable defaults
    return baseUrl
      .replace(/\{dc\}/g, "us1")
      .replace(/\{store_name\}/g, "store")
      .replace(/\{instance\}/g, "login")
      .replace(/\{store_domain\}/g, "store.myshopify.com")
      .replace(/\{[^}]+\}/g, "example");
  }

  return baseUrl;
}

interface FixReport {
  folder: string;
  fixes: string[];
  capRenames: Map<string, string>; // old name -> new name
}

async function fixManifest(manifestsDir: string, folderName: string, dryRun: boolean): Promise<FixReport | null> {
  const manifestPath = join(manifestsDir, folderName, "manifest.json");
  const report: FixReport = { folder: folderName, fixes: [], capRenames: new Map() };

  try {
    await stat(manifestPath);
  } catch {
    return null;
  }

  let manifest: Record<string, unknown>;
  try {
    const raw = await readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw);
  } catch {
    report.fixes.push("SKIP: invalid manifest.json");
    return report;
  }

  let changed = false;

  // Fix 1: base_url with template variables
  if (typeof manifest.base_url === "string" && manifest.base_url.includes("{")) {
    const oldUrl = manifest.base_url;
    manifest.base_url = fixBaseUrl(manifest.base_url, folderName);
    if (manifest.base_url !== oldUrl) {
      report.fixes.push(`base_url: "${oldUrl}" → "${manifest.base_url}"`);
      changed = true;
    }
  }

  // Fix 2: auth issues
  if (manifest.auth && typeof manifest.auth === "object") {
    const auth = manifest.auth as Record<string, unknown>;

    // Fix invalid auth types
    if (auth.type === "http_basic" || auth.type === "basic") {
      auth.type = "api_key";
      auth.header = auth.header || "Authorization";
      auth.prefix = "Basic";
      report.fixes.push(`auth.type: "${auth.type}" → "api_key" (with Basic prefix)`);
      changed = true;
    }

    // Fix OAuth2 missing required fields
    if (auth.type === "oauth2") {
      if (!auth.authorization_url || typeof auth.authorization_url !== "string") {
        // Switch to api_key if we don't have OAuth URLs
        auth.type = "api_key";
        auth.header = "Authorization";
        auth.prefix = "Bearer";
        delete auth.authorization_url;
        delete auth.token_url;
        delete auth.scopes;
        report.fixes.push("auth: oauth2 missing URLs → switched to api_key with Bearer");
        changed = true;
      }
    }

    // Fix api_key missing header
    if (auth.type === "api_key" && !auth.header) {
      auth.header = "Authorization";
      report.fixes.push('auth: added missing header "Authorization"');
      changed = true;
    }
  }

  // Fix 3: capabilities - detail_url and names
  if (Array.isArray(manifest.capabilities)) {
    for (const cap of manifest.capabilities as Array<Record<string, unknown>>) {
      // Fix absolute detail_url → relative
      if (typeof cap.detail_url === "string" && !cap.detail_url.startsWith("/")) {
        const name = cap.name || "unknown";
        cap.detail_url = `/.well-known/agent/capabilities/${name}`;
        report.fixes.push(`detail_url: absolute → relative for "${name}"`);
        changed = true;
      }

      // Fix camelCase names → snake_case
      if (typeof cap.name === "string" && !isValidSnakeCase(cap.name)) {
        const oldName = cap.name;
        const newName = toSnakeCase(cap.name);
        if (isValidSnakeCase(newName) && newName !== oldName) {
          report.capRenames.set(oldName, newName);
          cap.name = newName;
          // Also update detail_url to match new name
          cap.detail_url = `/.well-known/agent/capabilities/${newName}`;
          report.fixes.push(`name: "${oldName}" → "${newName}"`);
          changed = true;
        } else {
          report.fixes.push(`WARNING: could not fix name "${oldName}" → "${newName}"`);
        }
      }
    }
  }

  if (!changed) {
    return report;
  }

  if (!dryRun) {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  }

  // Fix capability detail files (rename + update content)
  const capDir = join(manifestsDir, folderName, "capabilities");
  try {
    await stat(capDir);
  } catch {
    return report;
  }

  // Fix all capability detail files (even those without renames need detail_url fixes)
  try {
    const capFiles = await readdir(capDir);
    for (const file of capFiles) {
      if (!file.endsWith(".json")) continue;

      const filePath = join(capDir, file);
      try {
        const raw = await readFile(filePath, "utf-8");
        const detail = JSON.parse(raw);
        let detailChanged = false;

        // Check if this capability was renamed
        if (detail.name && report.capRenames.has(detail.name)) {
          const oldName = detail.name;
          const newName = report.capRenames.get(oldName)!;
          detail.name = newName;
          detailChanged = true;

          // Rename the file too
          const newFilePath = join(capDir, `${newName}.json`);
          if (!dryRun) {
            await writeFile(newFilePath, JSON.stringify(detail, null, 2) + "\n", "utf-8");
            // Only remove old file if names are different (avoid deleting if same path)
            if (filePath !== newFilePath) {
              try {
                const { unlink } = await import("fs/promises");
                await unlink(filePath);
              } catch { /* ignore */ }
            }
          }
          report.fixes.push(`capability file: ${file} → ${newName}.json`);
        } else if (detailChanged && !dryRun) {
          await writeFile(filePath, JSON.stringify(detail, null, 2) + "\n", "utf-8");
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // No capabilities dir
  }

  return report;
}

async function main() {
  const manifestsDir = resolve(opts.manifests);
  console.log(`Fixing ${FAILED_DOMAINS.length} failed manifests in ${manifestsDir}...`);
  if (opts.dryRun) console.log("DRY RUN — showing changes without writing\n");

  let fixedCount = 0;
  let skipCount = 0;

  // Find folder names — they may not match domain names exactly
  const allFolders = await readdir(manifestsDir);

  for (const domain of FAILED_DOMAINS) {
    // Try exact match first, then variations
    let folderName = allFolders.find(f => f === domain);
    if (!folderName) {
      // Try without special suffixes
      folderName = allFolders.find(f => domain.startsWith(f) || f.startsWith(domain.replace(/_/g, "")));
    }
    if (!folderName) {
      // Last resort: folder might have the domain with _ replaced
      folderName = domain;
    }

    const report = await fixManifest(manifestsDir, folderName, opts.dryRun);
    if (!report) {
      console.log(`[SKIP] ${domain} — folder not found`);
      skipCount++;
      continue;
    }

    if (report.fixes.length === 0) {
      console.log(`[OK]   ${domain} — no fixes needed`);
      skipCount++;
    } else {
      console.log(`[FIX]  ${domain} — ${report.fixes.length} fixes:`);
      for (const fix of report.fixes) {
        console.log(`         ${fix}`);
      }
      fixedCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Fixed: ${fixedCount}  Skipped: ${skipCount}  Total: ${FAILED_DOMAINS.length}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
