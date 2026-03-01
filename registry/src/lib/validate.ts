import { isSecureUrl, isValidDetailUrl, stripHtml } from "./sanitize";

export interface ManifestCapability {
  name: string;
  description: string;
  detail_url: string;
}

export interface ManifestAuth {
  type: "oauth2" | "api_key" | "none";
  authorization_url?: string;
  token_url?: string;
  scopes?: string[];
  header?: string;
  prefix?: string;
  setup_url?: string;
}

export interface ManifestPricing {
  type: "free" | "freemium" | "paid";
  plans?: Array<{ name: string; price: string; limits: string }>;
  plans_url?: string;
}

export interface Manifest {
  spec_version: string;
  name: string;
  description: string;
  base_url: string;
  auth: ManifestAuth;
  pricing?: ManifestPricing;
  capabilities: ManifestCapability[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  manifest?: Manifest;
}

export interface ValidationError {
  path: string;
  message: string;
}

const SUPPORTED_SPEC_VERSIONS = ["1.0"];

function isValidHttpsUrl(str: string): boolean {
  const check = isSecureUrl(str);
  return check.valid;
}

export function validateManifest(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      valid: false,
      errors: [{ path: "$", message: "Manifest must be a JSON object." }],
    };
  }

  const m = data as Record<string, unknown>;

  // spec_version
  if (!m.spec_version || typeof m.spec_version !== "string") {
    errors.push({ path: "spec_version", message: "Required. Must be a string (e.g. \"1.0\")." });
  } else if (!SUPPORTED_SPEC_VERSIONS.includes(m.spec_version)) {
    errors.push({
      path: "spec_version",
      message: `Unsupported version "${m.spec_version}". Supported: ${SUPPORTED_SPEC_VERSIONS.join(", ")}.`,
    });
  }

  // name — strip HTML
  if (!m.name || typeof m.name !== "string") {
    errors.push({ path: "name", message: "Required. Must be a non-empty string." });
  } else {
    const cleanName = stripHtml(m.name).trim();
    m.name = cleanName;
    if (cleanName.length === 0) {
      errors.push({ path: "name", message: "Must not be empty or whitespace-only." });
    } else if (cleanName.length > 100) {
      errors.push({ path: "name", message: "Must be 100 characters or fewer." });
    }
  }

  // description — strip HTML
  if (!m.description || typeof m.description !== "string") {
    errors.push({ path: "description", message: "Required. Must be a non-empty string (2-3 sentences describing your service for LLM understanding)." });
  } else {
    const cleanDesc = stripHtml(m.description).trim();
    m.description = cleanDesc;
    if (cleanDesc.length < 20) {
      errors.push({ path: "description", message: "Too short. Write 2-3 sentences describing what your service does, written for an LLM to understand." });
    } else if (cleanDesc.length > 500) {
      errors.push({ path: "description", message: "Must be 500 characters or fewer. Keep it concise." });
    }
  }

  // base_url — must be HTTPS, no private IPs
  if (!m.base_url || typeof m.base_url !== "string") {
    errors.push({ path: "base_url", message: "Required. Must be a valid HTTPS URL (e.g. \"https://api.example.com\")." });
  } else {
    const urlCheck = isSecureUrl(m.base_url);
    if (!urlCheck.valid) {
      errors.push({ path: "base_url", message: urlCheck.error ?? "Invalid URL." });
    } else if ((m.base_url as string).endsWith("/")) {
      errors.push({ path: "base_url", message: "Should not end with a trailing slash." });
    }
  }

  // Extract base domain for detail_url validation
  let baseDomain = "";
  if (typeof m.base_url === "string") {
    try {
      baseDomain = new URL(m.base_url).hostname;
    } catch {
      // already caught above
    }
  }

  // auth
  if (!m.auth || typeof m.auth !== "object" || Array.isArray(m.auth)) {
    errors.push({ path: "auth", message: "Required. Must be an object with a 'type' field." });
  } else {
    const auth = m.auth as Record<string, unknown>;
    const validTypes = ["oauth2", "api_key", "none"];

    if (!auth.type || typeof auth.type !== "string") {
      errors.push({ path: "auth.type", message: `Required. Must be one of: ${validTypes.join(", ")}.` });
    } else if (!validTypes.includes(auth.type)) {
      errors.push({ path: "auth.type", message: `"${auth.type}" is not valid. Must be one of: ${validTypes.join(", ")}.` });
    } else {
      if (auth.type === "oauth2") {
        if (!auth.authorization_url || typeof auth.authorization_url !== "string") {
          errors.push({ path: "auth.authorization_url", message: "Required for OAuth2. Must be a valid HTTPS URL." });
        } else if (!isValidHttpsUrl(auth.authorization_url)) {
          errors.push({ path: "auth.authorization_url", message: `"${auth.authorization_url}" must be a valid HTTPS URL.` });
        }

        if (!auth.token_url || typeof auth.token_url !== "string") {
          errors.push({ path: "auth.token_url", message: "Required for OAuth2. Must be a valid HTTPS URL." });
        } else if (!isValidHttpsUrl(auth.token_url)) {
          errors.push({ path: "auth.token_url", message: `"${auth.token_url}" must be a valid HTTPS URL.` });
        }

        if (auth.scopes !== undefined && !Array.isArray(auth.scopes)) {
          errors.push({ path: "auth.scopes", message: "Must be an array of strings if provided." });
        }
      }

      if (auth.type === "api_key") {
        if (!auth.header || typeof auth.header !== "string") {
          errors.push({ path: "auth.header", message: "Required for API key auth. The HTTP header name (e.g. \"Authorization\")." });
        }
        if (auth.prefix !== undefined && typeof auth.prefix !== "string") {
          errors.push({ path: "auth.prefix", message: "Must be a string if provided (e.g. \"Bearer\")." });
        }
        if (auth.setup_url !== undefined && typeof auth.setup_url === "string" && !isValidHttpsUrl(auth.setup_url)) {
          errors.push({ path: "auth.setup_url", message: `"${auth.setup_url}" must be a valid HTTPS URL.` });
        }
      }
    }
  }

  // pricing (optional)
  if (m.pricing !== undefined && m.pricing !== null) {
    if (typeof m.pricing !== "object" || Array.isArray(m.pricing)) {
      errors.push({ path: "pricing", message: "Must be an object if provided." });
    } else {
      const pricing = m.pricing as Record<string, unknown>;
      const validPricingTypes = ["free", "freemium", "paid"];
      if (!pricing.type || typeof pricing.type !== "string") {
        errors.push({ path: "pricing.type", message: `Required when pricing is provided. Must be one of: ${validPricingTypes.join(", ")}.` });
      } else if (!validPricingTypes.includes(pricing.type)) {
        errors.push({ path: "pricing.type", message: `"${pricing.type}" is not valid. Must be one of: ${validPricingTypes.join(", ")}.` });
      }

      if (pricing.plans !== undefined && !Array.isArray(pricing.plans)) {
        errors.push({ path: "pricing.plans", message: "Must be an array if provided." });
      }

      if (pricing.plans_url !== undefined && typeof pricing.plans_url === "string" && !isValidHttpsUrl(pricing.plans_url)) {
        errors.push({ path: "pricing.plans_url", message: `"${pricing.plans_url}" must be a valid HTTPS URL.` });
      }
    }
  }

  // capabilities
  if (!Array.isArray(m.capabilities)) {
    errors.push({ path: "capabilities", message: "Required. Must be an array of capability objects." });
  } else if (m.capabilities.length === 0) {
    errors.push({ path: "capabilities", message: "Must contain at least one capability." });
  } else {
    const seenNames = new Set<string>();

    for (let i = 0; i < m.capabilities.length; i++) {
      const cap = m.capabilities[i];
      const prefix = `capabilities[${i}]`;

      if (!cap || typeof cap !== "object" || Array.isArray(cap)) {
        errors.push({ path: prefix, message: "Each capability must be an object." });
        continue;
      }

      const c = cap as Record<string, unknown>;

      if (!c.name || typeof c.name !== "string") {
        errors.push({ path: `${prefix}.name`, message: "Required. Must be a string." });
      } else if (!/^[a-z][a-z0-9_]*$/.test(c.name)) {
        errors.push({ path: `${prefix}.name`, message: `"${c.name}" is not valid snake_case. Use lowercase letters, numbers, and underscores (e.g. "send_email").` });
      } else if (seenNames.has(c.name)) {
        errors.push({ path: `${prefix}.name`, message: `Duplicate capability name "${c.name}". Each capability must have a unique name.` });
      } else {
        seenNames.add(c.name);
      }

      // description — strip HTML
      if (!c.description || typeof c.description !== "string") {
        errors.push({ path: `${prefix}.description`, message: "Required. 1-2 sentences describing what this capability does." });
      } else {
        const cleanCapDesc = stripHtml(c.description).trim();
        c.description = cleanCapDesc;
        if (cleanCapDesc.length < 10) {
          errors.push({ path: `${prefix}.description`, message: "Too short. Write 1-2 sentences so an LLM knows when to use this capability." });
        }
      }

      // detail_url — validate against SSRF
      if (!c.detail_url || typeof c.detail_url !== "string") {
        errors.push({ path: `${prefix}.detail_url`, message: "Required. A relative path (e.g. \"/capabilities/send_email\") or absolute HTTPS URL." });
      } else if ((c.detail_url as string).length > 2048) {
        errors.push({ path: `${prefix}.detail_url`, message: "URL must be 2048 characters or fewer." });
      } else {
        const detailUrl = c.detail_url as string;
        const detailCheck = isValidDetailUrl(detailUrl, baseDomain);
        if (!detailCheck.valid) {
          errors.push({ path: `${prefix}.detail_url`, message: detailCheck.error ?? "Invalid detail_url." });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    manifest: m as unknown as Manifest,
  };
}

/** Flatten ValidationError[] into human-readable string[] */
export function flattenErrors(errors: ValidationError[]): string[] {
  return errors.map((e) => `${e.path}: ${e.message}`);
}

export function extractDomain(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return url.hostname;
  } catch {
    return baseUrl;
  }
}
