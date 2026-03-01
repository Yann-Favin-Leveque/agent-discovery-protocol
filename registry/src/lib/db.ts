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
    CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category_slug);
    CREATE INDEX IF NOT EXISTS idx_capabilities_service_category ON capabilities(service_id, category_slug);
    CREATE INDEX IF NOT EXISTS idx_services_domain ON services(domain);
    CREATE INDEX IF NOT EXISTS idx_services_verified ON services(verified);
    CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at);
    CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
    CREATE INDEX IF NOT EXISTS idx_services_trust_level ON services(trust_level);
    CREATE INDEX IF NOT EXISTS idx_services_trust_created ON services(trust_level, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_services_trust_name ON services(trust_level, name ASC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_domain ON audit_log(domain);
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(service_domain);
    CREATE INDEX IF NOT EXISTS idx_blocked_domains_domain ON blocked_domains(domain);

    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_domain TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'up',
      response_time_ms INTEGER,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_health_checks_domain ON health_checks(service_domain);
    CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      provider TEXT NOT NULL DEFAULT 'google',
      provider_id TEXT NOT NULL,
      stripe_customer_id TEXT,
      payment_method_added INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
    CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

    CREATE TABLE IF NOT EXISTS provider_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_domain TEXT NOT NULL UNIQUE,
      stripe_connect_account_id TEXT NOT NULL,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_provider_accounts_domain ON provider_accounts(service_domain);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      service_domain TEXT NOT NULL,
      stripe_subscription_id TEXT,
      plan_name TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      interval TEXT NOT NULL DEFAULT 'month',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start TEXT,
      current_period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_domain ON subscriptions(service_domain);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      service_domain TEXT NOT NULL,
      stripe_payment_intent_id TEXT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_domain ON transactions(service_domain);
  `);

  // Column migrations for existing databases — use try/catch because
  // ALTER TABLE fails if the column already exists, and PRAGMA table_info
  // doesn't work reliably on Turso HTTP.
  try {
    await db.execute(
      "ALTER TABLE services ADD COLUMN crawl_failures INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.execute(
      "ALTER TABLE services ADD COLUMN trust_level TEXT NOT NULL DEFAULT 'unverified'"
    );
    // Migrate existing verified data
    await db.execute(
      "UPDATE services SET trust_level = 'verified' WHERE verified = 1"
    );
  } catch {
    // Column already exists — ignore
  }

  await seedCategories(db);
  await seedAgentDNS(db);
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
  { name: "CRM", slug: "crm" },
  { name: "E-Commerce", slug: "e-commerce" },
  { name: "Location", slug: "location" },
  { name: "Authentication", slug: "authentication" },
  { name: "Other", slug: "other" },
];

async function seedCategories(db: Client) {
  for (const cat of SEED_CATEGORIES) {
    await db.execute({
      sql: "INSERT INTO categories (name, slug) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = ?)",
      args: [cat.name, cat.slug, cat.slug],
    });
  }
}

async function seedAgentDNS(db: Client) {
  // Register agent-dns.dev in its own registry as verified
  const existing = await db.execute({
    sql: "SELECT id FROM services WHERE domain = ?",
    args: ["agent-dns.dev"],
  });
  if (existing.rows.length > 0) return;

  await db.execute({
    sql: `INSERT INTO services (name, domain, description, base_url, well_known_url, auth_type, auth_details, pricing_type, spec_version, verified, trust_level, last_crawled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'verified', datetime('now'))`,
    args: [
      "AgentDNS Registry",
      "agent-dns.dev",
      "The registry for the Agent Discovery Protocol. Search, discover, and verify services that implement the /.well-known/agent standard.",
      "https://agent-dns.dev",
      "https://agent-dns.dev/.well-known/agent",
      "none",
      JSON.stringify({ type: "none" }),
      "free",
      "1.0",
    ],
  });

  // Get the service id
  const svc = await db.execute({
    sql: "SELECT id FROM services WHERE domain = ?",
    args: ["agent-dns.dev"],
  });
  if (svc.rows.length === 0) return;
  const serviceId = svc.rows[0].id as number;

  // Add capabilities
  const caps = [
    { name: "discover_services", description: "Search for services by intent or keyword", detail_url: "/api/capabilities/discover_services", slug: "developer-tools" },
    { name: "list_services", description: "List all registered services with filtering and pagination", detail_url: "/api/capabilities/list_services", slug: "developer-tools" },
    { name: "submit_service", description: "Submit a new service to the registry", detail_url: "/api/capabilities/submit_service", slug: "developer-tools" },
    { name: "verify_service", description: "Trigger verification of a service's manifest", detail_url: "/api/capabilities/verify_service", slug: "developer-tools" },
  ];

  for (const cap of caps) {
    await db.execute({
      sql: `INSERT INTO capabilities (service_id, name, description, detail_url, category_slug)
           SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM capabilities WHERE service_id = ? AND name = ?)`,
      args: [serviceId, cap.name, cap.description, cap.detail_url, cap.slug, serviceId, cap.name],
    });
  }
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

export interface HealthCheckRow {
  id: number;
  service_domain: string;
  status: "up" | "down" | "degraded";
  response_time_ms: number | null;
  checked_at: string;
}

export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  provider: string;
  provider_id: string;
  stripe_customer_id: string | null;
  payment_method_added: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderAccountRow {
  id: number;
  service_domain: string;
  stripe_connect_account_id: string;
  onboarding_complete: number;
  created_at: string;
}

export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface SubscriptionRow {
  id: number;
  user_id: number;
  service_domain: string;
  stripe_subscription_id: string | null;
  plan_name: string;
  price_cents: number;
  currency: string;
  interval: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: number;
  user_id: number;
  service_domain: string;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  status: string;
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

export interface ServiceListItem extends ServiceRow {
  cap_count: number;
}

export async function getAllServices(opts: {
  category?: string;
  search?: string;
  sort?: "newest" | "name" | "capabilities";
  limit?: number;
  offset?: number;
  include_unverified?: boolean;
}): Promise<{ services: ServiceListItem[]; total: number }> {
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

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  // Run COUNT and data queries in parallel
  const [countResult, rowsResult] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(DISTINCT s.id) as total FROM services s ${where}`,
      args: params,
    }),
    db.execute({
      sql: `SELECT s.*, COUNT(c.id) as cap_count
         FROM services s
         LEFT JOIN capabilities c ON c.service_id = s.id
         ${where}
         GROUP BY s.id
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      args: [...params, limit, offset],
    }),
  ]);

  const total = Number(countResult.rows[0].total);
  return { services: rowsTo<ServiceListItem>(rowsResult.rows), total };
}

export async function discoverServices(
  query: string,
  opts?: { include_unverified?: boolean; limit?: number }
): Promise<Array<ServiceRow & { matching_capabilities: CapabilityRow[]; cap_count: number }>> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return [];

  const db = await ensureInitialized();
  const maxResults = opts?.limit ?? 10;

  // Build LIKE conditions for each term — match against service OR capability fields
  const likeConditions: string[] = [];
  const likeParams: string[] = [];

  for (const term of terms) {
    const pattern = `%${term}%`;
    likeConditions.push(
      `(s.name LIKE ? OR s.description LIKE ? OR s.id IN (SELECT service_id FROM capabilities WHERE name LIKE ? OR description LIKE ?))`
    );
    likeParams.push(pattern, pattern, pattern, pattern);
  }

  const trustCondition = opts?.include_unverified
    ? ""
    : "s.trust_level IN ('verified', 'community')";

  const allConditions = [trustCondition, ...likeConditions].filter(Boolean);
  const where = allConditions.length > 0 ? `WHERE ${allConditions.join(" AND ")}` : "";

  // Step 1: Find matching services with cap_count, scored and limited in SQL
  const servicesResult = await db.execute({
    sql: `SELECT s.*, COUNT(c.id) as cap_count
       FROM services s
       LEFT JOIN capabilities c ON c.service_id = s.id
       ${where}
       GROUP BY s.id
       ORDER BY
         CASE s.trust_level WHEN 'verified' THEN 0 WHEN 'community' THEN 1 ELSE 2 END,
         s.name ASC
       LIMIT ?`,
    args: [...likeParams, maxResults],
  });

  if (servicesResult.rows.length === 0) return [];

  const services = rowsTo<ServiceRow & { cap_count: number }>(servicesResult.rows);
  const serviceIds = services.map((s) => s.id);

  // Step 2: Fetch only matching capabilities for these services
  const capLikeConditions: string[] = [];
  const capParams: (string | number)[] = [];

  const placeholders = serviceIds.map(() => "?").join(", ");
  capParams.push(...serviceIds);

  for (const term of terms) {
    const pattern = `%${term}%`;
    capLikeConditions.push(`(c.name LIKE ? OR c.description LIKE ?)`);
    capParams.push(pattern, pattern);
  }

  const capsResult = await db.execute({
    sql: `SELECT c.* FROM capabilities c
       WHERE c.service_id IN (${placeholders})
       AND (${capLikeConditions.join(" OR ")})
       ORDER BY c.name`,
    args: capParams,
  });

  // Group matching capabilities by service_id
  const capsByService = new Map<number, CapabilityRow[]>();
  for (const row of capsResult.rows) {
    const cap = rowTo<CapabilityRow>(row);
    const list = capsByService.get(cap.service_id) ?? [];
    list.push(cap);
    capsByService.set(cap.service_id, list);
  }

  return services.map((service) => ({
    ...service,
    matching_capabilities: capsByService.get(service.id) ?? [],
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

export async function getVerifiedOnlyServices(): Promise<ServiceRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute(
    "SELECT * FROM services WHERE trust_level = 'verified' ORDER BY last_crawled_at ASC"
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

// ─── Users ────────────────────────────────────────────────────

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE stripe_customer_id = ?", args: [customerId] });
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function getUserByProvider(
  provider: string,
  providerId: string
): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE provider = ? AND provider_id = ?",
    args: [provider, providerId],
  });
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function upsertUser(data: {
  email: string;
  name?: string;
  provider: string;
  provider_id: string;
}): Promise<UserRow> {
  const db = await ensureInitialized();
  const existing = await getUserByEmail(data.email);
  if (existing) {
    // Update name and provider info on re-login
    await db.execute({
      sql: "UPDATE users SET name = COALESCE(?, name), provider = ?, provider_id = ?, updated_at = datetime('now') WHERE id = ?",
      args: [data.name ?? null, data.provider, data.provider_id, existing.id],
    });
    return (await getUserById(existing.id))!;
  }
  const result = await db.execute({
    sql: "INSERT INTO users (email, name, provider, provider_id) VALUES (?, ?, ?, ?)",
    args: [data.email, data.name ?? null, data.provider, data.provider_id],
  });
  const id = Number(result.lastInsertRowid);
  return (await getUserById(id))!;
}

export async function updateUserStripeCustomer(
  userId: number,
  stripeCustomerId: string
): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "UPDATE users SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?",
    args: [stripeCustomerId, userId],
  });
}

export async function updateUserPaymentMethod(
  userId: number,
  added: boolean
): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "UPDATE users SET payment_method_added = ?, updated_at = datetime('now') WHERE id = ?",
    args: [added ? 1 : 0, userId],
  });
}

// ─── Provider accounts ───────────────────────────────────────

export async function getProviderAccount(
  domain: string
): Promise<ProviderAccountRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM provider_accounts WHERE service_domain = ?",
    args: [domain],
  });
  return result.rows.length > 0 ? rowTo<ProviderAccountRow>(result.rows[0]) : undefined;
}

export async function getProviderAccountByStripeId(
  stripeAccountId: string
): Promise<ProviderAccountRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM provider_accounts WHERE stripe_connect_account_id = ?",
    args: [stripeAccountId],
  });
  return result.rows.length > 0 ? rowTo<ProviderAccountRow>(result.rows[0]) : undefined;
}

export async function upsertProviderAccount(data: {
  service_domain: string;
  stripe_connect_account_id: string;
}): Promise<ProviderAccountRow> {
  const db = await ensureInitialized();
  await db.execute({
    sql: `INSERT INTO provider_accounts (service_domain, stripe_connect_account_id)
          VALUES (?, ?)
          ON CONFLICT(service_domain) DO UPDATE SET stripe_connect_account_id = ?`,
    args: [data.service_domain, data.stripe_connect_account_id, data.stripe_connect_account_id],
  });
  return (await getProviderAccount(data.service_domain))!;
}

export async function updateProviderOnboarding(
  domain: string,
  complete: boolean
): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "UPDATE provider_accounts SET onboarding_complete = ? WHERE service_domain = ?",
    args: [complete ? 1 : 0, domain],
  });
}

// ─── Subscriptions ────────────────────────────────────────────

export async function getSubscriptionById(
  id: number
): Promise<SubscriptionRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({ sql: "SELECT * FROM subscriptions WHERE id = ?", args: [id] });
  return result.rows.length > 0 ? rowTo<SubscriptionRow>(result.rows[0]) : undefined;
}

export async function getSubscriptionByStripeId(
  stripeSubId: string
): Promise<SubscriptionRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM subscriptions WHERE stripe_subscription_id = ?",
    args: [stripeSubId],
  });
  return result.rows.length > 0 ? rowTo<SubscriptionRow>(result.rows[0]) : undefined;
}

export async function getUserSubscriptions(
  userId: number
): Promise<SubscriptionRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return rowsTo<SubscriptionRow>(result.rows);
}

export async function getSubscriptionsByDomain(
  domain: string
): Promise<SubscriptionRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM subscriptions WHERE service_domain = ? AND status = 'active' ORDER BY created_at DESC",
    args: [domain],
  });
  return rowsTo<SubscriptionRow>(result.rows);
}

export async function insertSubscription(data: {
  user_id: number;
  service_domain: string;
  stripe_subscription_id: string;
  plan_name: string;
  price_cents: number;
  currency: string;
  interval: string;
  status: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
}): Promise<SubscriptionRow> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: `INSERT INTO subscriptions (user_id, service_domain, stripe_subscription_id, plan_name, price_cents, currency, interval, status, current_period_start, current_period_end)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.user_id, data.service_domain, data.stripe_subscription_id,
      data.plan_name, data.price_cents, data.currency, data.interval,
      data.status, data.current_period_start ?? null, data.current_period_end ?? null,
    ],
  });
  const id = Number(result.lastInsertRowid);
  return (await getSubscriptionById(id))!;
}

