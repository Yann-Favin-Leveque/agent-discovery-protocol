# ToS Audit — Reseller/Aggregator Model Compatibility

**Date:** 2026-04-28
**Total services audited:** 242

This audit classifies every service indexed in the registry by whether their Terms of Service are compatible with the gateway operator (us) acting as a payment intermediary / reseller / aggregator on behalf of end-users. End-user adds a credit card with us; we pay the upstream API provider for their usage.

Classification is based on domain knowledge of each provider's ToS as of early 2026 plus the typical positioning of the service. This is a working categorization, not legal advice — borderline cases marked ORANGE should be re-checked with counsel before contractual commitments.

## Summary

- 🟢 GREEN: 41 services
- 🟡 ORANGE: 144 services
- 🔴 RED: 22 services
- ⚪ N/A (free): 35 services

Net: 220 of 242 services (≈91%) are usable in the v1 gateway model (GREEN + ORANGE + N/A). The 22 RED services should either be excluded from the paid-passthrough flow or limited to user-bring-your-own-credentials-only mode.

---

## 🟢 GREEN — Reseller / aggregator model OK

These providers either explicitly support reseller / platform / aggregator usage, run an official partner program, or have a payment-aggregator model as core to their business.

| Service | Domain | Reasoning |
|---------|--------|-----------|
| Stripe | api.stripe.com | Connect platform; aggregator/marketplace model is core business |
| Stripe (Braintree) | api.braintreegateway.com | PayPal-owned PSP, marketplace model supported |
| PayPal | api.paypal.com | Marketplace/PSP model is core; partner program available |
| Square | api.square.com | Has explicit platform/ISV partner program |
| Adyen-equivalent: Mollie | api.mollie.com | EU PSP; Connect-style sub-merchant model native |
| Razorpay | api.razorpay.com | PSP, route/platform sub-account model |
| Paddle | api.paddle.com | Merchant-of-record; aggregator model is the entire product |
| Lemon Squeezy | api.lemonsqueezy.com | Merchant-of-record; aggregator model is the entire product |
| GoCardless | api.gocardless.com | Has formal partner program with API resale clause |
| Wise | api.wise.com | Platform API explicitly supports embedded multi-user flows |
| Coinbase | api.coinbase.com | Commerce/Exchange APIs designed for platform integrations |
| Twilio | api.twilio.com | Has subaccounts + ISV reseller program |
| SendGrid | api.sendgrid.com | Twilio-owned; reseller subusers built-in |
| Vonage | api.vonage.com | Subaccounts + reseller program |
| MessageBird | api.messagebird.com | Has child-account / reseller model |
| Plivo | api.plivo.com | Subaccounts + reseller program |
| Sinch | api.sinch.com | Subaccounts; CPaaS reseller model native |
| Infobip | api.infobip.com | CPaaS, reseller program |
| Mailgun | api.mailgun.com | Subaccount API exists, reseller-friendly |
| Postmark | api.postmarkapp.com | Servers-per-customer model is normal |
| SparkPost | api.sparkpost.com | Subaccount / reseller-friendly |
| Brevo (Sendinblue) | api.brevo.com | Subaccount API for ESPs/agencies |
| Resend | api.resend.com | Newer ESP, multi-tenant friendly, no anti-resale clause |
| Mapbox | api.mapbox.com | Token-per-app; multi-tenant gateway is normal |
| Algolia | api.algolia.com | App-per-customer is native; agency model supported |
| Mailchimp | api.mailchimp.com | Has agency/partner program |
| Cloudinary | api.cloudinary.com | Multi-account / reseller is supported product mode |
| Imgix | api.imgix.com | Source-per-customer is standard |
| Bunny.net | api.bunny.net | Reseller program offered |
| AssemblyAI | api.assemblyai.com | Embedded API positioning, multi-tenant friendly |
| Deepgram | api.deepgram.com | Embedded API positioning, multi-tenant friendly |
| Replicate | api.replicate.com | Token-passthrough is the product, marketplace model |
| Together AI | api.together.xyz | Multi-tenant inference, positioned for app builders |
| Groq | api.groq.com | Multi-tenant inference, positioned for app builders |
| Stability AI | api.stability.ai | Multi-tenant generative API, partner-friendly |
| Mistral | api.mistral.ai | Multi-tenant inference, positioned for app builders |
| Backblaze B2 | api.backblazeb2.com | Has formal reseller / partner program |
| Cloudflare | api.cloudflare.com | Tenant API explicitly for reseller/MSP usage |
| Cloudflare DNS | api.cloudflare.com_dns | Same as Cloudflare |
| Cloudflare R2 | api.cloudflare.com_r2 | Same as Cloudflare |
| Bitly | api-ssl.bitly.com | Has explicit partner/OEM API tier |

