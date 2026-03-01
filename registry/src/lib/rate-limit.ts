interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterSec: 0 };
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    retryAfterSec: 0,
  };
}

export const RATE_LIMITS = {
  submitService: { maxRequests: 5, windowMs: 60 * 60 * 1000 } as RateLimitConfig,
  verifyService: { maxRequests: 3, windowMs: 60 * 60 * 1000 } as RateLimitConfig,
  discover: { maxRequests: 60, windowMs: 60 * 1000 } as RateLimitConfig,
  listServices: { maxRequests: 60, windowMs: 60 * 1000 } as RateLimitConfig,
  report: { maxRequests: 3, windowMs: 60 * 60 * 1000 } as RateLimitConfig,
} as const;
