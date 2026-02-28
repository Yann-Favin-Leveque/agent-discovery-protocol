import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "registry.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
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

  // Migration: add crawl_failures column if missing
  const columns = db.prepare("PRAGMA table_info(services)").all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === "crawl_failures")) {
    db.exec("ALTER TABLE services ADD COLUMN crawl_failures INTEGER NOT NULL DEFAULT 0");
  }

  seedCategories(db);
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

function seedCategories(db: Database.Database) {
  const existing = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
  if (existing.count > 0) return;

  const insert = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
  const tx = db.transaction(() => {
    for (const cat of SEED_CATEGORIES) {
      insert.run(cat.name, cat.slug);
    }
  });
  tx();
}

// --- Query helpers ---

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

export function getAllCategories(): CategoryRow[] {
  return getDb().prepare("SELECT * FROM categories ORDER BY name").all() as CategoryRow[];
}

export function getServiceByDomain(domain: string): ServiceRow | undefined {
  return getDb().prepare("SELECT * FROM services WHERE domain = ?").get(domain) as ServiceRow | undefined;
}

export function getCapabilitiesForService(serviceId: number): CapabilityRow[] {
  return getDb()
    .prepare("SELECT * FROM capabilities WHERE service_id = ? ORDER BY name")
    .all(serviceId) as CapabilityRow[];
}

export function getAllServices(opts: {
  category?: string;
  search?: string;
  sort?: "newest" | "name" | "capabilities";
  limit?: number;
  offset?: number;
}): { services: ServiceRow[]; total: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.category && opts.category !== "all") {
    conditions.push(`s.id IN (SELECT service_id FROM capabilities WHERE category_slug = ?)`);
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy = "s.created_at DESC";
  if (opts.sort === "name") orderBy = "s.name ASC";
  if (opts.sort === "capabilities") orderBy = "cap_count DESC, s.name ASC";

  const countRow = getDb()
    .prepare(`SELECT COUNT(DISTINCT s.id) as total FROM services s ${where}`)
    .get(...params) as { total: number };

  const rows = getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM capabilities WHERE service_id = s.id) as cap_count
       FROM services s
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, opts.limit ?? 50, opts.offset ?? 0) as ServiceRow[];

  return { services: rows, total: countRow.total };
}

export function discoverServices(query: string): Array<ServiceRow & { matching_capabilities: CapabilityRow[] }> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return [];

  // Score-based ranking: match against service name, description, capability names, capability descriptions
  const allServices = getDb().prepare("SELECT * FROM services ORDER BY name").all() as ServiceRow[];
  const scored: Array<{ service: ServiceRow; score: number; matchingCaps: CapabilityRow[] }> = [];

  for (const service of allServices) {
    let score = 0;
    const sName = service.name.toLowerCase();
    const sDesc = service.description.toLowerCase();

    for (const term of terms) {
      if (sName.includes(term)) score += 10;
      if (sDesc.includes(term)) score += 5;
    }

    const caps = getCapabilitiesForService(service.id);
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

export function insertService(data: {
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
  capabilities: Array<{ name: string; description: string; detail_url: string; category_slug?: string }>;
}): ServiceRow {
  const db = getDb();

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO services (name, domain, description, base_url, well_known_url, auth_type, auth_details, pricing_type, spec_version, verified, last_crawled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        data.name,
        data.domain,
        data.description,
        data.base_url,
        data.well_known_url,
        data.auth_type,
        data.auth_details,
        data.pricing_type,
        data.spec_version,
        data.verified ? 1 : 0
      );

    const serviceId = result.lastInsertRowid as number;

    const insertCap = db.prepare(
      "INSERT INTO capabilities (service_id, name, description, detail_url, category_slug) VALUES (?, ?, ?, ?, ?)"
    );

    for (const cap of data.capabilities) {
      insertCap.run(serviceId, cap.name, cap.description, cap.detail_url, cap.category_slug ?? null);
    }

    return serviceId;
  });

  const serviceId = tx();
  return db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId) as ServiceRow;
}

export function updateServiceVerification(domain: string, manifest: {
  name: string;
  description: string;
  base_url: string;
  auth_type: string;
  auth_details: string;
  pricing_type: string;
  spec_version: string;
  capabilities: Array<{ name: string; description: string; detail_url: string; category_slug?: string }>;
}): ServiceRow | undefined {
  const db = getDb();
  const service = getServiceByDomain(domain);
  if (!service) return undefined;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE services SET
        name = ?, description = ?, base_url = ?, auth_type = ?, auth_details = ?,
        pricing_type = ?, spec_version = ?, verified = 1, crawl_failures = 0,
        last_crawled_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      manifest.name, manifest.description, manifest.base_url,
      manifest.auth_type, manifest.auth_details, manifest.pricing_type,
      manifest.spec_version, service.id
    );

    db.prepare("DELETE FROM capabilities WHERE service_id = ?").run(service.id);

    const insertCap = db.prepare(
      "INSERT INTO capabilities (service_id, name, description, detail_url, category_slug) VALUES (?, ?, ?, ?, ?)"
    );
    for (const cap of manifest.capabilities) {
      insertCap.run(service.id, cap.name, cap.description, cap.detail_url, cap.category_slug ?? null);
    }
  });

  tx();
  return db.prepare("SELECT * FROM services WHERE id = ?").get(service.id) as ServiceRow;
}

export function getVerifiedServices(): ServiceRow[] {
  return getDb()
    .prepare("SELECT * FROM services WHERE verified = 1 ORDER BY last_crawled_at ASC")
    .all() as ServiceRow[];
}

export function incrementCrawlFailure(domain: string): void {
  getDb()
    .prepare(
      `UPDATE services SET crawl_failures = crawl_failures + 1, updated_at = datetime('now') WHERE domain = ?`
    )
    .run(domain);
}

export function markUnreachable(domain: string): void {
  getDb()
    .prepare(
      `UPDATE services SET verified = 0, updated_at = datetime('now') WHERE domain = ?`
    )
    .run(domain);
}

export function getServiceStats(): { total_services: number; total_capabilities: number; verified_services: number } {
  const db = getDb();
  const services = db.prepare("SELECT COUNT(*) as count FROM services").get() as { count: number };
  const caps = db.prepare("SELECT COUNT(*) as count FROM capabilities").get() as { count: number };
  const verified = db.prepare("SELECT COUNT(*) as count FROM services WHERE verified = 1").get() as { count: number };
  return {
    total_services: services.count,
    total_capabilities: caps.count,
    verified_services: verified.count,
  };
}
