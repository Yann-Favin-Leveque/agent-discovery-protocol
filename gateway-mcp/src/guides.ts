import type { ServiceGuide } from "./types.js";
import { GUIDES } from "./service-guides.js";
import { fetchGuide } from "./discovery.js";

/**
 * Get guide for a domain. Tries registry DB first, falls back to embedded data.
 */
export async function getGuide(domain: string): Promise<ServiceGuide | null> {
  // 1. Try registry (cached in-memory for 1h)
  try {
    const remote = await fetchGuide(domain);
    if (remote) return remote;
  } catch {
    // Registry unreachable — fall through to embedded
  }

  // 2. Fall back to embedded guides
  return GUIDES[domain] ?? null;
}
