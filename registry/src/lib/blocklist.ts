/**
 * Protected domains that cannot be registered via manual manifest submission.
 * Only auto-discover (which fetches from the real domain) can register these.
 */
export const BLOCKED_DOMAINS: string[] = [
  // Search engines
  "google.com", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com", "yandex.com",

  // Social media
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "reddit.com", "tiktok.com", "pinterest.com", "snapchat.com", "tumblr.com",
  "discord.com", "mastodon.social", "threads.net",

  // Video / streaming
  "youtube.com", "twitch.tv", "vimeo.com", "netflix.com", "spotify.com",
  "soundcloud.com", "hulu.com", "disneyplus.com",

  // Tech giants
  "amazon.com", "apple.com", "microsoft.com", "meta.com",
  "aws.amazon.com", "azure.microsoft.com", "cloud.google.com",

  // Developer platforms
  "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com",
  "npmjs.com", "pypi.org", "crates.io", "hub.docker.com",
  "vercel.com", "netlify.com", "heroku.com", "railway.app",
  "render.com", "fly.io", "supabase.com", "planetscale.com",

  // Email
  "gmail.com", "outlook.com", "hotmail.com", "protonmail.com", "yahoo.com",
  "mail.google.com", "icloud.com",

  // Cloud / infrastructure
  "cloudflare.com", "amazonaws.com", "azure.com", "digitalocean.com",
  "linode.com", "vultr.com", "ovh.com", "hetzner.com",

  // AI / ML
  "openai.com", "anthropic.com", "huggingface.co", "replicate.com",
  "midjourney.com", "stability.ai", "cohere.com", "mistral.ai",
  "deepmind.com", "gemini.google.com",

  // Payments
  "stripe.com", "paypal.com", "square.com", "braintreepayments.com",
  "adyen.com", "wise.com", "revolut.com", "venmo.com",

  // Communication
  "slack.com", "zoom.us", "teams.microsoft.com", "telegram.org",
  "whatsapp.com", "signal.org", "skype.com", "webex.com",

  // Productivity
  "notion.so", "airtable.com", "trello.com", "asana.com", "monday.com",
  "jira.atlassian.com", "confluence.atlassian.com", "atlassian.com",
  "figma.com", "canva.com", "miro.com", "clickup.com",

  // CRM / marketing
  "salesforce.com", "hubspot.com", "mailchimp.com", "intercom.io",
  "zendesk.com", "freshdesk.com", "sendgrid.com", "twilio.com",

  // Analytics
  "analytics.google.com", "mixpanel.com", "amplitude.com", "segment.com",
  "datadog.com", "newrelic.com", "sentry.io", "grafana.com",

  // Storage / CDN
  "dropbox.com", "box.com", "drive.google.com", "onedrive.live.com",
  "cloudinary.com", "imgix.com", "fastly.com", "akamai.com",

  // CMS / web
  "wordpress.com", "wordpress.org", "shopify.com", "squarespace.com",
  "wix.com", "webflow.com", "ghost.org", "medium.com", "substack.com",

  // Security
  "auth0.com", "okta.com", "onelogin.com", "lastpass.com",
  "1password.com", "bitwarden.com", "letsencrypt.org",

  // DNS / domains
  "godaddy.com", "namecheap.com", "cloudflare.com", "dnsimple.com",
  "domains.google", "hover.com", "gandi.net",

  // Maps / location
  "maps.google.com", "mapbox.com", "openstreetmap.org",

  // Food / delivery
  "ubereats.com", "doordash.com", "grubhub.com", "deliveroo.com",

  // Travel
  "airbnb.com", "booking.com", "expedia.com", "tripadvisor.com",

  // Finance
  "robinhood.com", "coinbase.com", "binance.com", "plaid.com",
  "brex.com", "mercury.com",

  // News / media
  "nytimes.com", "washingtonpost.com", "bbc.com", "cnn.com",
  "reuters.com", "theguardian.com",

  // Education
  "coursera.org", "udemy.com", "khan Academy.org", "edx.org",

  // Government
  "gov.uk", "usa.gov", "europa.eu",

  // Wikipedia
  "wikipedia.org", "wikimedia.org",

  // Database
  "mongodb.com", "postgresql.org", "mysql.com", "redis.io",
  "elastic.co", "cockroachlabs.com",

  // CI/CD
  "circleci.com", "travis-ci.com", "jenkins.io", "buildkite.com",
];

/** Check if a domain is in the static blocklist (includes subdomains) */
export function isDomainBlocked(domain: string): boolean {
  const lower = domain.toLowerCase();
  return BLOCKED_DOMAINS.some(
    (blocked) => lower === blocked || lower.endsWith("." + blocked)
  );
}