export async function updateSubscriptionStatus(
  stripeSubId: string,
  status: SubscriptionStatus
): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?",
    args: [status, stripeSubId],
  });
}

export async function updateSubscriptionPeriod(
  stripeSubId: string,
  periodStart: string,
  periodEnd: string
): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: `UPDATE subscriptions SET current_period_start = ?, current_period_end = ?, updated_at = datetime('now')
          WHERE stripe_subscription_id = ?`,
    args: [periodStart, periodEnd, stripeSubId],
  });
}

// ─── Transactions ─────────────────────────────────────────────

export async function insertTransaction(data: {
  user_id: number;
  service_domain: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  status: string;
}): Promise<TransactionRow> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: `INSERT INTO transactions (user_id, service_domain, stripe_payment_intent_id, amount_cents, currency, platform_fee_cents, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.user_id, data.service_domain, data.stripe_payment_intent_id,
      data.amount_cents, data.currency, data.platform_fee_cents, data.status,
    ],
  });
  const id = Number(result.lastInsertRowid);
  const row = await db.execute({ sql: "SELECT * FROM transactions WHERE id = ?", args: [id] });
  return rowTo<TransactionRow>(row.rows[0]);
}

export async function getUserTransactions(
  userId: number,
  limit: number = 50
): Promise<TransactionRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [userId, limit],
  });
  return rowsTo<TransactionRow>(result.rows);
}

// ─── Health checks ────────────────────────────────────────────

export async function insertHealthCheck(data: {
  service_domain: string;
  status: "up" | "down" | "degraded";
  response_time_ms: number | null;
}): Promise<void> {
  const db = await ensureInitialized();
  await db.execute({
    sql: "INSERT INTO health_checks (service_domain, status, response_time_ms) VALUES (?, ?, ?)",
    args: [data.service_domain, data.status, data.response_time_ms ?? null],
  });
}

export async function cleanupOldHealthChecks(): Promise<number> {
  const db = await ensureInitialized();
  const result = await db.execute(
    "DELETE FROM health_checks WHERE checked_at < datetime('now', '-30 days')"
  );
  return result.rowsAffected;
}

export async function getLatestHealthChecks(): Promise<HealthCheckRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute(`
    SELECT h.* FROM health_checks h
    INNER JOIN (
      SELECT service_domain, MAX(checked_at) as max_checked
      FROM health_checks
      GROUP BY service_domain
    ) latest ON h.service_domain = latest.service_domain AND h.checked_at = latest.max_checked
    ORDER BY h.service_domain
  `);
  return rowsTo<HealthCheckRow>(result.rows);
}

export async function getHealthChecksByDomain(
  domain: string,
  days: number = 7
): Promise<HealthCheckRow[]> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: `SELECT * FROM health_checks
          WHERE service_domain = ? AND checked_at >= datetime('now', '-' || ? || ' days')
          ORDER BY checked_at ASC`,
    args: [domain, days],
  });
  return rowsTo<HealthCheckRow>(result.rows);
}

export async function getUptimePercentage(
  domain: string,
  days: number = 7
): Promise<number> {
  const db = await ensureInitialized();
  const result = await db.execute({
    sql: `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
          FROM health_checks
          WHERE service_domain = ? AND checked_at >= datetime('now', '-' || ? || ' days')`,
    args: [domain, days],
  });
  const total = Number(result.rows[0].total);
  if (total === 0) return 100;
  const upCount = Number(result.rows[0].up_count);
  return Math.round((upCount / total) * 10000) / 100;
}

export async function getOverallHealthStats(): Promise<{
  total_monitored: number;
  healthy: number;
  degraded: number;
  down: number;
}> {
  const db = await ensureInitialized();
  const result = await db.execute(`
    SELECT
      COUNT(DISTINCT service_domain) as total_monitored,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
      SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down
    FROM (
      SELECT h.service_domain, h.status
      FROM health_checks h
      INNER JOIN (
        SELECT service_domain, MAX(checked_at) as max_checked
        FROM health_checks
        GROUP BY service_domain
      ) latest ON h.service_domain = latest.service_domain AND h.checked_at = latest.max_checked
    )
  `);
  return {
    total_monitored: Number(result.rows[0].total_monitored) || 0,
    healthy: Number(result.rows[0].healthy) || 0,
    degraded: Number(result.rows[0].degraded) || 0,
    down: Number(result.rows[0].down) || 0,
  };
}
