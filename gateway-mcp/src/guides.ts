import type { ServiceGuide } from "./types.js";
import { GUIDES } from "./service-guides.js";

export function getGuide(domain: string): ServiceGuide | null {
  return GUIDES[domain] ?? null;
}