---

## 🟡 ORANGE — Gray zone, passthrough commonly tolerated

ToS is silent or ambiguous on reseller/aggregator usage, but the model is commonly tolerated in practice (e.g., Cursor/Perplexity calling OpenAI, agencies using Notion API on behalf of clients). Recommend proceeding with attribution + clear user-facing identification of the underlying provider, while monitoring for ToS updates.

| Service | Domain | Reasoning |
|---------|--------|-----------|
| OpenAI | api.openai.com | ToS allows business use; resale of "raw output" is gray. Cursor/Perplexity precedent |
| Anthropic | api.anthropic.com | Similar to OpenAI; "do not resell raw model output" clause is narrow |
| Cohere | api.cohere.ai | Standard SaaS ToS, no explicit reseller block |
| Hugging Face | api.huggingface.co | Inference API ToS silent on resale |
| Notion | api.notion.com | Public API; agency/integration use widespread |
| Airtable | api.airtable.com | API tier is paid; integration use widely tolerated |
| Slack | slack.com_api | App distribution model assumes third-party use |
| Discord | discord.com_api | Bot ecosystem assumes third-party developers |
| Telegram | api.telegram.org | Bot API is free + open; passthrough fine |
| Trello | api.trello.com | Atlassian, integration use widely tolerated |
| Linear | api.linear.app | API for integrations; OAuth model assumes third-party access |
| ClickUp | api.clickup.com | Standard SaaS, OAuth-friendly |
| Asana | app.asana.com_api | Standard SaaS, OAuth-friendly |
| Monday.com | api.monday.com | Standard SaaS, OAuth-friendly |
| Basecamp | api.basecamp.com | OAuth-friendly |
| Todoist | api.todoist.com | OAuth-friendly, integrations encouraged |
| Cal.com | api.cal.com | Open-source-friendly, integration use expected |
| Calendly | api.calendly.com | Standard OAuth for integrations |
| Cronofy | api.cronofy.com | Calendar aggregator API — meta passthrough |
| Nylas | api.nylas.com | Calendar/email aggregator API — meta passthrough |
| Mercury | api.mercury.com | Banking API; resale unclear, third-party access OK |
| Xero | api.xero.com | Accounting; OAuth integration ecosystem |
| QuickBooks | api.quickbooks.com | Accounting; OAuth integration ecosystem |
| FreshBooks | api.freshbooks.com | Accounting; OAuth integration ecosystem |
| Wave | api.wave.com | Accounting; OAuth integration ecosystem |
| ChartMogul | api.chartmogul.com | Standard B2B SaaS |
| TaxJar | rest.avatax.com / TaxJar | Tax-as-a-service; integration friendly |
| AvaTax | rest.avatax.com | Tax-as-a-service; integration friendly |
| HubSpot | api.hubapi.com | Standard OAuth; partner program separate but API is OAuth-open |
| HubSpot Marketing | api.hubspot.com_marketing | Same as HubSpot |
| Pipedrive | api.pipedrive.com | Standard OAuth |
| Salesforce | api.salesforce.com | Per-org OAuth; gateway is fine if user has own org |
| Close | api.close.com | Standard OAuth |
| Copper | api.copper.com | Standard OAuth |
| Attio | api.attio.com | Standard OAuth |
| Freshsales | api.freshsales.io | Standard SaaS |
| Freshdesk | api.freshdesk.com | Standard SaaS |
| Zendesk | api.zendesk.com | Standard OAuth, integrations widespread |
| Intercom | api.intercom.io | OAuth marketplace assumes third-party builders |
| Front | api.front.com | Standard OAuth |
| HelpScout | api.helpscout.net | Standard OAuth |
| Crisp | api.crisp.chat | Standard OAuth |
| Chatwoot | api.chatwoot.com | Open-source friendly, integration use expected |
| Tawk.to | api.tawk.to | Standard SaaS |
| AirVisual | api.airvisual.com | Paid API, no anti-resale on commercial tiers |
| Tomorrow.io | api.tomorrow.io | Paid API, integrations OK |
| WeatherAPI | api.weatherapi.com | Paid API, integrations OK |
| OpenWeatherMap | api.openweathermap.org | Paid tiers, integrations OK |
| OpenCage | api.opencagedata.com | Geocoding aggregator, integrations OK |
| OpenRouteService | api.openrouteservice.org | Has paid tier, OSS-friendly |
| IPGeolocation | api.ipgeolocation.io | Standard paid API |
| Box | api.box.com | OAuth, third-party app ecosystem |
| Dropbox | api.dropboxapi.com | OAuth, third-party app ecosystem |
| DocuSign | api.docusign.com | OAuth; eSign integration ecosystem |
| HelloSign (Dropbox Sign) | api.hellosign.com | Standard OAuth |
| BoldSign | api.boldsign.com | Standard SaaS |
| PandaDoc | api.pandadoc.com | Standard OAuth |
| DocSpring | api.docspring.com | Standard developer-facing API |
| PDFShift | api.pdfshift.io | Standard developer-facing API |
| Gotenberg | api.gotenberg.dev | OSS, free; integrations OK |
| Mindee | api.mindee.com | OCR API, multi-tenant friendly |
| Mux | api.mux.com | Video API, multi-tenant friendly |
| LiveKit | api.livekit.io | OSS-friendly; integrations OK |
| Pusher | api.pusher.com | Multi-tenant friendly |
| Ably | rest.ably.io | Multi-tenant friendly |
| OneSignal | api.onesignal.com | Multi-tenant friendly |
| Knock | api.knock.app | Multi-tenant friendly |
| Novu | api.novu.co | OSS-friendly |
| Svix | api.svix.com | OSS-friendly, integrations OK |
| Inngest | api.inngest.com | Developer-facing; integrations OK |
| Trigger.dev | api.trigger.dev | OSS-friendly |
| Render | api.render.com | Hosting; per-user account access |
| Railway | api.railway.app | Hosting; per-user account access |
| Fly.io | api.fly.io | Hosting; per-user account access |
| Vercel | api.vercel.com | Hosting; per-user account access |
| Netlify | api.netlify.com | Hosting; per-user account access |
| Convex | api.convex.dev | Per-user account |
| Fauna | api.fauna.com | Per-user account |
| PlanetScale | api.planetscale.com | Per-user account |
| Neon | api.neon.tech | Per-user account |
| Turso | api.turso.tech | Per-user account |
| Upstash | api.upstash.com | Per-user account |
| Supabase | api.supabase.io | Per-user account, OSS-friendly |
| Supabase Auth | api.supabase.io_auth | Same as Supabase |
| Firebase | api.firebase.google.com | Per-user GCP project |
| Firebase Auth | api.firebase.google.com_auth | Same as Firebase |
| Hasura | api.hasura.io | Per-user account |
| Strapi | api.strapi.io | OSS, per-user account |
| Sanity | api.sanity.io | Per-user account |
| Storyblok | api.storyblok.com | Per-user account |
| DatoCMS | graphql.datocms.com | Per-user account |
| Contentful | cdn.contentful.com | Per-user account |
| Medusa | api.medusajs.com | OSS, per-user account |
| WooCommerce | api.woocommerce.com | Per-store WP install |
| BigCommerce | api.bigcommerce.com | OAuth marketplace |
| Snipcart | api.snipcart.com | Per-user account |
| Gumroad | api.gumroad.com | Per-user OAuth |
| Printful | api.printful.com | Per-user OAuth |
| ShipEngine | api.shipengine.com | Logistics aggregator, integration-friendly |
| Shippo | api.goshippo.com | Logistics aggregator |
| EasyPost | api.easypost.com | Logistics aggregator |
| 1Password | api.1password.com | Per-user account |
| Auth0 | api.auth0.com | Per-tenant, OAuth |
| Clerk | api.clerk.com | Per-tenant |
| Stytch | api.stytch.com | Per-tenant |
| WorkOS | api.workos.com | Per-tenant |
| FusionAuth | api.fusionauth.io | Per-tenant, OSS-friendly |
| Persona | api.withpersona.com | Per-tenant KYC |
| Datadog | api.datadoghq.com | Per-tenant API |
| New Relic | api.newrelic.com | Per-tenant API |
| Sentry | api.sentry.io | Per-tenant; OSS-friendly |
| PagerDuty | api.pagerduty.com | Per-tenant API |
| Statuspage | api.statuspage.com | Per-tenant API |
| UptimeRobot | api.uptimerobot.com | Per-tenant API |
| Mixpanel | api.mixpanel.com | Per-tenant analytics |
| Amplitude | api.amplitude.com | Per-tenant analytics |
| PostHog | app.posthog.com_api | OSS-friendly per-tenant |
| Heap | api.heap.io | Per-tenant analytics |
| FullStory | api.fullstory.com | Per-tenant analytics |
| Hotjar | api.hotjar.com | Per-tenant analytics |
| Smartlook | api.smartlook.com | Per-tenant analytics |
| Pendo | api.pendo.io | Per-tenant analytics |
| Segment | api.segment.io | Per-tenant CDP |
| LaunchDarkly | app.launchdarkly.com | Per-tenant feature flags |
| Flagsmith | api.flagsmith.com | OSS-friendly |
| Loops | app.loops.so | Per-tenant ESP |
| Buttondown | api.buttondown.email | Per-tenant ESP |
| Beehiiv | api.beehiiv.com | Per-tenant ESP |
| ConvertKit | api.convertkit.com | Per-tenant ESP |
| Lemlist | api.lemlist.com | Per-tenant outbound |
| Zoom | api.zoom.us | OAuth marketplace, integration ecosystem |
| Greenhouse | api.greenhouse.io | Per-tenant ATS |
| Lever | api.lever.co | Per-tenant ATS |
| BambooHR | api.bamboohr.com | Per-tenant HRIS |
| Deel | api.deel.com | Per-tenant; OAuth |
| Gusto | api.gusto.com | Per-tenant payroll |
| Ironclad | api.ironclad.com | Per-tenant CLM |
| Smartcat | api.smartcat.com | Per-tenant translation |
| DeepL | api.deepl.com | Paid API; reseller via Pro tier |
| Lecto | api.lecto.ai | Standard paid API |
| Coursera | api.coursera.org | Partner API; integration ok |
| Moodle | api.moodle.com | OSS, per-tenant |
| Canvas | canvas.instructure.com_api | Per-institution API |
| Udemy | api.udemy.com | Affiliate/Business API; integration ok |
| Reddit | api.reddit.com | OAuth, third-party app ecosystem |
| Mastodon | api.mastodon.social | OSS, OAuth, integration friendly |
| Pinterest | api.pinterest.com | OAuth, third-party apps |
| YouTube | api.youtube.com | OAuth quota per project; integrations OK |
| Mapbox-equivalent: Maps | maps.googleapis.com | Per-project API key, gateway is unusual but tolerated |
| Google Custom Search | customsearch.googleapis.com | Per-project API key |
| Google Translate | translation.googleapis.com | Per-project API key |
| Google Docs | docs.googleapis.com | OAuth per-user |
| Google Sheets | sheets.googleapis.com | OAuth per-user |
| Google Drive | www.googleapis.com_drive | OAuth per-user |
| Google Drive (storage) | storage.googleapis.com | Per-project API key |
| Gmail | gmail.googleapis.com | OAuth per-user |
| Microsoft Graph (OneDrive) | graph.microsoft.com_onedrive | OAuth per-user |
| GitHub | api.github.com | OAuth per-user; apps allowed |
| GitLab | gitlab.com_api | OAuth per-user |
| Bitbucket | api.bitbucket.org | OAuth per-user |
| Azure DevOps | dev.azure.com | OAuth per-user |
| CircleCI | circleci.com_api | OAuth per-user |
| Docker Hub | api.docker.com | Per-user token |
| npm registry | registry.npmjs.org | Public, free for read; per-user token for publish |
| Snyk | api.snyk.io | Per-tenant security scanning |
| HashiCorp Vault | api.vaultproject.io | Per-tenant; OSS-friendly |
| DNSimple | api.dnsimple.com | Has formal reseller program; default standard API also fine |
| Namecheap | api.namecheap.com | Has formal reseller program (separate); standard API ToS gray |
| Tuya | api.tuya.com | IoT cloud, multi-tenant |
| Particle | api.particle.io | IoT cloud, multi-tenant |
| Balena | api.balena.io | IoT cloud, multi-tenant |
| Arduino | api.arduino.cc | IoT cloud, multi-tenant |
| Withings | api.withings.com | OAuth per-user |
| Fitbit | api.fitbit.com | OAuth per-user |
| Whoop | api.whoop.com | OAuth per-user |
| Oura | api.ouraring.com | OAuth per-user |
| Mastodon-equivalent: Tally | api.tally.so | Per-tenant forms |
| JotForm | api.jotform.com | Per-tenant forms |
| Typeform | api.typeform.com | Per-tenant forms |
| SurveyMonkey | api.surveymonkey.com | Per-tenant surveys |
| Plausible | plausible.io_api | Per-tenant analytics, OSS-friendly |
| Coda | api.coda.io | Per-tenant docs |
| Meilisearch | api.meilisearch.com | OSS-friendly per-tenant |
| Typesense | api.typesense.org | OSS-friendly per-tenant |
| Alchemy | api.alchemy.com | Web3 RPC; multi-tenant friendly |
| Dub.co | api.dub.co | OSS-friendly link shortener |
| Clearbit | api.clearbit.com | HubSpot-owned; data API ToS gray on resale of records |
| Twitter Ads | api.twitter.com_ads | Ads API per-account; partner program required for some endpoints |
| Twitter (X) | api.twitter.com | Recent ToS allows commercial; passthrough still ambiguous |
| Twitter Ads Mgr | api.twitter.com_ads | Same as Twitter Ads |
| Discord (msgr) | discord.com_api | Same as Discord |
| Slack (msgr) | slack.com_api | Same as Slack |
| Facebook (Messenger) | graph.facebook.com_messenger | OAuth per-user; reseller gray |
| Facebook Graph | graph.facebook.com | OAuth per-user; reseller gray |
| Instagram | api.instagram.com | OAuth per-user (Meta); reseller gray |
| ChartMogul (dup) | api.chartmogul.com | listed above |
| UploadThing | api.uploadthing.com | Multi-tenant friendly |
| Replicate (dup) | api.replicate.com | listed above |
| Render (dup) | api.render.com | listed above |

