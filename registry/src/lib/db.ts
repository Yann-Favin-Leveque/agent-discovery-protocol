import { Pool, type PoolClient, type QueryResultRow } from "pg";

// ─── Client singleton ────────────────────────────────────────────

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

let initPromise: Promise<Pool> | null = null;

async function ensureInitialized(): Promise<Pool> {
  const p = getPool();
  if (initialized) return p;

  if (!initPromise) {
    // In production, skip schema creation — tables already exist
    if (process.env.SKIP_SCHEMA_INIT === "true") {
      initialized = true;
      initPromise = Promise.resolve(p);
    } else {
      initPromise = initSchema(p).then(() => {
        initialized = true;
        return p;
      });
    }
  }
  return initPromise;
}

// ─── Schema ──────────────────────────────────────────────────────

async function initSchema(p: Pool) {
  const client = await p.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
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
        last_crawled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS capabilities (
        id SERIAL PRIMARY KEY,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        detail_url TEXT NOT NULL,
        detail_json JSONB,
        resource_group TEXT,
        category_slug TEXT REFERENCES categories(slug)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_domains (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        reason TEXT,
        blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        blocked_by TEXT DEFAULT 'system'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        service_domain TEXT NOT NULL,
        reporter_ip TEXT,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        domain TEXT,
        ip_address TEXT,
        details TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id SERIAL PRIMARY KEY,
        service_domain TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'up',
        response_time_ms INTEGER,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        provider TEXT NOT NULL DEFAULT 'google',
        provider_id TEXT NOT NULL,
        stripe_customer_id TEXT,
        payment_method_added INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_accounts (
        id SERIAL PRIMARY KEY,
        service_domain TEXT NOT NULL UNIQUE,
        stripe_connect_account_id TEXT NOT NULL,
        onboarding_complete INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        service_domain TEXT NOT NULL,
        stripe_subscription_id TEXT,
        plan_name TEXT NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'usd',
        interval TEXT NOT NULL DEFAULT 'month',
        status TEXT NOT NULL DEFAULT 'active',
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        service_domain TEXT NOT NULL,
        stripe_payment_intent_id TEXT,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'usd',
        platform_fee_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id SERIAL PRIMARY KEY,
        service_domain TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        redirect_uri TEXT DEFAULT 'http://localhost:9876/callback',
        extra_params JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_capabilities_service_id ON capabilities(service_id)",
      "CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category_slug)",
      "CREATE INDEX IF NOT EXISTS idx_capabilities_service_category ON capabilities(service_id, category_slug)",
      "CREATE INDEX IF NOT EXISTS idx_services_domain ON services(domain)",
      "CREATE INDEX IF NOT EXISTS idx_services_verified ON services(verified)",
      "CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_services_name ON services(name)",
      "CREATE INDEX IF NOT EXISTS idx_services_trust_level ON services(trust_level)",
      "CREATE INDEX IF NOT EXISTS idx_services_trust_created ON services(trust_level, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_services_trust_name ON services(trust_level, name ASC)",
      "CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)",
      "CREATE INDEX IF NOT EXISTS idx_audit_log_domain ON audit_log(domain)",
      "CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(service_domain)",
      "CREATE INDEX IF NOT EXISTS idx_blocked_domains_domain ON blocked_domains(domain)",
      "CREATE INDEX IF NOT EXISTS idx_health_checks_domain ON health_checks(service_domain)",
      "CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at)",
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
      "CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id)",
      "CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id)",
      "CREATE INDEX IF NOT EXISTS idx_provider_accounts_domain ON provider_accounts(service_domain)",
      "CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_subscriptions_domain ON subscriptions(service_domain)",
      "CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id)",
      "CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_transactions_domain ON transactions(service_domain)",
      "CREATE INDEX IF NOT EXISTS idx_oauth_clients_domain ON oauth_clients(service_domain)",
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    await seedCategories(client);
    await seedAgentDNS(client);
  } finally {
    client.release();
  }
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

async function seedCategories(client: PoolClient) {
  for (const cat of SEED_CATEGORIES) {
    await client.query(
      "INSERT INTO categories (name, slug) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = $2)",
      [cat.name, cat.slug]
    );
  }
}

async function seedAgentDNS(client: PoolClient) {
  const existing = await client.query(
    "SELECT id FROM services WHERE domain = $1",
    ["agent-dns.dev"]
  );
  if (existing.rows.length > 0) return;

  const insertResult = await client.query(
    `INSERT INTO services (name, domain, description, base_url, well_known_url, auth_type, auth_details, pricing_type, spec_version, verified, trust_level, last_crawled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 'verified', NOW())
     RETURNING id`,
    [
      "AgentDNS Registry",
      "agent-dns.dev",
      "The registry for the Agent Discovery Protocol. Search, discover, and verify services that implement the /.well-known/agent standard.",
      "https://agent-dns.dev",
      "https://agent-dns.dev/.well-known/agent",
      "none",
      JSON.stringify({ type: "none" }),
      "free",
      "1.0",
    ]
  );

  const serviceId = insertResult.rows[0].id as number;

  const caps = [
    { name: "discover_services", description: "Search for services by intent or keyword", detail_url: "/api/capabilities/discover_services", slug: "developer-tools" },
    { name: "list_services", description: "List all registered services with filtering and pagination", detail_url: "/api/capabilities/list_services", slug: "developer-tools" },
    { name: "submit_service", description: "Submit a new service to the registry", detail_url: "/api/capabilities/submit_service", slug: "developer-tools" },
    { name: "verify_service", description: "Trigger verification of a service's manifest", detail_url: "/api/capabilities/verify_service", slug: "developer-tools" },
  ];

  for (const cap of caps) {
    await client.query(
      `INSERT INTO capabilities (service_id, name, description, detail_url, category_slug)
       SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM capabilities WHERE service_id = $1 AND name = $2)`,
      [serviceId, cap.name, cap.description, cap.detail_url, cap.slug]
    );
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
  category_slug: string | null;
  setup_guide: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface CapabilityRow {
  id: number;
  service_id: number;
  name: string;
  description: string;
  detail_url: string;
  detail_json: unknown | null;
  resource_group: string | null;
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

function rowTo<T>(row: QueryResultRow): T {
  // Postgres returns Date objects for TIMESTAMPTZ — convert to ISO strings
  // Postgres returns bigint strings for COUNT() — convert to numbers
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      obj[key] = value.toISOString();
    } else if (key === "cap_count" || key === "count" || key === "total") {
      obj[key] = Number(value);
    } else {
      obj[key] = value;
    }
  }
  return obj as unknown as T;
}

function rowsTo<T>(rows: QueryResultRow[]): T[] {
  return rows.map((r) => rowTo<T>(r));
}

// ─── Query functions ─────────────────────────────────────────────

export async function getAllCategories(): Promise<CategoryRow[]> {
  const db = await ensureInitialized();
  const result = await db.query("SELECT * FROM categories ORDER BY name");
  return rowsTo<CategoryRow>(result.rows);
}

export async function getServiceByDomain(
  domain: string
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM services WHERE domain = $1",
    [domain]
  );
  return result.rows.length > 0 ? rowTo<ServiceRow>(result.rows[0]) : undefined;
}

export async function getCapabilitiesForService(
  serviceId: number
): Promise<CapabilityRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM capabilities WHERE service_id = $1 ORDER BY name",
    [serviceId]
  );
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
  let paramIdx = 1;

  if (!opts.include_unverified) {
    conditions.push("s.trust_level IN ('verified', 'community')");
  }

  if (opts.category && opts.category !== "all") {
    conditions.push(`s.category_slug = $${paramIdx}`);
    params.push(opts.category);
    paramIdx++;
  }

  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(`(
      s.name ILIKE $${paramIdx} OR
      s.description ILIKE $${paramIdx + 1} OR
      s.id IN (SELECT service_id FROM capabilities WHERE name ILIKE $${paramIdx + 2} OR description ILIKE $${paramIdx + 3})
    )`);
    params.push(term, term, term, term);
    paramIdx += 4;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy = "s.created_at DESC";
  if (opts.sort === "name") orderBy = "s.name ASC";
  if (opts.sort === "capabilities") orderBy = "cap_count DESC, s.name ASC";

  if (opts.include_unverified) {
    orderBy = `CASE s.trust_level WHEN 'verified' THEN 0 WHEN 'community' THEN 1 ELSE 2 END, ${orderBy}`;
  }

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const [countResult, rowsResult] = await Promise.all([
    db.query(
      `SELECT COUNT(DISTINCT s.id) as total FROM services s ${where}`,
      params
    ),
    db.query(
      `SELECT s.*, COUNT(c.id) as cap_count
       FROM services s
       LEFT JOIN capabilities c ON c.service_id = s.id
       ${where}
       GROUP BY s.id
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    ),
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

  const likeConditions: string[] = [];
  const likeParams: (string | number)[] = [];
  let paramIdx = 1;

  for (const term of terms) {
    const pattern = `%${term}%`;
    likeConditions.push(
      `(s.name ILIKE $${paramIdx} OR s.description ILIKE $${paramIdx + 1} OR s.id IN (SELECT service_id FROM capabilities WHERE name ILIKE $${paramIdx + 2} OR description ILIKE $${paramIdx + 3}))`
    );
    likeParams.push(pattern, pattern, pattern, pattern);
    paramIdx += 4;
  }

  const trustCondition = opts?.include_unverified
    ? ""
    : "s.trust_level IN ('verified', 'community')";

  const allConditions = [trustCondition, ...likeConditions].filter(Boolean);
  const where = allConditions.length > 0 ? `WHERE ${allConditions.join(" AND ")}` : "";

  const servicesResult = await db.query(
    `SELECT s.*, COUNT(c.id) as cap_count
     FROM services s
     LEFT JOIN capabilities c ON c.service_id = s.id
     ${where}
     GROUP BY s.id
     ORDER BY
       CASE s.trust_level WHEN 'verified' THEN 0 WHEN 'community' THEN 1 ELSE 2 END,
       s.name ASC
     LIMIT $${paramIdx}`,
    [...likeParams, maxResults]
  );

  if (servicesResult.rows.length === 0) return [];

  const services = rowsTo<ServiceRow & { cap_count: number }>(servicesResult.rows);
  const serviceIds = services.map((s) => s.id);

  // Step 2: Fetch matching capabilities
  const capLikeConditions: string[] = [];
  const capParams: (string | number)[] = [];
  let capParamIdx = 1;

  const placeholders = serviceIds.map(() => `$${capParamIdx++}`).join(", ");
  capParams.push(...serviceIds);

  for (const term of terms) {
    const pattern = `%${term}%`;
    capLikeConditions.push(`(c.name ILIKE $${capParamIdx} OR c.description ILIKE $${capParamIdx + 1})`);
    capParams.push(pattern, pattern);
    capParamIdx += 2;
  }

  const capsResult = await db.query(
    `SELECT c.* FROM capabilities c
     WHERE c.service_id IN (${placeholders})
     AND (${capLikeConditions.join(" OR ")})
     ORDER BY c.name`,
    capParams
  );

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
  setup_guide?: unknown;
  capabilities: Array<{
    name: string;
    description: string;
    detail_url: string;
    detail_json?: unknown;
    resource_group?: string;
    category_slug?: string;
  }>;
}): Promise<ServiceRow> {
  const db = await ensureInitialized();
  const verified = data.trust_level === "verified" ? 1 : 0;

  const insertResult = await db.query(
    `INSERT INTO services (name, domain, description, base_url, well_known_url, auth_type, auth_details, pricing_type, spec_version, verified, trust_level, setup_guide, last_crawled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     RETURNING id`,
    [
      data.name, data.domain, data.description, data.base_url,
      data.well_known_url, data.auth_type, data.auth_details,
      data.pricing_type, data.spec_version, verified, data.trust_level,
      data.setup_guide ? JSON.stringify(data.setup_guide) : null,
    ]
  );

  const serviceId = insertResult.rows[0].id as number;

  for (const cap of data.capabilities) {
    await db.query(
      "INSERT INTO capabilities (service_id, name, description, detail_url, detail_json, resource_group, category_slug) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [serviceId, cap.name, cap.description, cap.detail_url, cap.detail_json ? JSON.stringify(cap.detail_json) : null, cap.resource_group ?? null, cap.category_slug ?? null]
    );
  }

  const result = await db.query(
    "SELECT * FROM services WHERE id = $1",
    [serviceId]
  );
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
      detail_json?: unknown;
      resource_group?: string;
      category_slug?: string;
    }>;
  }
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const service = await getServiceByDomain(domain);
  if (!service) return undefined;

  await db.query(
    `UPDATE services SET
      name = $1, description = $2, base_url = $3, auth_type = $4, auth_details = $5,
      pricing_type = $6, spec_version = $7, verified = 1, trust_level = 'verified',
      crawl_failures = 0, last_crawled_at = NOW(), updated_at = NOW()
     WHERE id = $8`,
    [
      manifest.name, manifest.description, manifest.base_url,
      manifest.auth_type, manifest.auth_details, manifest.pricing_type,
      manifest.spec_version, service.id,
    ]
  );

  await db.query(
    "DELETE FROM capabilities WHERE service_id = $1",
    [service.id]
  );

  for (const cap of manifest.capabilities) {
    await db.query(
      "INSERT INTO capabilities (service_id, name, description, detail_url, detail_json, resource_group, category_slug) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [service.id, cap.name, cap.description, cap.detail_url, cap.detail_json ? JSON.stringify(cap.detail_json) : null, cap.resource_group ?? null, cap.category_slug ?? null]
    );
  }

  const result = await db.query(
    "SELECT * FROM services WHERE id = $1",
    [service.id]
  );
  return rowTo<ServiceRow>(result.rows[0]);
}

export async function getCapabilityDetail(
  domain: string,
  capabilityName: string
): Promise<CapabilityRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    `SELECT c.* FROM capabilities c
     JOIN services s ON s.id = c.service_id
     WHERE s.domain = $1 AND c.name = $2`,
    [domain, capabilityName]
  );
  if (result.rows.length === 0) return undefined;
  return rowTo<CapabilityRow>(result.rows[0]);
}

export async function upsertCapabilityDetail(
  serviceId: number,
  capabilityName: string,
  detailJson: unknown
): Promise<boolean> {
  const db = await ensureInitialized();
  const result = await db.query(
    "UPDATE capabilities SET detail_json = $1 WHERE service_id = $2 AND name = $3",
    [JSON.stringify(detailJson), serviceId, capabilityName]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function replaceServiceCapabilities(
  domain: string,
  manifest: {
    name: string;
    description: string;
    base_url: string;
    auth_type: string;
    auth_details: string;
    pricing_type: string;
    spec_version: string;
  },
  capabilities: Array<{
    name: string;
    description: string;
    detail_url: string;
    detail_json?: unknown;
    resource_group?: string;
    category_slug?: string;
  }>,
  trustLevel?: string
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const service = await getServiceByDomain(domain);
  if (!service) return undefined;

  await db.query(
    `UPDATE services SET
      name = $1, description = $2, base_url = $3, auth_type = $4, auth_details = $5,
      pricing_type = $6, spec_version = $7, updated_at = NOW()
      ${trustLevel ? ", trust_level = $9" : ""}
     WHERE id = $8`,
    trustLevel
      ? [manifest.name, manifest.description, manifest.base_url, manifest.auth_type, manifest.auth_details, manifest.pricing_type, manifest.spec_version, service.id, trustLevel]
      : [manifest.name, manifest.description, manifest.base_url, manifest.auth_type, manifest.auth_details, manifest.pricing_type, manifest.spec_version, service.id]
  );

  await db.query("DELETE FROM capabilities WHERE service_id = $1", [service.id]);

  for (const cap of capabilities) {
    await db.query(
      "INSERT INTO capabilities (service_id, name, description, detail_url, detail_json, resource_group, category_slug) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [service.id, cap.name, cap.description, cap.detail_url, cap.detail_json ? JSON.stringify(cap.detail_json) : null, cap.resource_group ?? null, cap.category_slug ?? null]
    );
  }

  const result = await db.query("SELECT * FROM services WHERE id = $1", [service.id]);
  return rowTo<ServiceRow>(result.rows[0]);
}

export async function getTrustedServices(): Promise<ServiceRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM services WHERE trust_level IN ('verified', 'community') ORDER BY last_crawled_at ASC"
  );
  return rowsTo<ServiceRow>(result.rows);
}

export async function getVerifiedOnlyServices(): Promise<ServiceRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM services WHERE trust_level = 'verified' ORDER BY last_crawled_at ASC"
  );
  return rowsTo<ServiceRow>(result.rows);
}

export const getVerifiedServices = getTrustedServices;

export async function incrementCrawlFailure(domain: string): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "UPDATE services SET crawl_failures = crawl_failures + 1, updated_at = NOW() WHERE domain = $1",
    [domain]
  );
}

export async function markUnreachable(domain: string): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "UPDATE services SET verified = 0, trust_level = 'unverified', updated_at = NOW() WHERE domain = $1",
    [domain]
  );
}

export async function updateServiceTrustLevel(
  domain: string,
  trustLevel: TrustLevel
): Promise<ServiceRow | undefined> {
  const db = await ensureInitialized();
  const verified = trustLevel === "verified" ? 1 : 0;
  await db.query(
    "UPDATE services SET trust_level = $1, verified = $2, updated_at = NOW() WHERE domain = $3",
    [trustLevel, verified, domain]
  );
  return getServiceByDomain(domain);
}

export async function deleteService(domain: string): Promise<boolean> {
  const db = await ensureInitialized();
  const service = await getServiceByDomain(domain);
  if (!service) return false;
  await db.query("DELETE FROM capabilities WHERE service_id = $1", [service.id]);
  await db.query("DELETE FROM services WHERE id = $1", [service.id]);
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
    db.query("SELECT COUNT(*) as count FROM services"),
    db.query("SELECT COUNT(*) as count FROM capabilities"),
    db.query("SELECT COUNT(*) as count FROM services WHERE trust_level = 'verified'"),
    db.query("SELECT COUNT(*) as count FROM services WHERE trust_level = 'community'"),
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
  const result = await db.query(
    "SELECT 1 FROM blocked_domains WHERE domain = $1",
    [domain]
  );
  return result.rows.length > 0;
}

export async function blockDomain(
  domain: string,
  reason: string,
  blockedBy: string = "admin"
): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "INSERT INTO blocked_domains (domain, reason, blocked_by) VALUES ($1, $2, $3) ON CONFLICT (domain) DO NOTHING",
    [domain, reason, blockedBy]
  );
}

export async function getBlockedDomains(): Promise<BlockedDomainRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
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
  const result = await db.query(
    "INSERT INTO reports (service_domain, reporter_ip, reason) VALUES ($1, $2, $3) RETURNING *",
    [data.service_domain, data.reporter_ip, data.reason]
  );
  return rowTo<ReportRow>(result.rows[0]);
}

export async function getReports(opts?: {
  status?: "pending" | "resolved";
  limit?: number;
  offset?: number;
}): Promise<{ reports: ReportRow[]; total: number }> {
  const db = await ensureInitialized();
  const conditions: string[] = [];

  if (opts?.status === "pending") {
    conditions.push("resolved = 0");
  } else if (opts?.status === "resolved") {
    conditions.push("resolved = 1");
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM reports ${where}`
  );
  const total = Number(countResult.rows[0].total);

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await db.query(
    `SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { reports: rowsTo<ReportRow>(result.rows), total };
}

export async function resolveReport(id: number): Promise<void> {
  const db = await ensureInitialized();
  await db.query("UPDATE reports SET resolved = 1 WHERE id = $1", [id]);
}

// ─── Audit log ───────────────────────────────────────────────────

export async function logAudit(entry: {
  action: string;
  domain?: string;
  ip_address?: string;
  details?: string;
}): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "INSERT INTO audit_log (action, domain, ip_address, details) VALUES ($1, $2, $3, $4)",
    [entry.action, entry.domain ?? null, entry.ip_address ?? null, entry.details ?? null]
  );
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
  let paramIdx = 1;

  if (opts?.action) {
    conditions.push(`action = $${paramIdx}`);
    params.push(opts.action);
    paramIdx++;
  }
  if (opts?.domain) {
    conditions.push(`domain = $${paramIdx}`);
    params.push(opts.domain);
    paramIdx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM audit_log ${where}`,
    params
  );
  const total = Number(countResult.rows[0].total);

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const result = await db.query(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return { entries: rowsTo<AuditLogRow>(result.rows), total };
}

// ─── Users ────────────────────────────────────────────────────

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query("SELECT * FROM users WHERE stripe_customer_id = $1", [customerId]);
  return result.rows.length > 0 ? rowTo<UserRow>(result.rows[0]) : undefined;
}

export async function getUserByProvider(
  provider: string,
  providerId: string
): Promise<UserRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM users WHERE provider = $1 AND provider_id = $2",
    [provider, providerId]
  );
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
    await db.query(
      "UPDATE users SET name = COALESCE($1, name), provider = $2, provider_id = $3, updated_at = NOW() WHERE id = $4",
      [data.name ?? null, data.provider, data.provider_id, existing.id]
    );
    return (await getUserById(existing.id))!;
  }
  const result = await db.query(
    "INSERT INTO users (email, name, provider, provider_id) VALUES ($1, $2, $3, $4) RETURNING id",
    [data.email, data.name ?? null, data.provider, data.provider_id]
  );
  const id = Number(result.rows[0].id);
  return (await getUserById(id))!;
}

export async function updateUserStripeCustomer(
  userId: number,
  stripeCustomerId: string
): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2",
    [stripeCustomerId, userId]
  );
}

