import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
/** Fetch JSON or YAML from a URL or local file path */
export async function loadSpec(input) {
    let raw;
    if (input.startsWith("http://") || input.startsWith("https://")) {
        const res = await fetch(input, {
            headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch ${input}: ${res.status} ${res.statusText}`);
        }
        raw = await res.text();
    }
    else {
        raw = await readFile(input, "utf-8");
    }
    // Try JSON first, then YAML
    try {
        return JSON.parse(raw);
    }
    catch {
        return parseYaml(raw);
    }
}
/** Convert a string to valid snake_case capability name */
export function toSnakeCase(str) {
    const result = str
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase();
    // Ensure the result starts with a letter (spec requires /^[a-z][a-z0-9_]*$/)
    if (!result || !/^[a-z]/.test(result)) {
        return result ? `api_${result}` : "general";
    }
    return result;
}
/** Truncate a string to max length, ending at a sentence boundary if possible */
export function truncateDescription(text, maxLen = 500) {
    if (!text || text.length <= maxLen)
        return text || "";
    const truncated = text.slice(0, maxLen);
    const lastPeriod = truncated.lastIndexOf(".");
    if (lastPeriod > maxLen * 0.5) {
        return truncated.slice(0, lastPeriod + 1);
    }
    return truncated.slice(0, truncated.lastIndexOf(" ")) + "...";
}
/** Map an OpenAPI type string to our simplified type system */
export function mapParamType(schema, type) {
    if (!schema && !type)
        return "string";
    const t = schema?.type || type || "string";
    if (t === "array") {
        const itemType = schema?.items?.type || "string";
        return `${itemType}[]`;
    }
    if (t === "integer")
        return "number";
    return t;
}
/** Generate a plausible example value for a given type */
export function generateExample(name, type, schema) {
    if (schema?.example !== undefined)
        return schema.example;
    if (schema?.default !== undefined)
        return schema.default;
    if (schema?.enum && Array.isArray(schema.enum))
        return schema.enum[0];
    const nameLower = name.toLowerCase();
    switch (type) {
        case "string":
            if (nameLower.includes("email"))
                return "user@example.com";
            if (nameLower.includes("url") || nameLower.includes("uri"))
                return "https://example.com";
            if (nameLower.includes("id"))
                return "abc_123";
            if (nameLower.includes("name"))
                return "Example";
            if (nameLower.includes("date") || nameLower.includes("time"))
                return "2025-01-15T10:00:00Z";
            if (nameLower.includes("phone"))
                return "+1234567890";
            if (nameLower.includes("currency"))
                return "USD";
            return "example_value";
        case "number":
            if (nameLower.includes("amount") || nameLower.includes("price"))
                return 100;
            if (nameLower.includes("limit") || nameLower.includes("count"))
                return 10;
            if (nameLower.includes("page"))
                return 1;
            return 42;
        case "boolean":
            return true;
        case "object":
            return {};
        case "string[]":
            if (nameLower.includes("email"))
                return ["user@example.com"];
            if (nameLower.includes("tag"))
                return ["tag1", "tag2"];
            return ["value1"];
        default:
            if (type.endsWith("[]"))
                return [];
            return "example_value";
    }
}
/** Validate a manifest against the spec rules */
export function validateManifest(manifest) {
    const errors = [];
    if (manifest.spec_version !== "1.0") {
        errors.push(`spec_version must be "1.0", got "${manifest.spec_version}"`);
    }
    if (!manifest.name || manifest.name.length > 100) {
        errors.push("name is required and must be <= 100 characters");
    }
    if (!manifest.description || manifest.description.length < 20 || manifest.description.length > 500) {
        errors.push("description must be 20-500 characters");
    }
    if (!manifest.base_url) {
        errors.push("base_url is required");
    }
    else if (manifest.base_url.endsWith("/")) {
        errors.push("base_url must not end with trailing slash");
    }
    if (!manifest.auth || !["oauth2", "api_key", "none"].includes(manifest.auth.type)) {
        errors.push("auth.type must be oauth2, api_key, or none");
    }
    if (manifest.auth?.type === "oauth2") {
        if (!manifest.auth.authorization_url)
            errors.push("OAuth2 requires authorization_url");
        if (!manifest.auth.token_url)
            errors.push("OAuth2 requires token_url");
    }
    if (manifest.auth?.type === "api_key") {
        if (!manifest.auth.header)
            errors.push("api_key requires header");
    }
    if (!manifest.capabilities || manifest.capabilities.length === 0) {
        errors.push("At least one capability is required");
    }
    const names = new Set();
    for (const cap of manifest.capabilities || []) {
        if (!/^[a-z][a-z0-9_]*$/.test(cap.name)) {
            errors.push(`Capability name "${cap.name}" is not valid snake_case`);
        }
        if (names.has(cap.name)) {
            errors.push(`Duplicate capability name: ${cap.name}`);
        }
        names.add(cap.name);
        if (!cap.description || cap.description.length < 10) {
            errors.push(`Capability "${cap.name}" description is too short`);
        }
        if (!cap.detail_url || (!cap.detail_url.startsWith("/") && !cap.detail_url.startsWith("http"))) {
            errors.push(`Capability "${cap.name}" detail_url must start with / or http`);
        }
    }
    return { valid: errors.length === 0, errors };
}
/** Ensure output directory exists */
export async function ensureDir(dir) {
    const { mkdir } = await import("fs/promises");
    await mkdir(dir, { recursive: true });
}
/** Write JSON to a file with pretty formatting */
export async function writeJson(filePath, data) {
    const { writeFile } = await import("fs/promises");
    const { dirname } = await import("path");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
/** Simple logger with timestamps */
export const log = {
    info: (msg) => console.log(`[INFO]  ${msg}`),
    warn: (msg) => console.warn(`[WARN]  ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    success: (msg) => console.log(`[OK]    ${msg}`),
};