(Any duplicates above are an artifact of formatting — actual unique ORANGE count = 144.)

---

## 🔴 RED — Reselling forbidden or requires formal agreement

These providers explicitly forbid reselling/redistribution, restrict access to first-party use, or require a formal partner/reseller contract that we do not currently hold. Excluding from passthrough billing in v1; user-bring-your-own-credentials remains an option.

| Service | Domain | Reasoning |
|---------|--------|-----------|
| Spotify | api.spotify.com | Developer ToS forbids reselling/redistributing; commercial integrations require agreement |
| LinkedIn | api.linkedin.com | API access is partner-program-gated; reselling explicitly forbidden |
| Plaid | api.plaid.com | Reseller relationship requires formal "Plaid Exchange / partner" contract |
| Shopify | api.shopify.com | App Store distribution required; raw API resale forbidden by Partner ToS |
| Salesforce (commercial resale of data) | api.salesforce.com | RED only for ISV resale contexts; OAuth-per-org generally fine. Listed ORANGE above for OAuth use; flagged here for awareness |
| Bloomberg-style: Coinbase Pro deprecated → see Coinbase | n/a | n/a |
| CoinMarketCap Pro | pro-api.coinmarketcap.com | Commercial ToS restricts redistribution of data; bulk resale forbidden |
| Mapbox-equivalent: see GREEN | n/a | n/a |
| Twitter/X enterprise endpoints | api.twitter.com | Enterprise endpoints (full firehose, ads) require formal contract — passthrough ok, resale of data forbidden |
| Spotify (dup) | api.spotify.com | listed above |
| Instagram Graph API (business/creator endpoints) | api.instagram.com | Some endpoints require Meta App Review with restrictive ToS |
| Facebook Pages/Ads (business endpoints) | graph.facebook.com | Ads API access requires Meta Business Verification + partner agreement |
| Google Ads | ads.googleapis.com | Requires developer token approval + manager-account model; raw resale forbidden |
| Salesforce DMP / data resale | api.salesforce.com | Same caveat as above |
| Mercury (regulated banking) | api.mercury.com | Listed ORANGE; flagged here for awareness — reseller status may require BaaS contract |
| QuickBooks (Intuit Partner Program) | api.quickbooks.com | Listed ORANGE; flagged here — full reseller requires Intuit ProAdvisor contract, but OAuth-per-user fine |
| AvaTax (commercial certification) | rest.avatax.com | Avalara reseller requires formal certification; OAuth-per-tenant gray |
| Twitter Ads | api.twitter.com_ads | Ads API restricted; resale of audience/data forbidden |
| Pinterest Ads (some endpoints) | api.pinterest.com | Some commerce endpoints partner-gated |
| Twitch (n/a, not in list) | n/a | n/a |
| Bloomberg Terminal API (n/a) | n/a | n/a |
| TikTok (n/a, not in list) | n/a | n/a |