export async function updateUserPaymentMethod(
  userId: number,
  added: boolean
): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "UPDATE users SET payment_method_added = $1, updated_at = NOW() WHERE id = $2",
    [added ? 1 : 0, userId]
  );
}

// ─── Provider accounts ───────────────────────────────────────

export async function getProviderAccount(
  domain: string
): Promise<ProviderAccountRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM provider_accounts WHERE service_domain = $1",
    [domain]
  );
  return result.rows.length > 0 ? rowTo<ProviderAccountRow>(result.rows[0]) : undefined;
}

export async function getProviderAccountByStripeId(
  stripeAccountId: string
): Promise<ProviderAccountRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM provider_accounts WHERE stripe_connect_account_id = $1",
    [stripeAccountId]
  );
  return result.rows.length > 0 ? rowTo<ProviderAccountRow>(result.rows[0]) : undefined;
}

export async function upsertProviderAccount(data: {
  service_domain: string;
  stripe_connect_account_id: string;
}): Promise<ProviderAccountRow> {
  const db = await ensureInitialized();
  await db.query(
    `INSERT INTO provider_accounts (service_domain, stripe_connect_account_id)
     VALUES ($1, $2)
     ON CONFLICT(service_domain) DO UPDATE SET stripe_connect_account_id = $2`,
    [data.service_domain, data.stripe_connect_account_id]
  );
  return (await getProviderAccount(data.service_domain))!;
}

