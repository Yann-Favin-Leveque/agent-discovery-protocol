// One-off script: initialize the agent_registry schema on a fresh database.
// Usage (from the registry/ directory):
//   DATABASE_URL=postgresql://... npx tsx scripts/bootstrap-db.ts
//
// After running this, apply incremental migrations under migrations/ in order:
//   psql "$DATABASE_URL" -f migrations/001_*.sql
//   psql "$DATABASE_URL" -f migrations/002_*.sql
//   ...

import { Pool } from "pg";
import { initSchema } from "../src/lib/db";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    max: 2,
  });

  console.log("Running initSchema...");
  await initSchema(pool);
  console.log("✓ Schema initialized.");

  await pool.end();
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
