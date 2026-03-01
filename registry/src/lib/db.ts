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

let initPromise: Promise<Client> | null = null;

async function ensureInitialized(): Promise<Client> {
  const db = getClient();
  if (initialized) return db;

  if (!initPromise) {
    initPromise = initSchema(db).then(() => {
      initialized = true;
      return db;
    });
  }
  return initPromise;
}

// ─── Schema ──────────────────────────────────────────────────────

async function initSchema(db: Client) {
  // Enable WAL mode for better concurrency (local dev)
  await db.execute("PRAGMA journal_mode=WAL").catch(() => {});
  await db.execute("PRAGMA busy_timeout=5000").catch(() => {});

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
      trust_level TEXT NOT NULL DEFAULT 'unverified',
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

    CREATE TABLE IF NOT EXISTS blocked_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      reason TEXT,
      blocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      blocked_by TEXT DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_domain TEXT NOT NULL,
      reporter_ip TEXT,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      domain TEXT,
      ip_address TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_capabilities_service_id ON capabilities(service_id);
    CREATE INDEX IF NOT EXISTS idx_services_domain ON services(domain);
    CREATE INDEX IF NOT EXISTS idx_services_verified ON services(verified);
    CREATE INDEX IF NOT EXISTS idx_services_trust_level ON services(trust_level);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_domain ON audit_log(domain);
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(service_domain);
    CREATE INDEX IF NOT EXISTS idx_blocked_domains_domain ON blocked_domains(domain);
  `);

  // Column migrations for existing databases
  const columns = await db.execute("PRAGMA table_info(services)");
  const colNames = columns.rows.map(
    (row) => (row as unknown as { name: string }).name
  );

  if (!colNames.includes("crawl_failures")) {
    await db.execute(
      "ALTER TABLE services ADD COLUMN crawl_failures INTEGER NOT NULL DEFAULT 0"
    );
  }

  if (!colNames.includes("trust_level")) {
    await db.execute(
      "ALTER TABLE services ADD COLUMN trust_level TEXT NOT NULL DEFAULT 'unverified'"
    );
    // Migrate existing verified data
    await db.execute(
      "UPDATE services SET trust_level = 'verified' WHERE verified = 1"
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

export type TrustLevel = "verified" | "community" | "unverified";

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
  trust_level: TrustLevel;
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

export interface BlockedDomainRow {
  id: number;
  domain: string;
  reason: string | null;
  blocked_at: string;
  blocked_by: string;
}

export interface ReportRow {
  id: number;
  service_domain: string;
  reporter_ip: string | null;
  reason: string;
  created_at: string;
  resolved: number;
}

export interface AuditLogRow {
  id: number;
  action: string;
  domain: string | null;
  ip_address: string | null;
  details: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function rowTo<T>(row: Row): T {
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
  include_unverified?: boolean;
}): Promise<{ services: ServiceRow[]; total: number }> {
  const db = await ensureInitialized();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Trust filter: default to trusted only
  if (!opts.include_unverified) {
    conditions.push("s.trust_level IN ('verified', 'community')");
  }

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

  // When including unverified, sort trusted first
  if (opts.include_unverified) {
    orderBy = `CASE s.trust_level WHEN 'verified' THEN 0 WHEN 'community' THEN 1 ELSE 2 END, ${orderBy}`;
  }

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
  query: string,
  opts?: { include_unverified?: boolean }
): Promise<Array<ServiceRow & { matching_capabilities: CapabilityRow[] }>> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return [];

  const db = await ensureInitialized();

  // Default: trusted only
  const trustFilter = opts?.include_unverified
    ? ""
    : "WHERE trust_level IN ('verified', 'community')";

  const allResult = await db.execute(
    `SELECT * FROM services ${trustFilter} ORDER BY name`
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

  // Boost trusted services in sort order
  scored.sort((a, b) => {
    const trustOrder = (s: ServiceRow) =>
      s.trust_level === "verified" ? 0 : s.trust_level === "community" ? 1 : 2;
    const trustDiff = trustOrder(a.service) - trustOrder(b.service);
    if (trustDiff !== 0 && Math.abs(a.score - b.score) < 5) return trustDiff;
    return b.score - a.score;
  });

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
  trust_level: TrustLevel;
  capabilities: Array<{
    name: string;
    description: string;
    detail_url: string;
    category_slug?: string;
  }>;
}): Promise<ServiceRow> {
  const db = await ensureInitialized();

  const verified = data.trust_level === "verified" ? 1 : 0;

  const insertResult = await db.execute({
    sql: `INSERT INTO services (name, domain, description, base_url, well_known_url, auth_type, auth_details, pricing_type, spec_version, verified, trust_level, last_crawled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
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
      verified,
      data.trust_level,
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
        pricing_type = ?, spec_version = ?, verified = 1, trust_level = 'verified',
        crawl_failures = 0, last_crawled_at = datetime('now'), updated_at = datetime('now')
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

export async function getTrustedServices(): Promise<ServiceRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute(
    "SELECT * FROM services WHERE trust_level IN ('verified', 'community') ORDER BY last_crawled_at ASC"
  );
  return rowsTo<ServiceRow>(result.rows);
}

// Keep backward-compatible alias
export const getVerifiedServices = getTrustedServices;

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
    sql: `UPDATE services SET verified = 0, trust_level = 'unverified', updated_at = datetime('now') WHERE domain = ?`,
    args: [domain],
  });
}

