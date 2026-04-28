// Copy non-TS assets into dist/ after `tsc` runs.
// Currently: config-page.html (served by config-server.ts).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const ASSETS = [
  { from: "src/config-page.html", to: "dist/config-page.html" },
];

for (const { from, to } of ASSETS) {
  const src = resolve(root, from);
  const dst = resolve(root, to);
  if (!existsSync(src)) {
    console.warn(`[copy-static] missing source: ${from}`);
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log(`[copy-static] ${from} → ${to}`);
}
