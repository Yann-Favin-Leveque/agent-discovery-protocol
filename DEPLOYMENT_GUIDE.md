# Deployment Guide

## Registry (agent-dns.dev)

The registry auto-deploys on every push to main via Vercel.

**After modifying anything in /registry/:**
```bash
git add -A
git commit -m "description of changes"
git push origin main
# Vercel auto-builds and deploys in ~2 minutes
# Check: https://agent-dns.dev
```

**Environment variables (Vercel → Settings → Environment Variables):**
- TURSO_DATABASE_URL — Turso database URL
- TURSO_AUTH_TOKEN — Turso auth token (read+write)
- ADMIN_SECRET — random secret for admin API routes
- CRON_SECRET — random secret for cron endpoints
- STRIPE_SECRET_KEY — Stripe secret key (when payments enabled)
- STRIPE_PUBLISHABLE_KEY — Stripe publishable key
- STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — same as publishable key (client-side)

**Verify deployment:**
```bash
curl https://agent-dns.dev/.well-known/agent
curl https://agent-dns.dev/api/discover?q=email
```

### Health Check Cron

The registry runs hourly health checks on verified services via `/api/cron/recrawl`.

**Vercel cron (configured in `registry/vercel.json`):**
- Runs on the schedule defined in `vercel.json` (hourly: `0 * * * *`)
- On the free plan, Vercel cron jobs run **once per day** regardless of the schedule
- The `CRON_SECRET` env var must be set in Vercel for authentication

**For true hourly checks, use an external cron service (e.g. cron-job.org):**
1. Create a free account at [cron-job.org](https://cron-job.org)
2. Create a new cron job with:
   - **URL:** `https://agent-dns.dev/api/cron/recrawl`
   - **Schedule:** Every hour (`0 * * * *`)
   - **HTTP Method:** GET
   - **Headers:** `Authorization: Bearer {CRON_SECRET}` (use the same value as the Vercel env var)
3. Save and enable the cron job

**Manual trigger:**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://agent-dns.dev/api/cron/recrawl
```

---

## Gateway MCP (npm: agent-gateway-mcp)

The gateway is published on npm. It does NOT auto-deploy — you must manually publish.

**After modifying anything in /gateway-mcp/:**
```bash
cd gateway-mcp

# 1. Build
npm run build

# 2. Test
npm run start  # quick smoke test, Ctrl+C to stop

# 3. Bump version
npm version patch   # 0.1.0 → 0.1.1 (use "minor" for new features, "major" for breaking changes)

# 4. Publish
npm publish --access public

# 5. Commit the version bump
cd ..
git add -A
git commit -m "gateway-mcp v0.1.1"
git push origin main
```

**Verify:**
```bash
npx agent-gateway-mcp@latest  # should use the new version
```

**Version bumping rules:**
- `npm version patch` — bug fixes, small tweaks (0.1.0 → 0.1.1)
- `npm version minor` — new features, new tools (0.1.1 → 0.2.0)
- `npm version major` — breaking changes (0.2.0 → 1.0.0)

---

## SDK Packages

Each SDK is an independent package in /sdks/. Same manual publish flow as the gateway.

### Express.js (npm: agent-well-known-express)
```bash
cd sdks/express
npm run build
npm version patch
npm publish --access public
cd ../..
git add -A && git commit -m "sdk express v0.1.1" && git push
```

### FastAPI (PyPI: agent-well-known-fastapi)
```bash
cd sdks/fastapi
python -m build
twine upload dist/*
cd ../..
git add -A && git commit -m "sdk fastapi v0.1.1" && git push
```

### Next.js (npm: agent-well-known-next)
```bash
cd sdks/nextjs
npm run build
npm version patch
npm publish --access public
cd ../..
git add -A && git commit -m "sdk nextjs v0.1.1" && git push
```

### Spring Boot (Maven Central: agent-well-known-spring-boot)
```bash
cd sdks/spring-boot
mvn clean deploy
cd ../..
git add -A && git commit -m "sdk spring-boot v0.1.1" && git push
```

---

## Manifest Generator (internal tool, not published)

Used to generate and import community manifests. No deployment needed — runs locally.
```bash
cd tools/manifest-generator
npm install
npx tsc

# Generate manifests
npx ts-node src/batch-generate.ts --catalog catalog.yaml --output ./manifests/ --concurrency 5 --skip-existing

# Quality check
npx ts-node src/quality-check.ts --manifests ./manifests/

# Import to production
npx ts-node src/import-to-registry.ts --manifests ./manifests/ --registry https://agent-dns.dev --tag community
```

---

## Quick Reference

| Component | Location | Deploy method | Auto-deploy? |
|-----------|----------|--------------|-------------|
| Registry | /registry | git push → Vercel | Yes |
| Gateway MCP | /gateway-mcp | npm publish | Manual |
| SDK Express | /sdks/express | npm publish | Manual |
| SDK FastAPI | /sdks/fastapi | twine upload | Manual |
| SDK Next.js | /sdks/nextjs | npm publish | Manual |
| SDK Spring Boot | /sdks/spring-boot | mvn deploy | Manual |
| Manifest generator | /tools/manifest-generator | N/A (local tool) | N/A |

---

## Troubleshooting

**Vercel build fails:**
- Check build logs in Vercel dashboard → Deployments → click failed deploy
- Common issue: DB seed conflicts (use INSERT OR IGNORE)
- Common issue: missing env vars

**npm publish fails with 403:**
- Need 2FA or granular access token on npmjs.com
- Use: npm publish --access public --otp=YOUR_CODE

**Registry API returns 500:**
- Check Vercel function logs: Vercel dashboard → Logs
- Likely a Turso connection issue — verify env vars

**Gateway can't reach registry:**
- Check --registry URL in MCP config
- Verify https://agent-dns.dev/api/discover responds
