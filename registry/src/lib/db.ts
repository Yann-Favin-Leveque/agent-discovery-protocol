import { createClient, type Client, type Row } from "@libsql/client";
import path from "path";

// ─── Client singleton ────────────────────────────────────────────

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (client) return client;

  if (process.env.TURSO_DATABASE_URL) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    // Local dev fallback: file-based SQLite
    const dbPath = path.join(process.cwd(), "data", "registry.db");
    client = createClient({
      url: `file:${dbPath}`,
    });
  }

  return client;
}

async function ensureInitialized(): Promise<Client> {
  const db = getClient();
  if (initialized) return db;

  await initSchema(db);
  initialized = true;
  return db;
}

// ─── Schema ──────────────────────────────────────────────────────

async function initSchema(db: Client) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      base_url TEXT NOT NULL,
      well_known_url TEXT NOT NULL,
      auth_type TEXT NOT NULL DEFAULT 'none',
      auth_details TEXT DEFAULT '{}',
      pricing_type TEXT DEFAULT 'free',
      spec_version TEXT NOT NULL DEFAULT '1.0',
      verified INTEGER NOT NULL DEFAULT 0,
      crawl_failures INTEGER NOT NULL DEFAULT 0,
      last_crawled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS capabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      detail_url TEXT NOT NULL,
      category_slug TEXT REFERENCES categories(slug)
    );

    CREATE INDEX IF NOT EXISTS idx_capabilities_service_id ON capabilities(service_id);
    CREATE INDEX IF NOT EXISTS idx_services_domain ON services(domain);
    CREATE INDEX IF NOT EXISTS idx_services_verified ON services(verified);
  `);

  // Check if crawl_failures column exists (migration)
  const columns = await db.execute("PRAGMA table_info(services)");
  const hasCrawlFailures = columns.rows.some(
    (row) => (row as unknown as { name: string }).name === "crawl_failures"
  );
  if (!hasCrawlFailures) {
    await db.execute(
      "ALTER TABLE services ADD COLUMN crawl_failures INTEGER NOT NULL DEFAULT 0"
    );
  }

  await seedCategories(db);
}

const SEED_CATEGORIES = [
  { name: "Email", slug: "email" },
  { name: "Payments", slug: "payments" },
  { name: "Storage", slug: "storage" },
  { name: "Analytics", slug: "analytics" },
  { name: "Communication", slug: "communication" },
  { name: "Productivity", slug: "productivity" },
  { name: "Developer Tools", slug: "developer-tools" },
  { name: "AI & ML", slug: "ai-ml" },
  { name: "Social", slug: "social" },
  { name: "Other", slug: "other" },
];

async function seedCategories(db: Client) {
  const stmts = SEED_CATEGORIES.map((cat) => ({
    sql: "INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)",
    args: [cat.name, cat.slug],
  }));
  await db.batch(stmts);
}

// ─── Row types ───────────────────────────────────────────────────

export interface ServiceRow {
  id: number;
  name: string;
  domain: string;
  description: string;
  base_url: string;
  well_known_url: string;
  auth_type: string;
  auth_details: string;
  pricing_type: string;
  spec_version: string;
  verified: number;
  crawl_failures: number;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapabilityRow {
  id: number;
  service_id: number;
  name: string;
  description: string;
  detail_url: string;
  category_slug: string | null;
}

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function rowTo<T>(row: Row): T {
  // libsql rows have column values accessible by name
  return row as unknown as T;
}

function rowsTo<T>(rows: Row[]): T[] {
  return rows.map((r) => rowTo<T>(r));
}

// ─── Query functions ─────────────────────────────────────────────

export async function getAllCategories(): Promise<CategoryRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute("SELECT * FROM categories ORDER BY name");
  return rowsTo<CategoryRow>(result.rows);
}

export async function getServiceByDomain(
  domain: string
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM services WHERE domain = ?",
    args: [domain],
  });
  return result.rows.length > 0 ? rowTo<ServiceRow>(result.rows[0]) : undefined;
}

export async function getCapabilitiesForService(
  serviceId: number
): Promise<CapabilityRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM capabilities WHERE service_id = ? ORDER BY name",
    args: [serviceId],
  });
  return rowsTo<CapabilityRow>(result.rows);
}

export async function getAllServices(opts: {
  category?: string;
  search?: string;
  sort?: "newest" | "name" | "capabilities";
  limit?: number;
  offset?: number;
}): Promise<{ services: ServiceRow[]; total: number }> {
  const db = await ensureInitialized();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.category && opts.category !== "all") {
    conditions.push(
      "s.id IN (SELECT service_id FROM capabilities WHERE category_slug = ?)"
    );
    params.push(opts.category);
  }

  if (opts.search) {
    conditions.push(`(
      s.name LIKE ? OR
      s.description LIKE ? OR
      s.id IN (SELECT service_id FROM capabilities WHERE name LIKE ? OR description LIKE ?)
    )`);
    const term = `%${opts.search}%`;
    params.push(term, term, term, term);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy = "s.created_at DESC";
  if (opts.sort === "name") orderBy = "s.name ASC";
  if (opts.sort === "capabilities") orderBy = "cap_count DESC, s.name ASC";

  const countResult = await db.execute({
    sql: `SELECT COUNT(DISTINCT s.id) as total FROM services s ${where}`,
    args: params,
  });
  const total = Number(countResult.rows[0].total);

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const rowsResult = await db.execute({
    sql: `SELECT s.*, (SELECT COUNT(*) FROM capabilities WHERE service_id = s.id) as cap_count
       FROM services s
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  });

  return { services: rowsTo<ServiceRow>(rowsResult.rows), total };
}