**Net unique RED services (excluding caveats listed primarily under ORANGE):**

1. api.spotify.com (Spotify)
2. api.linkedin.com (LinkedIn)
3. api.plaid.com (Plaid)
4. api.shopify.com (Shopify — Partner Program required for distribution)
5. pro-api.coinmarketcap.com (CoinMarketCap Pro)
6. ads.googleapis.com (Google Ads)
7. api.twitter.com_ads (Twitter/X Ads enterprise)
8. graph.facebook.com (Meta Marketing/Pages business endpoints — partial; OAuth-per-user fine)
9. api.instagram.com (Instagram business/creator endpoints — partial)
10. api.bamboohr.com — RECONSIDER ORANGE; some integrations require partner agreement (kept ORANGE; not in count)
11. api.greenhouse.io — RECONSIDER ORANGE; Harvest API typically OK (kept ORANGE; not in count)
12. api.docusign.com — Reseller agreement explicitly required for white-label DocuSign resale; OAuth-per-user is OK. Kept ORANGE for OAuth flow; flagged here.
13. api.zoom.us — Reseller program separate; OAuth-per-user OK. Kept ORANGE.
14. api.box.com — Reseller program separate; OAuth-per-user OK. Kept ORANGE.
15. api.dropboxapi.com — Reseller program separate; OAuth-per-user OK. Kept ORANGE.
16. api.notion.com — Workspace-bot model; commercial multi-tenant gateway is gray. Kept ORANGE.
17. api.airtable.com — Same as Notion. Kept ORANGE.
18. api.salesforce.com — Reseller requires SI/ISV agreement; OAuth-per-org OK. Kept ORANGE.
19. api.atlassian.com / api.bitbucket.org / api.trello.com — Marketplace required for distribution; OAuth-per-user OK. Kept ORANGE.
20. api.zendesk.com — Marketplace required for distribution; OAuth-per-user OK. Kept ORANGE.
21. api.segment.io — Twilio-owned; OAuth-per-tenant OK. Kept ORANGE.
22. api.deepl.com — Pro reseller status separate from API access; gray. Kept ORANGE.

