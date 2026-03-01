#!/usr/bin/env node
/**
 * Category Assignment Migration
 *
 * Assigns category_slug to capabilities that currently have NULL categories,
 * based on pattern matching against service descriptions and capability names.
 * Also ensures all required categories exist in the categories table.
 *
 * Usage (from repository root):
 *   cd registry
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node ../tools/assign-categories.js
 *
 * Or with --dry-run to preview changes without applying:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node ../tools/assign-categories.js --dry-run
 */

const { createClient } = require("@libsql/client");

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!TURSO_DATABASE_URL) {
  console.error("Error: TURSO_DATABASE_URL is required");
  process.exit(1);
}

const db = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

// ─── Categories to ensure exist ─────────────────────────────────

const REQUIRED_CATEGORIES = [
  { name: "Email", slug: "email" },
  { name: "Payments", slug: "payments" },
  { name: "Storage", slug: "storage" },
  { name: "Analytics", slug: "analytics" },
  { name: "Communication", slug: "communication" },
  { name: "Productivity", slug: "productivity" },
  { name: "Developer Tools", slug: "developer-tools" },
  { name: "AI & ML", slug: "ai-ml" },
  { name: "Social", slug: "social" },
  { name: "CRM", slug: "crm" },
  { name: "E-Commerce", slug: "e-commerce" },
  { name: "Location", slug: "location" },
  { name: "Authentication", slug: "authentication" },
  { name: "Other", slug: "other" },
];

// ─── Pattern matching rules ─────────────────────────────────────
// Order matters: first match wins. More specific patterns go first.

const CATEGORY_RULES = [
  {
    slug: "email",
    patterns: [/\bemail\b/i, /\bmail\b/i, /\bsmtp\b/i, /\binbox\b/i],
  },
  {
    slug: "payments",
    patterns: [/\bpayment\b/i, /\binvoice\b/i, /\bbilling\b/i, /\bstripe\b/i, /\bcharge\b/i, /\brefund\b/i],
  },
  {
    slug: "storage",
    patterns: [/\bstorage\b/i, /\bfile\b/i, /\bdrive\b/i, /\bupload\b/i, /\bbucket\b/i, /\bblob\b/i, /\bs3\b/i],
  },
  {
    slug: "communication",
    patterns: [/\bchat\b/i, /\bmessag/i, /\bslack\b/i, /\bdiscord\b/i, /\bsms\b/i, /\bnotif/i, /\bwebhook\b/i],
  },
  {
    slug: "analytics",
    patterns: [/\banalytics\b/i, /\btracking\b/i, /\bmetric/i, /\bdashboard\b/i, /\breport/i, /\binsight/i, /\bmonitor/i, /\btelemetry\b/i],
  },
  {
    slug: "developer-tools",
    patterns: [/\bgit\b/i, /\bdeploy/i, /\b(?:ci|cd)\b/i, /\bhosting\b/i, /\brepository\b/i, /\bdns\b/i, /\binfrastructure\b/i, /\bdebug/i, /\bcompil/i, /\blint/i],
  },
  {
    slug: "crm",
    patterns: [/\bcrm\b/i, /\bsales\b/i, /\blead\b/i, /\bcustomer\s+relat/i, /\bpipeline\b/i, /\bdeal\b/i],
  },
  {
    slug: "ai-ml",
    patterns: [/\bai\b/i, /\bml\b/i, /\bmodel\b/i, /\bllm\b/i, /\bmachine\s+learn/i, /\bneural\b/i, /\bnlp\b/i, /\bgpt\b/i, /\bembedding/i, /\bgenerative\b/i],
  },
  {
    slug: "e-commerce",
    patterns: [/\bshop/i, /\bcommerce\b/i, /\bproduct\b/i, /\bcart\b/i, /\border\b/i, /\binventory\b/i, /\bcatalog\b/i],
  },
  {
    slug: "social",
    patterns: [/\bsocial\b/i, /\btwitter\b/i, /\bfacebook\b/i, /\binstagram\b/i, /\blinkedin\b/i, /\bfeed\b/i, /\bfollow/i],
  },
  {
    slug: "productivity",
    patterns: [/\bcalendar\b/i, /\btask\b/i, /\bproject\b/i, /\bnote\b/i, /\bproductivity\b/i, /\btodo\b/i, /\bworkflow\b/i, /\bschedul/i, /\bspreadsheet\b/i, /\bdocument\b/i],
  },
  {
    slug: "location",
    patterns: [/\bweather\b/i, /\bmap\b/i, /\blocation\b/i, /\bgeo/i, /\bcoordinate/i, /\baddress\b/i, /\broute\b/i, /\bplace\b/i],
  },
  {
    slug: "authentication",
    patterns: [/\bauth\b/i, /\bidentity\b/i, /\bsso\b/i, /\boauth\b/i, /\blogin\b/i, /\bsignup\b/i, /\bpassword\b/i, /\bpermission\b/i, /\brole\b/i],
  },
];

