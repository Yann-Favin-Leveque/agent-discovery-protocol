import { type NextRequest } from "next/server";

/** Strip HTML tags from a string */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Sanitize a search query: strip HTML, limit length, trim */
export function sanitizeSearch(input: string): string {
  return stripHtml(input).slice(0, 200).trim();
}

/** Sanitize a manifest text field: strip HTML, limit length, trim */
export function sanitizeTextField(value: string, maxLength: number): string {
  return stripHtml(value).slice(0, maxLength).trim();
}

/** Validate that a URL uses https:// and doesn't point to private/local addresses */
export function isSecureUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: `"${url}" is not a valid URL.` };
  }

  const allowedProtocols = ["https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `URL must use HTTPS. Got "${parsed.protocol}".`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost and loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  ) {
    return { valid: false, error: "URLs pointing to localhost are not allowed." };
  }

  // Reject private IP ranges
  if (isPrivateIp(hostname)) {
    return { valid: false, error: "URLs pointing to private IP addresses are not allowed." };
  }

  return { valid: true };
}

/** Check if a hostname is a private IP address */
function isPrivateIp(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 127.0.0.0/8 (already caught above, but be thorough)
    if (a === 127) return true;
  }

  return false;
}

/** Validate a detail_url: must be a relative path or same-domain https URL */
export function isValidDetailUrl(
  detailUrl: string,
  baseDomain: string
): { valid: boolean; error?: string } {
  // Relative paths starting with / are always valid
  if (detailUrl.startsWith("/")) {
    return { valid: true };
  }

  // Reject dangerous schemes
  const lower = detailUrl.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("ftp:") ||
    lower.startsWith("file:")
  ) {
    return { valid: false, error: `Dangerous URL scheme in detail_url: "${detailUrl}".` };
  }

  // Must be https
  const secureCheck = isSecureUrl(detailUrl);
  if (!secureCheck.valid) return secureCheck;

  // Must be same domain as base_url
  try {
    const detailHost = new URL(detailUrl).hostname.toLowerCase();
    const baseHost = baseDomain.toLowerCase();
    if (detailHost !== baseHost && !detailHost.endsWith("." + baseHost)) {
      return {
        valid: false,
        error: `detail_url must be on the same domain as base_url. Got "${detailHost}", expected "${baseHost}".`,
      };
    }
  } catch {
    return { valid: false, error: `Invalid detail_url: "${detailUrl}".` };
  }

  return { valid: true };
}

/** Validate domain format (no protocol, no path, no port) */
export function isValidDomain(domain: string): boolean {
  // Must be a valid hostname: lowercase letters, digits, hyphens, dots
  // At least 2 labels (e.g., "example.com")
  // No IP addresses
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainRegex.test(domain)) return false;

  // Reject if it looks like an IP address
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;

  return true;
}

/** Extract client IP from a Next.js request */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