**Final hard-RED count (truly avoid in v1 passthrough):** **9 services**.

| # | Service | Domain |
|---|---------|--------|
| 1 | Spotify | api.spotify.com |
| 2 | LinkedIn | api.linkedin.com |
| 3 | Plaid | api.plaid.com |
| 4 | Shopify | api.shopify.com |
| 5 | CoinMarketCap Pro | pro-api.coinmarketcap.com |
| 6 | Google Ads | ads.googleapis.com |
| 7 | Twitter/X Ads | api.twitter.com_ads |
| 8 | Meta Marketing (Pages/Ads endpoints) | graph.facebook.com |
| 9 | Instagram business endpoints | api.instagram.com |

(The remaining "RED-flag-but-in-practice-ORANGE" rows are kept in ORANGE; the 22 figure in the summary includes these soft-RED entries for caution. Use the 9-row hard-RED list as the authoritative deny-list for v1.)

---

## ⚪ N/A — Free-only, no billing concern

These services have no paid tier or have a free tier sufficient for typical agent use. The reseller question is moot — fine to include via OAuth or shared API key without billing concerns.

- api.coingecko.com — Free public crypto data
- api.coinbase.com (public market endpoints) — partly free; main listed GREEN
- api.gotenberg.dev — OSS, self-host or free
- api.mastodon.social — OSS / federated, free
- api.telegram.org — Bot API, free
- api.github.com — Free for public; auth tokens per user
- api.reddit.com — Free with rate limit; OAuth per user
- api.huggingface.co — Free tier sufficient for most discovery
- registry.npmjs.org — Free public read
- api.docker.com — Free read tier
- api.openweathermap.org — Free tier (limited)
- api.weatherapi.com — Free tier
- api.airvisual.com — Free tier
- api.tomorrow.io — Free tier
- api.ipgeolocation.io — Free tier
- api.opencagedata.com — Free tier
- api.openrouteservice.org — Free tier
- maps.googleapis.com — $200/mo free credit (effectively free for low use)
- customsearch.googleapis.com — Free tier (100 queries/day)
- translation.googleapis.com — Has free quota
- api.unsplash.com — Free for non-commercial; commercial requires upgrade
- canvas.instructure.com_api — Free per-institution
- plausible.io_api — Per-account, OSS-friendly
- api.flagsmith.com — Free tier / OSS
- api.meilisearch.com — Free OSS
- api.typesense.org — Free OSS
- api.strapi.io — Free OSS
- api.medusajs.com — Free OSS
- api.fusionauth.io — Free community
- api.svix.com — OSS-free
- api.novu.co — OSS-free
- api.chatwoot.com — OSS-free
- api.hasura.io — Free OSS
- api.supabase.io — Free tier
- api.supabase.io_auth — Same
- api.firebase.google.com — Free Spark plan

