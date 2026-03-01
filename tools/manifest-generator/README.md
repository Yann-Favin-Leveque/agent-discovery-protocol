# Manifest Generator

Converts existing API documentation (OpenAPI specs, Swagger files, or raw doc URLs) into valid [Agent Discovery Protocol](../../spec/) manifests and capability detail files.

## Quick Start

```bash
cd tools/manifest-generator
npm install

# Convert a single OpenAPI spec
npx tsx src/convert-openapi.ts \
  --input https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json \
  --output ./manifests/api.stripe.com/ \
  --domain api.stripe.com

# Scrape docs for APIs without OpenAPI specs
npx tsx src/scrape-docs.ts \
  --url https://docs.resend.com/api-reference \
  --domain resend.com \
  --output ./manifests/resend.com/

# Run the full pipeline
npx tsx src/batch-generate.ts \
  --catalog catalog.yaml \
  --output ./manifests/ \
  --concurrency 5
```

## Pipeline Overview

```
catalog.yaml          List of 200+ APIs with spec/doc URLs
      │
      ▼
batch-generate.ts     Processes each API through the right converter
      │
      ├── convert-openapi.ts    For OpenAPI 3.x, Swagger 2.x, Google Discovery
      └── scrape-docs.ts        For raw doc pages (uses Claude API)
      │
      ▼
manifests/{domain}/   Generated manifest + capability detail files
      │
      ▼
quality-check.ts      Validates quality, scores each manifest
      │
      ▼
import-to-registry.ts Submits to the registry
```

## Tools

### 1. `convert-openapi.ts` — OpenAPI/Swagger Converter

Converts OpenAPI 3.x, Swagger 2.x, and Google Discovery specs into manifests.

```bash
npx tsx src/convert-openapi.ts \
  --input <file-or-url>      # OpenAPI spec (JSON/YAML) \
  --output <dir>              # Output directory \
  --domain <domain>           # Service domain \
  [--rewrite]                 # Use Claude API to improve descriptions
```

**Conversion logic:**
- Groups endpoints by OpenAPI tags or first path segment
- Selects 3-5 most important endpoints per capability (prioritizes POST/PUT for actions, GET for reads)
- Maps `securitySchemes` to `oauth2`, `api_key`, or `none`
- Generates request/response examples from spec examples or sensible defaults
- Caps at 12 capabilities per service

### 2. `scrape-docs.ts` — Documentation Scraper

Fallback for APIs without public OpenAPI specs. Uses the Anthropic API (Claude) to read doc pages and extract structured information.

```bash
npx tsx src/scrape-docs.ts \
  --url <doc-url>             # Documentation page URL \
  --domain <domain>           # Service domain \
  --output <dir>              # Output directory
```

**Requirements:** Set the `ANTHROPIC_API_KEY` environment variable.

### 3. `batch-generate.ts` — Batch Runner

Processes the full API catalog.

```bash
npx tsx src/batch-generate.ts \
  --catalog <path>            # Path to catalog.yaml \
  --output <dir>              # Output directory \
  [--concurrency <n>]         # Max parallel operations (default: 5) \
  [--skip-existing]           # Skip APIs with existing manifests \
  [--category <cat>]          # Only process one category \
  [--rewrite]                 # Use Claude API for descriptions
```

Outputs a `_report.json` with success/failure counts.

### 4. `quality-check.ts` — Quality Validator

Checks generated manifests against quality rules.

```bash
npx tsx src/quality-check.ts \
  --manifests <dir>           # Directory with generated manifests \
  [--min-score <n>]           # Minimum passing score, 0-100 (default: 60)
```

**Quality rules (100 points):**
| Category | Points | Criteria |
|----------|--------|----------|
| Schema validity | 20 | Passes spec validation |
| Description quality | 15 | 50-500 chars, conversational tone, 2-3 sentences |
| Capability count | 15 | 3-8 capabilities per service |
| Capability descriptions | 15 | 20-300 chars, intent-based names |
| Auth completeness | 10 | All required auth fields present |
| Detail files | 25 | Endpoint, method, parameters, examples |

### 5. `import-to-registry.ts` — Registry Import

Submits manifests to the registry.

```bash
npx tsx src/import-to-registry.ts \
  --manifests <dir>           # Directory with manifests \
  --registry <url>            # Registry URL (e.g. http://localhost:3000) \
  [--tag <tag>]               # Tag for imports (default: "community") \
  [--dry-run]                 # Validate only, don't submit
```

## Output Structure

Each API gets its own directory:

```
manifests/api.stripe.com/
├── manifest.json            # The /.well-known/agent manifest
└── capabilities/
    ├── payments.json        # Capability detail
    ├── invoicing.json
    └── subscriptions.json
```

## Adding a New API

1. Edit `catalog.yaml` and add an entry:

```yaml
- domain: api.example.com
  category: productivity      # Choose from existing categories
  openapi: https://...        # OpenAPI spec URL (preferred)
  # OR
  docs: https://...           # Documentation URL (fallback)
  name: Example API           # Optional display name
```

2. Run the converter:

```bash
# Single API
npx tsx src/convert-openapi.ts \
  --input https://api.example.com/openapi.json \
  --output ./manifests/api.example.com/ \
  --domain api.example.com

# Or batch (only new ones)
npx tsx src/batch-generate.ts \
  --catalog catalog.yaml \
  --output ./manifests/ \
  --skip-existing
```

3. Check quality:

```bash
npx tsx src/quality-check.ts --manifests ./manifests/
```

4. Fix any issues flagged in the quality report, then submit a PR.

## Quality Standards for Manifests

All manifests must meet these criteria:

- **Description**: 2-3 conversational sentences. No jargon like "RESTful API" or "CRUD operations". Write as if explaining to a smart assistant.
- **Capabilities**: 3-8 per service. Each represents a user intent (e.g., `send_email`), not a raw endpoint (`post_v1_messages`).
- **Capability descriptions**: 1-2 sentences explaining what it does and when to use it.
- **Parameters**: Human-readable descriptions. `"The recipient's email address"` not `"string, required"`.
- **Examples**: Every capability detail must have at least one request/response example with realistic data.
- **Auth**: Complete — OAuth2 needs both URLs, API key needs the header name.

## Contributing

1. Fork the repo
2. Add your API to `catalog.yaml` with the correct category and spec/doc URL
3. Run the generator and quality check
4. Submit a PR with the catalog update (generated manifests are not committed — they're built by CI)

### Finding OpenAPI Specs

Many APIs publish their OpenAPI specs on GitHub. Search for:
- `{service} openapi github`
- `{service} swagger spec`
- Look in the API's developer docs for a "Download OpenAPI spec" link
- Check `https://api.apis.guru/v2/list.json` for a crowd-sourced index

### Categories

`email` `payments` `storage` `productivity` `communication` `developer-tools` `crm` `analytics` `ai-ml` `e-commerce` `social` `location` `auth` `media` `finance` `hr` `support` `marketing` `iot` `health` `weather` `legal` `education` `search` `database` `forms` `dns` `security` `notifications` `cms` `translation` `documents`