export async function updateServiceTrustLevel(
  domain: string,
  trustLevel: TrustLevel
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const verified = trustLevel === "verified" ? 1 : 0;
  await db.execute({
    sql: `UPDATE services SET trust_level = ?, verified = ?, updated_at = datetime('now') WHERE domain = ?`,
    args: [trustLevel, verified, domain],
  });
  return getServiceByDomain(domain);
}

export async function deleteService(domain: string): Promise<boolean> {
  const db = await ensureInitialized();
  const service = await getServiceByDomain(domain);
  if (!service) return false;
  await db.execute({
    sql: "DELETE FROM capabilities WHERE service_id = ?",
    args: [service.id],
  });
  await db.execute({
    sql: "DELETE FROM services WHERE id = ?",
    args: [service.id],
  });
  return true;
}

export async function getServiceStats(): Promise<{
  total_services: number;
  total_capabilities: number;
  verified_services: number;
  community_services: number;
  trusted_services: number;
}> {
  const db = await ensureInitialized();
  const [services, caps, verified, community] = await Promise.all([
    db.execute("SELECT COUNT(*) as count FROM services"),
    db.execute("SELECT COUNT(*) as count FROM capabilities"),
    db.execute(
      "SELECT COUNT(*) as count FROM services WHERE trust_level = 'verified'"
    ),
    db.execute(
      "SELECT COUNT(*) as count FROM services WHERE trust_level = 'community'"
    ),
  ]);
  const verifiedCount = Number(verified.rows[0].count);
  const communityCount = Number(community.rows[0].count);
  return {
    total_services: Number(services.rows[0].count),
    total_capabilities: Number(caps.rows[0].count),
    verified_services: verifiedCount,
    community_services: communityCount,
    trusted_services: verifiedCount + communityCount,
  };
}

// ─── Blocked domains ─────────────────────────────────────────────

export async function isBlockedDomain(domain: string): Promise<boolean> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT 1 FROM blocked_domains WHERE domain = ?",
    args: [domain],
  });
  return result.rows.length > 0;
}

export async function blockDomain(
  domain: string,
  reason: string,
  blockedBy: string = "admin"
): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "INSERT OR IGNORE INTO blocked_domains (domain, reason, blocked_by) VALUES (?, ?, ?)",
    args: [domain, reason, blockedBy],
  });
}

export async function getBlockedDomains(): Promise<BlockedDomainRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute(
    "SELECT * FROM blocked_domains ORDER BY blocked_at DESC"
  );
  return rowsTo<BlockedDomainRow>(result.rows);
}

// ─── Reports ─────────────────────────────────────────────────────

export async function insertReport(data: {
  service_domain: string;
  reporter_ip: string;
  reason: string;
}): Promise<ReportRow> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "INSERT INTO reports (service_domain, reporter_ip, reason) VALUES (?, ?, ?)",
    args: [data.service_domain, data.reporter_ip, data.reason],
  });
  const id = Number(result.lastInsertRowid);
  const row = await db.execute({
    sql: "SELECT * FROM reports WHERE id = ?",
    args: [id],
  });
  return rowTo<ReportRow>(row.rows[0]);
}

export async function getReports(opts?: {
  status?: "pending" | "resolved";
  limit?: number;
  offset?: number;
}): Promise<{ reports: ReportRow[]; total: number }> {
  const db = await ensureInitialized();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.status === "pending") {
    conditions.push("resolved = 0");
  } else if (opts?.status === "resolved") {
    conditions.push("resolved = 1");
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM reports ${where}`,
    args: params,
  });
  const total = Number(countResult.rows[0].total);

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await db.execute({
    sql: `SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  });

  return { reports: rowsTo<ReportRow>(result.rows), total };
}

export async function resolveReport(id: number): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "UPDATE reports SET resolved = 1 WHERE id = ?",
    args: [id],
  });
}

// ─── Audit log ───────────────────────────────────────────────────

export async function logAudit(entry: {
  action: string;
  domain?: string;
  ip_address?: string;
  details?: string;
}): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "INSERT INTO audit_log (action, domain, ip_address, details) VALUES (?, ?, ?, ?)",
    args: [
      entry.action,
      entry.domain ?? null,
      entry.ip_address ?? null,
      entry.details ?? null,
    ],
  });
}

export async function getAuditLog(opts?: {
  action?: string;
  domain?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditLogRow[]; total: number }> {
  const db = await ensureInitialized();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.action) {
    conditions.push("action = ?");
    params.push(opts.action);
  }
  if (opts?.domain) {
    conditions.push("domain = ?");
    params.push(opts.domain);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM audit_log ${where}`,
    args: params,
  });
  const total = Number(countResult.rows[0].total);

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await db.execute({
    sql: `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  });

  return { entries: rowsTo<AuditLogRow>(result.rows), total };
}