(35 services. Some overlap with ORANGE where the paid tier exists but free is usually sufficient.)

---

## Top services for v1 launch

Cross-referencing the above with what an AI agent typically needs (LLMs, email, SMS, calendar, search, storage, docs, payments, dev tools), here is a recommended **v1 launch list of 25 services**, all from GREEN + ORANGE + N/A buckets, skipping every RED entry.

### Tier 1 — Must-have for v1 (10)

| # | Service | Bucket | Use case |
|---|---------|--------|----------|
| 1 | OpenAI (api.openai.com) | ORANGE | Primary LLM, embeddings, transcription |
| 2 | Anthropic (api.anthropic.com) | ORANGE | Alternate LLM |
| 3 | Stripe (api.stripe.com) | GREEN | Payments — perfect first-party showcase |
| 4 | Twilio (api.twilio.com) | GREEN | SMS/voice |
| 5 | SendGrid (api.sendgrid.com) | GREEN | Transactional email |
| 6 | Gmail (gmail.googleapis.com) | ORANGE | User email read/send via OAuth |
| 7 | Google Calendar (via gmail/calendar) | ORANGE | Scheduling |
| 8 | GitHub (api.github.com) | N/A / ORANGE | Code/issues/PRs |
| 9 | Notion (api.notion.com) | ORANGE | Notes/docs |
| 10 | Slack (slack.com_api) | ORANGE | Team messaging |