export async function discoverServices(
  query: string
): Promise<Array<ServiceRow & { matching_capabilities: CapabilityRow[] }>> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return [];

  const db = await ensureInitialized();
  const allResult = await db.execute(
    "SELECT * FROM services ORDER BY name"
  );
  const allServices = rowsTo<ServiceRow>(allResult.rows);

  const scored: Array<{
    service: ServiceRow;
    score: number;
    matchingCaps: CapabilityRow[];
  }> = [];

  for (const service of allServices) {
    let score = 0;
    const sName = service.name.toLowerCase();
    const sDesc = service.description.toLowerCase();

    for (const term of terms) {
      if (sName.includes(term)) score += 10;
      if (sDesc.includes(term)) score += 5;
    }

    const caps = await getCapabilitiesForService(service.id);
    const matchingCaps: CapabilityRow[] = [];

    for (const cap of caps) {
      const cName = cap.name.toLowerCase();
      const cDesc = cap.description.toLowerCase();
      let capScore = 0;

      for (const term of terms) {
        if (cName.includes(term)) capScore += 15;
        if (cDesc.includes(term)) capScore += 8;
      }

      if (capScore > 0) {
        score += capScore;
        matchingCaps.push(cap);
      }
    }

    if (score > 0) {
      scored.push({ service, score, matchingCaps });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map(({ service, matchingCaps }) => ({
    ...service,
    matching_capabilities: matchingCaps,
  }));
}

export async function insertService(data: {
  name: string;
  domain: string;
  description: string;
  base_url: string;
  well_known_url: string;
  auth_type: string;
  auth_details: string;
  pricing_type: string;
  spec_version: string;
  verified: boolean;
  capabilities: Array<{
    name: string;
    description: string;
    detail_url: string;
    category_slug?: string;
  }>;
}): Promise<ServiceRow> {
  const db = await ensureInitialized();

  const insertResult = await db.execute({
    sql: `INSERT INTO services (name, domain, description, base_url, well_known_url, auth_type, auth_details, pricing_type, spec_version, verified, last_crawled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      data.name,
      data.domain,
      data.description,
      data.base_url,
      data.well_known_url,
      data.auth_type,
      data.auth_details,
      data.pricing_type,
      data.spec_version,
      data.verified ? 1 : 0,
    ],
  });

  const serviceId = Number(insertResult.lastInsertRowid);

  const capStmts = data.capabilities.map((cap) => ({
    sql: "INSERT INTO capabilities (service_id, name, description, detail_url, category_slug) VALUES (?, ?, ?, ?, ?)",
    args: [
      serviceId,
      cap.name,
      cap.description,
      cap.detail_url,
      cap.category_slug ?? null,
    ] as (string | number | null)[],
  }));

  if (capStmts.length > 0) {
    await db.batch(capStmts);
  }

  const result = await db.execute({
    sql: "SELECT * FROM services WHERE id = ?",
    args: [serviceId],
  });
  return rowTo<ServiceRow>(result.rows[0]);
}

export async function updateServiceVerification(
  domain: string,
  manifest: {
    name: string;
    description: string;
    base_url: string;
    auth_type: string;
    auth_details: string;
    pricing_type: string;
    spec_version: string;
    capabilities: Array<{
      name: string;
      description: string;
      detail_url: string;
      category_slug?: string;
    }>;
  }
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const service = await getServiceByDomain(domain);
  if (!service) return undefined;

  await db.execute({
    sql: `UPDATE services SET
        name = ?, description = ?, base_url = ?, auth_type = ?, auth_details = ?,
        pricing_type = ?, spec_version = ?, verified = 1, crawl_failures = 0,
        last_crawled_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
    args: [
      manifest.name,
      manifest.description,
      manifest.base_url,
      manifest.auth_type,
      manifest.auth_details,
      manifest.pricing_type,
      manifest.spec_version,
      service.id,
    ],
  });

  await db.execute({
    sql: "DELETE FROM capabilities WHERE service_id = ?",
    args: [service.id],
  });

  const capStmts = manifest.capabilities.map((cap) => ({
    sql: "INSERT INTO capabilities (service_id, name, description, detail_url, category_slug) VALUES (?, ?, ?, ?, ?)",
    args: [
      service.id,
      cap.name,
      cap.description,
      cap.detail_url,
      cap.category_slug ?? null,
    ] as (string | number | null)[],
  }));

  if (capStmts.length > 0) {
    await db.batch(capStmts);
  }

  const result = await db.execute({
    sql: "SELECT * FROM services WHERE id = ?",
    args: [service.id],
  });
  return rowTo<ServiceRow>(result.rows[0]);
}

export async function getVerifiedServices(): Promise<ServiceRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute(
    "SELECT * FROM services WHERE verified = 1 ORDER BY last_crawled_at ASC"
  );
  return rowsTo<ServiceRow>(result.rows);
}

export async function incrementCrawlFailure(domain: string): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: `UPDATE services SET crawl_failures = crawl_failures + 1, updated_at = datetime('now') WHERE domain = ?`,
    args: [domain],
  });
}

export async function markUnreachable(domain: string): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: `UPDATE services SET verified = 0, updated_at = datetime('now') WHERE domain = ?`,
    args: [domain],
  });
}

export async function getServiceStats(): Promise<{
  total_services: number;
  total_capabilities: number;
  verified_services: number;
}> {
  const db = await ensureInitialized();
  const [services, caps, verified] = await Promise.all([
    db.execute("SELECT COUNT(*) as count FROM services"),
    db.execute("SELECT COUNT(*) as count FROM capabilities"),
    db.execute(
      "SELECT COUNT(*) as count FROM services WHERE verified = 1"
    ),
  ]);
  return {
    total_services: Number(services.rows[0].count),
    total_capabilities: Number(caps.rows[0].count),
    verified_services: Number(verified.rows[0].count),
  };
}