export async function updateProviderOnboarding(
  domain: string,
  complete: boolean
): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "UPDATE provider_accounts SET onboarding_complete = $1 WHERE service_domain = $2",
    [complete ? 1 : 0, domain]
  );
}

// ─── Subscriptions ────────────────────────────────────────────

export async function getSubscriptionById(
  id: number
): Promise<SubscriptionRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query("SELECT * FROM subscriptions WHERE id = $1", [id]);
  return result.rows.length > 0 ? rowTo<SubscriptionRow>(result.rows[0]) : undefined;
}

export async function getSubscriptionByStripeId(
  stripeSubId: string
): Promise<SubscriptionRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM subscriptions WHERE stripe_subscription_id = $1",
    [stripeSubId]
  );
  return result.rows.length > 0 ? rowTo<SubscriptionRow>(result.rows[0]) : undefined;
}

export async function getUserSubscriptions(
  userId: number
): Promise<SubscriptionRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rowsTo<SubscriptionRow>(result.rows);
}

export async function getSubscriptionsByDomain(
  domain: string
): Promise<SubscriptionRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM subscriptions WHERE service_domain = $1 AND status = 'active' ORDER BY created_at DESC",
    [domain]
  );
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
  const result = await db.query(
    `INSERT INTO subscriptions (user_id, service_domain, stripe_subscription_id, plan_name, price_cents, currency, interval, status, current_period_start, current_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      data.user_id, data.service_domain, data.stripe_subscription_id,
      data.plan_name, data.price_cents, data.currency, data.interval,
      data.status, data.current_period_start ?? null, data.current_period_end ?? null,
    ]
  );
  const id = Number(result.rows[0].id);
  return (await getSubscriptionById(id))!;
}

export async function updateSubscriptionStatus(
  stripeSubId: string,
  status: SubscriptionStatus
): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2",
    [status, stripeSubId]
  );
}

export async function updateSubscriptionPeriod(
  stripeSubId: string,
  periodStart: string,
  periodEnd: string
): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    `UPDATE subscriptions SET current_period_start = $1, current_period_end = $2, updated_at = NOW()
     WHERE stripe_subscription_id = $3`,
    [periodStart, periodEnd, stripeSubId]
  );
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
  const result = await db.query(
    `INSERT INTO transactions (user_id, service_domain, stripe_payment_intent_id, amount_cents, currency, platform_fee_cents, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.user_id, data.service_domain, data.stripe_payment_intent_id,
      data.amount_cents, data.currency, data.platform_fee_cents, data.status,
    ]
  );
  return rowTo<TransactionRow>(result.rows[0]);
}