function matchCategory(text) {
  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return rule.slug;
      }
    }
  }
  return "other";
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN MODE ===" : "=== LIVE MODE ===");
  console.log("");

  // Step 1: Ensure all categories exist
  console.log("Step 1: Ensuring categories exist...");
  if (!DRY_RUN) {
    for (const cat of REQUIRED_CATEGORIES) {
      await db.execute({
        sql: "INSERT INTO categories (name, slug) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = ?)",
        args: [cat.name, cat.slug, cat.slug],
      });
    }
  }
  console.log(`  [OK] ${REQUIRED_CATEGORIES.length} categories ensured`);

  // Step 2: Get all capabilities, joined with service info
  console.log("\nStep 2: Loading capabilities...");
  const result = await db.execute(`
    SELECT c.id, c.name, c.description, c.category_slug,
           s.name as service_name, s.description as service_description, s.domain
    FROM capabilities c
    JOIN services s ON c.service_id = s.id
    ORDER BY s.domain, c.name
  `);

  const total = result.rows.length;
  const unassigned = result.rows.filter((r) => !r.category_slug);
  console.log(`  Total capabilities: ${total}`);
  console.log(`  Already categorized: ${total - unassigned.length}`);
  console.log(`  Needing assignment: ${unassigned.length}`);

  if (unassigned.length === 0) {
    console.log("\nNo capabilities need category assignment. Done!");
    return;
  }

  // Step 3: Assign categories
  console.log("\nStep 3: Assigning categories...");
  const assignments = {};
  const updates = [];

  for (const row of unassigned) {
    // Combine capability name + description + service description for matching
    const searchText = [
      row.name,
      row.description,
      row.service_description,
    ].join(" ");

    const slug = matchCategory(searchText);
    assignments[slug] = (assignments[slug] || 0) + 1;
    updates.push({
      id: Number(row.id),
      slug,
      capName: row.name,
      domain: row.domain,
    });
  }

  // Print summary
  console.log("\n  Assignment summary:");
  const sorted = Object.entries(assignments).sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of sorted) {
    console.log(`    ${slug}: ${count}`);
  }

  // Step 4: Apply updates
  if (DRY_RUN) {
    console.log("\n  [DRY RUN] Sample assignments (first 30):");
    for (const u of updates.slice(0, 30)) {
      console.log(`    ${u.domain} / ${u.capName} -> ${u.slug}`);
    }
    console.log(`\n  Total would be updated: ${updates.length}`);
  } else {
    console.log("\nStep 4: Applying updates...");

    // Batch in groups of 20 for efficiency
    const BATCH_SIZE = 20;
    let applied = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const stmts = batch.map((u) => ({
        sql: "UPDATE capabilities SET category_slug = ? WHERE id = ?",
        args: [u.slug, u.id],
      }));
      await db.batch(stmts);
      applied += batch.length;
      process.stdout.write(`\r  Updated ${applied}/${updates.length} capabilities`);
    }

    console.log("\n\n  Done! All capabilities have been assigned categories.");
  }

  // Final stats
  console.log("\n=== Category distribution ===");
  const stats = await db.execute(`
    SELECT
      COALESCE(c.category_slug, 'NULL') as category,
      COUNT(*) as count
    FROM capabilities c
    GROUP BY c.category_slug
    ORDER BY count DESC
  `);
  for (const row of stats.rows) {
    console.log(`  ${row.category}: ${row.count}`);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
