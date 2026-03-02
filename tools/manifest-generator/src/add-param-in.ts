/**
 * Script to add "in" field to all capability parameters across all manifests.
 *
 * Logic:
 * - If param name matches {paramName} in the endpoint → "path"
 * - If "in" is already set → keep it
 * - If method is GET/HEAD/DELETE → remaining params are "query"
 * - If method is POST/PUT/PATCH → remaining params are "body"
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFESTS_DIR = path.resolve(__dirname, "../manifests");

interface CapParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  example: unknown;
  in?: "path" | "query" | "body" | "header";
}

interface CapabilityDetail {
  name: string;
  endpoint: string;
  method: string;
  parameters: CapParam[];
  [key: string]: unknown;
}

let totalFiles = 0;
let modifiedFiles = 0;
let totalParams = 0;
let addedIn = 0;
let alreadyHadIn = 0;

function processCapabilityFile(filePath: string): void {
  const raw = fs.readFileSync(filePath, "utf-8");
  let cap: CapabilityDetail;
  try {
    cap = JSON.parse(raw);
  } catch {
    console.error(`  SKIP (invalid JSON): ${filePath}`);
    return;
  }

  if (!cap.parameters || !Array.isArray(cap.parameters) || cap.parameters.length === 0) {
    return;
  }

  totalFiles++;

  // Extract path param names from {paramName} in endpoint
  const pathParamNames = new Set<string>();
  const endpoint = cap.endpoint ?? "";
  for (const match of endpoint.matchAll(/\{(\w+)\}/g)) {
    pathParamNames.add(match[1]);
  }

  const method = (cap.method ?? "GET").toUpperCase();
  const isBodyMethod = ["POST", "PUT", "PATCH"].includes(method);
  let modified = false;

  for (const param of cap.parameters) {
    totalParams++;

    if (param.in) {
      alreadyHadIn++;
      continue;
    }

    // Determine "in" value
    if (pathParamNames.has(param.name)) {
      param.in = "path";
    } else if (isBodyMethod) {
      param.in = "body";
    } else {
      param.in = "query";
    }

    addedIn++;
    modified = true;
  }

  if (modified) {
    modifiedFiles++;
    fs.writeFileSync(filePath, JSON.stringify(cap, null, 2) + "\n", "utf-8");
  }
}

function processService(serviceDir: string): void {
  const capsDir = path.join(serviceDir, "capabilities");
  if (!fs.existsSync(capsDir) || !fs.statSync(capsDir).isDirectory()) {
    return;
  }

  const files = fs.readdirSync(capsDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    processCapabilityFile(path.join(capsDir, file));
  }
}

// Main
const services = fs.readdirSync(MANIFESTS_DIR).filter(d => {
  const full = path.join(MANIFESTS_DIR, d);
  return fs.statSync(full).isDirectory();
});

console.log(`Processing ${services.length} services...`);

for (const service of services) {
  processService(path.join(MANIFESTS_DIR, service));
}

console.log(`\nDone!`);
console.log(`  Services:        ${services.length}`);
console.log(`  Capability files: ${totalFiles}`);
console.log(`  Total params:     ${totalParams}`);
console.log(`  Already had "in": ${alreadyHadIn}`);
console.log(`  Added "in":       ${addedIn}`);
console.log(`  Files modified:   ${modifiedFiles}`);