export async function getUserTransactions(
  userId: number,
  limit: number = 50
): Promise<TransactionRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return rowsTo<TransactionRow>(result.rows);
}

// ─── Health checks ────────────────────────────────────────────

export async function insertHealthCheck(data: {
  service_domain: string;
  status: "up" | "down" | "degraded";
  response_time_ms: number | null;
}): Promise<void> {
  const db = await ensureInitialized();
  await db.query(
    "INSERT INTO health_checks (service_domain, status, response_time_ms) VALUES ($1, $2, $3)",
    [data.service_domain, data.status, data.response_time_ms ?? null]
  );
}

export async function cleanupOldHealthChecks(): Promise<number> {
  const db = await ensureInitialized();
  const result = await db.query(
    "DELETE FROM health_checks WHERE checked_at < NOW() - INTERVAL '30 days'"
  );
  return result.rowCount ?? 0;
}

export async function getLatestHealthChecks(): Promise<HealthCheckRow[]> {
  const db = await ensureInitialized();
  const result = await db.query(`
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
  const result = await db.query(
    `SELECT * FROM health_checks
     WHERE service_domain = $1 AND checked_at >= NOW() - CAST($2 || ' days' AS INTERVAL)
     ORDER BY checked_at ASC`,
    [domain, days]
  );
  return rowsTo<HealthCheckRow>(result.rows);
}

export async function getUptimePercentage(
  domain: string,
  days: number = 7
): Promise<number> {
  const db = await ensureInitialized();
  const result = await db.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
     FROM health_checks
     WHERE service_domain = $1 AND checked_at >= NOW() - CAST($2 || ' days' AS INTERVAL)`,
    [domain, days]
  );
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
  const result = await db.query(`
    SELECT
      COUNT(DISTINCT service_domain) as total_monitored,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
      SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down
    FROM (
      SELECT h.service_domain, h.status
      FROM health_checks h
      INNER JOIN services s ON s.domain = h.service_domain AND s.trust_level = 'verified'
      INNER JOIN (
        SELECT service_domain, MAX(checked_at) as max_checked
        FROM health_checks
        GROUP BY service_domain
      ) latest ON h.service_domain = latest.service_domain AND h.checked_at = latest.max_checked
    ) sub
  `);
  return {
    total_monitored: Number(result.rows[0].total_monitored) || 0,
    healthy: Number(result.rows[0].healthy) || 0,
    degraded: Number(result.rows[0].degraded) || 0,
    down: Number(result.rows[0].down) || 0,
  };
}