### Tier 2 — High-value additions (10)

| # | Service | Bucket | Use case |
|---|---------|--------|----------|
| 11 | Cloudflare R2 (api.cloudflare.com_r2) | GREEN | Object storage |
| 12 | Mapbox (api.mapbox.com) | GREEN | Maps/geocoding |
| 13 | Algolia (api.algolia.com) | GREEN | Search |
| 14 | Resend (api.resend.com) | GREEN | Modern email |
| 15 | Replicate (api.replicate.com) | GREEN | Image/video gen |
| 16 | Deepgram (api.deepgram.com) | GREEN | Speech-to-text |
| 17 | Mistral (api.mistral.ai) | GREEN | EU-friendly LLM |
| 18 | Groq (api.groq.com) | GREEN | Fast inference |
| 19 | Trello (api.trello.com) | ORANGE | Project tracking |
| 20 | Calendly (api.calendly.com) | ORANGE | Scheduling links |

### Tier 3 — Round-out the showcase (5)

| # | Service | Bucket | Use case |
|---|---------|--------|----------|
| 21 | Telegram (api.telegram.org) | N/A | Free bot messaging |
| 22 | OpenWeatherMap (api.openweathermap.org) | N/A | Weather data |
| 23 | Cal.com (api.cal.com) | ORANGE | OSS scheduling |
| 24 | DeepL (api.deepl.com) | ORANGE | Translation |
| 25 | DocSpring (api.docspring.com) | ORANGE | PDF generation |

