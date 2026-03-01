#!/usr/bin/env tsx
/**
 * quality-check.ts
 *
 * Validates generated manifests against quality rules and produces
 * a report with scores and issues.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/quality-check.ts \
 *     --manifests ./manifests/
 */
import { program } from "commander";
import { readFile, readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { validateManifest, writeJson, log } from "./utils.js";
// ---- Entry point (CLI) ----
program
    .requiredOption("--manifests <dir>", "Directory containing generated manifests")
    .option("--min-score <n>", "Minimum passing score (0-100)", "60")
    .parse();
const opts = program.opts();
const MIN_SCORE = parseInt(opts.minScore, 10);
// ---- Main ----
async function main() {
    const manifestsDir = resolve(opts.manifests);
    log.info(`Scanning ${manifestsDir} for manifests...`);
    const entries = await readdir(manifestsDir);
    const reports = [];
    for (const entry of entries) {
        if (entry.startsWith("_"))
            continue;
        const entryPath = join(manifestsDir, entry);
        const entryStat = await stat(entryPath);
        if (!entryStat.isDirectory())
            continue;
        try {
            await stat(join(entryPath, "manifest.json"));
        }
        catch {
            continue;
        }
        const report = await checkQuality(entry, entryPath);
        reports.push(report);
        const icon = report.pass ? "[PASS]" : "[FAIL]";
        const errorCount = report.issues.filter((i) => i.severity === "error").length;
        const warnCount = report.issues.filter((i) => i.severity === "warning").length;
        console.log(`${icon} ${entry} — score: ${report.score}/100 (${errorCount} errors, ${warnCount} warnings)`);
    }
    // Overall report
    const passing = reports.filter((r) => r.pass).length;
    const failing = reports.filter((r) => !r.pass).length;
    const avgScore = reports.length > 0
        ? Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length)
        : 0;
    const fullReport = {
        timestamp: new Date().toISOString(),
        minScore: MIN_SCORE,
        totalManifests: reports.length,
        passing,
        failing,
        averageScore: avgScore,
        needsReview: reports.filter((r) => !r.pass).map((r) => r.domain),
        reports,
    };
    const reportPath = join(manifestsDir, "_quality-report.json");
    await writeJson(reportPath, fullReport);
    console.log("\n" + "=".repeat(60));
    console.log("QUALITY CHECK COMPLETE");
    console.log(`  Total:         ${reports.length}`);
    console.log(`  Passing:       ${passing}`);
    console.log(`  Failing:       ${failing}`);
    console.log(`  Average score: ${avgScore}/100`);
    console.log(`  Report:        ${reportPath}`);
    console.log("=".repeat(60));
}
// ---- Quality check for a single manifest ----
async function checkQuality(domain, dir) {
    const issues = [];
    let maxScore = 0;
    let earnedScore = 0;
    // Load manifest
    const manifestRaw = await readFile(join(dir, "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw);
    // 1. Schema validation (20 points)
    maxScore += 20;
    const validation = validateManifest(manifest);
    if (validation.valid) {
        earnedScore += 20;
    }
    else {
        for (const err of validation.errors) {
            issues.push({ severity: "error", field: "schema", message: err });
        }
    }
    // 2. Description quality (15 points)
    maxScore += 15;
    const desc = manifest.description || "";
    if (desc.length >= 50 && desc.length <= 500) {
        earnedScore += 5;
    }
    else {
        issues.push({
            severity: "warning",
            field: "description",
            message: `Description length ${desc.length} chars — ideal is 50-500`,
        });
    }
    // Conversational tone check: should not look like raw OpenAPI jargon
    const jargonPatterns = [
        /^The .* API$/i,
        /CRUD operations/i,
        /RESTful/i,
        /HTTP methods/i,
        /JSON response/i,
        /endpoint/i,
    ];
    const jargonCount = jargonPatterns.filter((p) => p.test(desc)).length;
    if (jargonCount <= 1) {
        earnedScore += 5;
    }
    else {
        issues.push({
            severity: "warning",
            field: "description",
            message: `Description contains too much technical jargon (${jargonCount} jargon patterns detected)`,
        });
    }
    // Sentence count (2-3 ideal)
    const sentences = desc.split(/[.!?]+/).filter((s) => s.trim().length > 5);
    if (sentences.length >= 2 && sentences.length <= 4) {
        earnedScore += 5;
    }
    else {
        issues.push({
            severity: "info",
            field: "description",
            message: `Description has ${sentences.length} sentences — ideal is 2-3`,
        });
    }
    // 3. Capability count (15 points)
    maxScore += 15;
    const capCount = manifest.capabilities?.length || 0;
    if (capCount >= 3 && capCount <= 8) {
        earnedScore += 15;
    }
    else if (capCount >= 1 && capCount <= 12) {
        earnedScore += 8;
        issues.push({
            severity: "info",
            field: "capabilities",
            message: `${capCount} capabilities — ideal is 3-8`,
        });
    }
    else {
        issues.push({
            severity: "warning",
            field: "capabilities",
            message: `${capCount} capabilities — aim for 3-8 per service`,
        });
    }
    // 4. Capability descriptions (15 points)
    maxScore += 15;
    let capDescScore = 0;
    for (const cap of manifest.capabilities || []) {
        const capDesc = cap.description || "";
        if (capDesc.length >= 20 && capDesc.length <= 300) {
            capDescScore += 1;
        }
        else {
            issues.push({
                severity: "warning",
                field: `capabilities.${cap.name}.description`,
                message: `Length ${capDesc.length} — ideal 20-300 chars`,
            });
        }
        // Check it represents user intent, not raw endpoint
        if (/^(GET|POST|PUT|DELETE|PATCH)\s/i.test(capDesc)) {
            issues.push({
                severity: "warning",
                field: `capabilities.${cap.name}.description`,
                message: "Starts with HTTP method — should describe user intent",
            });
        }
        // Name should be intent-based
        if (/^(get|post|put|delete|patch)_/.test(cap.name)) {
            issues.push({
                severity: "warning",
                field: `capabilities.${cap.name}.name`,
                message: `"${cap.name}" looks like an HTTP method — use intent-based names (e.g. "send_email" not "post_messages")`,
            });
        }
    }
    if (capCount > 0) {
        earnedScore += Math.round((capDescScore / capCount) * 15);
    }
    // 5. Auth completeness (10 points)
    maxScore += 10;
    if (manifest.auth) {
        if (manifest.auth.type === "none") {
            earnedScore += 10;
        }
        else if (manifest.auth.type === "oauth2") {
            if (manifest.auth.authorization_url && manifest.auth.token_url) {
                earnedScore += 10;
            }
            else {
                earnedScore += 3;
                issues.push({
                    severity: "error",
                    field: "auth",
                    message: "OAuth2 missing authorization_url or token_url",
                });
            }
        }
        else if (manifest.auth.type === "api_key") {
            if (manifest.auth.header) {
                earnedScore += 10;
            }
            else {
                earnedScore += 3;
                issues.push({
                    severity: "error",
                    field: "auth",
                    message: "API key auth missing header field",
                });
            }
        }
    }
    else {
        issues.push({ severity: "error", field: "auth", message: "Missing auth section" });
    }
    // 6. Capability detail files (25 points)
    maxScore += 25;
    let detailScore = 0;
    const totalCaps = manifest.capabilities?.length || 0;
    for (const cap of manifest.capabilities || []) {
        const detailPath = join(dir, "capabilities", `${cap.name}.json`);
        try {
            const detailRaw = await readFile(detailPath, "utf-8");
            const detail = JSON.parse(detailRaw);
            let thisDetailScore = 0;
            // Has endpoint and method
            if (detail.endpoint && detail.method) {
                thisDetailScore += 2;
            }
            else {
                issues.push({
                    severity: "error",
                    field: `details.${cap.name}`,
                    message: "Missing endpoint or method",
                });
            }
            // Has parameters with descriptions
            if (detail.parameters && detail.parameters.length > 0) {
                const described = detail.parameters.filter((p) => p.description && p.description.length > 5);
                if (described.length === detail.parameters.length) {
                    thisDetailScore += 1;
                }
                else {
                    issues.push({
                        severity: "info",
                        field: `details.${cap.name}.parameters`,
                        message: `${detail.parameters.length - described.length} parameters lack descriptions`,
                    });
                }
            }
            // Has request example
            if (detail.request_example && detail.request_example.url) {
                thisDetailScore += 1;
            }
            else {
                issues.push({
                    severity: "warning",
                    field: `details.${cap.name}.request_example`,
                    message: "Missing or incomplete request example",
                });
            }
            // Has response example
            if (detail.response_example && detail.response_example.status) {
                thisDetailScore += 1;
            }
            else {
                issues.push({
                    severity: "warning",
                    field: `details.${cap.name}.response_example`,
                    message: "Missing or incomplete response example",
                });
            }
            detailScore += thisDetailScore;
        }
        catch {
            issues.push({
                severity: "error",
                field: `details.${cap.name}`,
                message: "Capability detail file missing or unreadable",
            });
        }
    }
    // Each detail can earn up to 5 points, normalize to 25
    if (totalCaps > 0) {
        earnedScore += Math.round((detailScore / (totalCaps * 5)) * 25);
    }
    const score = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;
    return {
        domain,
        score,
        issues,
        pass: score >= MIN_SCORE,
    };
}
main().catch((err) => {
    log.error(`Fatal: ${err.message}`);
    process.exit(1);
});
