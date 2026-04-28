# Acceptable Use Policy

**Last updated:** 2026-04-28

## Why this matters

AgentDNS is shared infrastructure. We hold the accounts with hundreds of upstream API providers and call them on your behalf. If one user abuses a provider, that provider doesn't ban that user — they ban *us*, and every other AgentDNS user loses access. This policy exists so we can keep the gateway working for everyone. Please read it before you build.

## 1. Scope

This AUP applies to all use of AgentDNS, including the registry website (`agent-dns.dev`), the `agent-gateway-mcp` server, the `agent-gateway` CLI, and any API or SDK we publish. By using any of these, you agree to this policy.

## 2. No spam or unsolicited messaging

You will not use the gateway to send unsolicited messages of any kind. This includes but is not limited to:

- Bulk or unsolicited email via SendGrid, Mailgun, Resend, Postmark, Gmail, or any other email provider.
- SMS or voice messaging via Twilio or similar, outside of recipients who have explicitly opted in.
- Mass comments, DMs, replies, or follows on social or messaging platforms.
- Lead-generation outreach to people who have not requested contact.

If a recipient could plausibly mark a message as spam, don't send it through us.

## 3. No content that violates upstream provider policies

When you call OpenAI, Anthropic, Replicate, or any other LLM, image, or audio provider through AgentDNS, **their usage policies apply to you transitively through us**. We pass the relevant identifiers to them, and we enforce their rules.

You will not generate or transmit:

- CSAM or any sexual content involving minors. Zero tolerance, immediate ban, reported to authorities.
- Content that incites violence against real people or groups, or facilitates physical harm.
- Malware, exploit code, or content designed to compromise systems.
- Deepfakes — image, audio, or video — designed to deceive about a real person's words or actions, particularly in political, financial, or harassment contexts.
- Content that the upstream provider's own usage policy forbids (OpenAI Usage Policies, Anthropic AUP, Replicate Acceptable Use, etc.).

If you're not sure whether a use case is allowed, check the upstream provider's policy first. We default to their stricter rule.

## 4. No abusive scraping or rate-limit circumvention

You will not:

- Use AgentDNS to bypass or amplify past a provider's rate limits, quotas, or pricing tiers.
- Hammer endpoints with retry loops or distribute requests across users to dodge throttling.
- Aggregate, scrape, or republish data from a provider in ways the provider's terms do not permit.
- Treat the gateway as a way to "anonymize" otherwise-restricted traffic.

We apply per-user rate limits at the gateway. Attempting to circumvent them — by rotating accounts, scripting parallel requests, etc. — is itself a violation.

## 5. No fraud

- Don't pay with stolen, borrowed, or fraudulent payment methods.
- Don't use false identity or impersonate someone else when signing up.
- Don't dispute charges in bad faith. If a charge is wrong, email us at `billing@agent-dns.dev` and we'll fix it. Chargebacks without prior contact will result in immediate suspension.

## 6. No unauthorized access

You will only use AgentDNS to access data and systems you are authorized to access. This means:

- Don't request OAuth scopes broader than what your use case needs.
- Don't try to access another AgentDNS user's data, credentials, or usage records.
- Don't probe the gateway, registry, or upstream services for vulnerabilities except via our security disclosure process (`security@agent-dns.dev`).
- Don't use OAuth tokens you obtained through AgentDNS for any purpose other than what the user granted them for.

## 7. No reselling

AgentDNS is for end-users — humans, and the agents they personally operate. You may build agents for yourself, your team, or your customers' direct use. You may not:

- Run a competing gateway, MCP aggregator, or API-multiplexer service on top of AgentDNS.
- Resell access to AgentDNS itself, or sublicense your account, to a downstream user base.
- Repackage our credentials or per-call access as a paid service of your own.

We are the aggregator. If you want to *be* an aggregator, build your own — don't proxy through ours.

## 8. Enforcement and suspension

We may suspend or terminate any account, with no refund of prepaid amounts or unused credits, for any of the following:

- An upstream provider flags, rate-limits, or threatens to ban our account because of your traffic.
- We detect chargeback abuse, fraudulent payment, or stolen-card use.
- A provider, user, or law enforcement reports your activity to us with credible evidence.
- You violate any other section of this policy.

For a first-time, low-severity violation we will normally warn you and give you a chance to fix the issue. For violations involving CSAM, fraud, account takeover, or anything that has already caused (or is about to cause) a provider to ban our account, **suspension is immediate and without warning.**

## 9. Reporting abuse

If you see something — spam from a domain we host, generated content that violates this policy, suspected fraud, security issues — please tell us:

- **Abuse reports:** `abuse@agent-dns.dev`
- **Security disclosures:** `security@agent-dns.dev`
- **Billing disputes:** `billing@agent-dns.dev`

We read these. We act on them.

## 10. Changes to this policy

We will update this AUP as we learn what works and what doesn't. For minor clarifications, we'll just update this page. For substantial changes — new restrictions, new categories of prohibited use — we'll notify active users by email at least 14 days before they take effect. Continued use of AgentDNS after a change takes effect means you accept the updated policy.

---

*This is v1. We expect to refine it as we learn from real abuse patterns and from real users. Material changes will be communicated as described above. This document is not a substitute for the formal Terms of Service, which govern the contractual relationship.*