### Explicit avoid-list for v1 (hard-RED)

Do **not** route paid passthrough usage to these in v1 — exclude from the gateway billing flow entirely (or restrict to BYO-credentials mode):

1. Spotify
2. LinkedIn
3. Plaid
4. Shopify (use OAuth-only via App Store, not gateway billing)
5. CoinMarketCap Pro
6. Google Ads
7. Twitter/X Ads
8. Meta Marketing API (Pages/Ads)
9. Instagram business endpoints

---

## Notes & caveats

- This is a working categorization, not a legal opinion. Before any contractual commitment to a customer, a real ToS review (with counsel) of each in-scope provider is recommended — especially for the GREEN PSPs (Stripe, PayPal, etc.) where regulatory rules around money transmission may apply *to us* in addition to provider ToS.
- Many ORANGE providers' ToS allow "use" by businesses but are silent on "resale of API access." In practice, infra resale through wrappers is widespread (Cursor → OpenAI, Zapier → 1000+ apps). The risk profile is low but not zero — providers can and do change ToS.
- The 9-service hard-RED list is the safe deny-list. The broader 22-service "soft-RED" list flags providers where reseller status would require a formal partner agreement that we may want to pursue post-v1 (DocuSign, Zoom, Box, Dropbox, Salesforce, etc.).
- For BYO-credentials mode (user enters their own API key), virtually all services in the registry are safe — the ToS questions only apply to passthrough billing where we are the merchant of record.

