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
  errors: string[];
  manifest?: Manifest;
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Manifest must be a JSON object."] };
  }

  const m = data as Record<string, unknown>;

  // spec_version
  if (!m.spec_version || typeof m.spec_version !== "string") {
    errors.push("Missing or invalid 'spec_version' (must be a string, e.g. \"1.0\").");
  }

  // name
  if (!m.name || typeof m.name !== "string" || m.name.trim().length === 0) {
    errors.push("Missing or invalid 'name' (must be a non-empty string).");
  }

  // description
  if (!m.description || typeof m.description !== "string" || m.description.trim().length === 0) {
    errors.push("Missing or invalid 'description' (must be a non-empty string).");
  }

  // base_url
  if (!m.base_url || typeof m.base_url !== "string" || !isValidUrl(m.base_url)) {
    errors.push("Missing or invalid 'base_url' (must be a valid URL).");
  }

  // auth
  if (!m.auth || typeof m.auth !== "object") {
    errors.push("Missing or invalid 'auth' (must be an object with a 'type' field).");
  } else {
    const auth = m.auth as Record<string, unknown>;
    if (!["oauth2", "api_key", "none"].includes(auth.type as string)) {
      errors.push("'auth.type' must be one of: 'oauth2', 'api_key', 'none'.");
    }
    if (auth.type === "oauth2") {
      if (!auth.authorization_url || typeof auth.authorization_url !== "string" || !isValidUrl(auth.authorization_url)) {
        errors.push("OAuth2 auth requires a valid 'auth.authorization_url'.");
      }
      if (!auth.token_url || typeof auth.token_url !== "string" || !isValidUrl(auth.token_url)) {
        errors.push("OAuth2 auth requires a valid 'auth.token_url'.");
      }
    }
    if (auth.type === "api_key") {
      if (!auth.header || typeof auth.header !== "string") {
        errors.push("API key auth requires 'auth.header' (e.g. 'Authorization').");
      }
    }
  }

  // pricing (optional)
  if (m.pricing !== undefined && m.pricing !== null) {
    if (typeof m.pricing !== "object") {
      errors.push("'pricing' must be an object if provided.");
    } else {
      const pricing = m.pricing as Record<string, unknown>;
      if (!["free", "freemium", "paid"].includes(pricing.type as string)) {
        errors.push("'pricing.type' must be one of: 'free', 'freemium', 'paid'.");
      }
    }
  }

  // capabilities
  if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
    errors.push("'capabilities' must be a non-empty array.");
  } else {
    for (let i = 0; i < m.capabilities.length; i++) {
      const cap = m.capabilities[i] as Record<string, unknown>;
      const prefix = `capabilities[${i}]`;

      if (!cap.name || typeof cap.name !== "string") {
        errors.push(`${prefix}: missing or invalid 'name'.`);
      } else if (!/^[a-z][a-z0-9_]*$/.test(cap.name)) {
        errors.push(`${prefix}: 'name' must be snake_case (e.g. 'send_email').`);
      }

      if (!cap.description || typeof cap.description !== "string") {
        errors.push(`${prefix}: missing or invalid 'description'.`);
      }

      if (!cap.detail_url || typeof cap.detail_url !== "string") {
        errors.push(`${prefix}: missing or invalid 'detail_url'.`);
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

export function extractDomain(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return url.hostname;
  } catch {
    return baseUrl;
  }
}