// ─── OAuth Clients ──────────────────────────────────────────────

export interface OAuthClientRow {
  id: number;
  service_domain: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  extra_params: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function getOAuthClient(domain: string): Promise<OAuthClientRow | undefined> {
  const db = await ensureInitialized();
  const result = await db.query(
    "SELECT * FROM oauth_clients WHERE service_domain = $1",
    [domain]
  );
  return result.rows.length > 0 ? rowTo<OAuthClientRow>(result.rows[0]) : undefined;
}

export async function upsertOAuthClient(
  domain: string,
  clientId: string,
  clientSecret: string,
  redirectUri?: string,
  extraParams?: Record<string, unknown>
): Promise<OAuthClientRow> {
  const db = await ensureInitialized();
  const result = await db.query(
    `INSERT INTO oauth_clients (service_domain, client_id, client_secret, redirect_uri, extra_params)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (service_domain)
     DO UPDATE SET client_id = $2, client_secret = $3, redirect_uri = COALESCE($4, oauth_clients.redirect_uri),
       extra_params = COALESCE($5, oauth_clients.extra_params), updated_at = NOW()
     RETURNING *`,
    [domain, clientId, clientSecret, redirectUri ?? "http://localhost:9876/callback", extraParams ? JSON.stringify(extraParams) : null]
  );
  return rowTo<OAuthClientRow>(result.rows[0]);
}

export async function getAllOAuthClients(): Promise<OAuthClientRow[]> {
  const db = await ensureInitialized();
  const result = await db.query("SELECT * FROM oauth_clients ORDER BY service_domain");
  return result.rows.map(r => rowTo<OAuthClientRow>(r));
}

export async function deleteOAuthClient(domain: string): Promise<boolean> {
  const db = await ensureInitialized();
  const result = await db.query("DELETE FROM oauth_clients WHERE service_domain = $1", [domain]);
  return (result.rowCount ?? 0) > 0;
}
