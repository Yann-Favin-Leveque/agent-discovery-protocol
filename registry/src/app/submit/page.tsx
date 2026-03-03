"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "discover" | "paste";

interface CredentialField {
  name: string;
  label: string;
  description: string;
  secret: boolean;
}

export default function SubmitPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("discover");
  const [domain, setDomain] = useState("");
  const [manifest, setManifest] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  // Setup guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guidePortalUrl, setGuidePortalUrl] = useState("");
  const [guideAuthType, setGuideAuthType] = useState<"oauth2" | "api_key" | "none">("api_key");
  const [guideSteps, setGuideSteps] = useState<string[]>([""]);
  const [guideFields, setGuideFields] = useState<CredentialField[]>([
    { name: "", label: "", description: "", secret: false },
  ]);
  const [guideTestMethod, setGuideTestMethod] = useState("GET");
  const [guideTestPath, setGuideTestPath] = useState("");
  const [guideTestStatus, setGuideTestStatus] = useState("200");
  const [guideNotes, setGuideNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(null);

    try {
      const body: Record<string, unknown> =
        mode === "discover"
          ? { domain: domain.trim() }
          : { manifest: JSON.parse(manifest) };

      // Include setup guide if filled out
      if (showGuide && guidePortalUrl.trim()) {
        const filledSteps = guideSteps.filter((s) => s.trim());
        const filledFields = guideFields.filter((f) => f.name.trim());
        body.setup_guide = {
          portal_url: guidePortalUrl.trim(),
          auth_type: guideAuthType,
          ...(filledSteps.length > 0 ? { steps: filledSteps } : {}),
          ...(filledFields.length > 0 ? { credential_fields: filledFields } : {}),
          ...(guideTestPath.trim()
            ? {
                test_endpoint: {
                  method: guideTestMethod,
                  path: guideTestPath.trim(),
                  expected_status: parseInt(guideTestStatus, 10),
                },
              }
            : {}),
          ...(guideNotes.trim() ? { notes: guideNotes.trim() } : {}),
        };
      }

      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        setErrors(data.errors ?? [data.error ?? "Unknown error."]);
        return;
      }

      setSuccess(data.data.domain);
      setTimeout(() => {
        router.push(`/directory/${data.data.domain}`);
      }, 1500);
    } catch (err) {
      if (mode === "paste") {
        setErrors(["Invalid JSON. Please check your manifest syntax."]);
      } else {
        setErrors([err instanceof Error ? err.message : "Request failed."]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-4xl font-bold">Submit Your Service</h1>
      <p className="mt-3 text-muted">
        Register your API in the directory so any AI agent can discover it.
      </p>

      {/* Mode tabs */}
      <div className="mt-8 flex gap-2">
        <button
          onClick={() => { setMode("discover"); setErrors([]); setSuccess(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "discover"
              ? "bg-accent text-black"
              : "border border-white/10 text-muted hover:text-foreground"
          }`}
        >
          Auto-discover
        </button>
        <button
          onClick={() => { setMode("paste"); setErrors([]); setSuccess(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "paste"
              ? "bg-accent text-black"
              : "border border-white/10 text-muted hover:text-foreground"
          }`}
        >
          Paste manifest
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {mode === "discover" ? (
          <div>
            <label className="block text-sm font-medium text-muted" htmlFor="domain">
              Domain
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted">https://</span>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="api.yourservice.com"
                required
                className="flex-1 rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-sm text-muted">/.well-known/agent</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              We&apos;ll fetch the endpoint, validate the manifest, and register your service.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-muted" htmlFor="manifest">
              Manifest JSON
            </label>
            <textarea
              id="manifest"
              value={manifest}
              onChange={(e) => setManifest(e.target.value)}
              placeholder={`{
  "spec_version": "1.0",
  "name": "My API",
  "description": "...",
  "base_url": "https://api.example.com",
  "auth": { "type": "none" },
  "capabilities": [...]
}`}
              required
              rows={14}
              className="mt-2 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-2 text-xs text-muted">
              For services that don&apos;t expose the endpoint yet. Service will be registered as unverified.
            </p>
          </div>
        )}

        {/* Setup guide (optional, collapsible) */}
        <div className="rounded-xl border border-white/5 bg-surface">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div>
              <span className="text-sm font-medium text-foreground">
                Setup Guide
              </span>
              <span className="ml-2 rounded bg-white/5 px-2 py-0.5 text-xs text-muted">
                Optional
              </span>
              <p className="mt-1 text-xs text-muted">
                Help users connect to your service faster by providing credential setup instructions.
              </p>
            </div>
            <span className="text-muted">{showGuide ? "\u25B2" : "\u25BC"}</span>
          </button>

          {showGuide && (
            <div className="space-y-4 border-t border-white/5 p-4">
              {/* Portal URL */}
              <div>
                <label className="block text-sm font-medium text-muted">
                  Developer Portal URL
                </label>
                <input
                  type="url"
                  value={guidePortalUrl}
                  onChange={(e) => setGuidePortalUrl(e.target.value)}
                  placeholder="https://console.example.com/credentials"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
                />
              </div>

              {/* Auth type */}
              <div>
                <label className="block text-sm font-medium text-muted">
                  Auth Type
                </label>
                <select
                  value={guideAuthType}
                  onChange={(e) =>
                    setGuideAuthType(e.target.value as "oauth2" | "api_key" | "none")
                  }
                  className="mt-1 rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="api_key">API Key</option>
                  <option value="oauth2">OAuth2</option>
                  <option value="none">None</option>
                </select>
              </div>

              {/* Steps */}
              <div>
                <label className="block text-sm font-medium text-muted">
                  Setup Steps
                </label>
                <div className="mt-1 space-y-2">
                  {guideSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 text-right text-xs text-muted">
                        {i + 1}.
                      </span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => {
                          const next = [...guideSteps];
                          next[i] = e.target.value;
                          setGuideSteps(next);
                        }}
                        placeholder={`Step ${i + 1}`}
                        className="flex-1 rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
                      />
                      {guideSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setGuideSteps(guideSteps.filter((_, j) => j !== i))
                          }
                          className="text-xs text-muted hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setGuideSteps([...guideSteps, ""])}
                    className="text-xs text-accent hover:underline"
                  >
                    + Add step
                  </button>
                </div>
              </div>

              {/* Credential fields */}
              <div>
                <label className="block text-sm font-medium text-muted">
                  Credential Fields
                </label>
                <div className="mt-1 space-y-2">
                  {guideFields.map((field, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-surface-light p-2">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => {
                          const next = [...guideFields];
                          next[i] = { ...next[i], name: e.target.value };
                          setGuideFields(next);
                        }}
                        placeholder="Field name (e.g. api_key)"
                        className="flex-1 min-w-[120px] rounded border border-white/10 bg-surface px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
                      />
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => {
                          const next = [...guideFields];
                          next[i] = { ...next[i], label: e.target.value };
                          setGuideFields(next);
                        }}
                        placeholder="Label (e.g. API Key)"
                        className="flex-1 min-w-[120px] rounded border border-white/10 bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
                      />
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={field.secret}
                          onChange={(e) => {
                            const next = [...guideFields];
                            next[i] = { ...next[i], secret: e.target.checked };
                            setGuideFields(next);
                          }}
                          className="rounded"
                        />
                        Secret
                      </label>
                      {guideFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setGuideFields(guideFields.filter((_, j) => j !== i))
                          }
                          className="text-xs text-muted hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setGuideFields([
                        ...guideFields,
                        { name: "", label: "", description: "", secret: false },
                      ])
                    }
                    className="text-xs text-accent hover:underline"
                  >
                    + Add field
                  </button>
                </div>
              </div>

              {/* Test endpoint */}
              <div>
                <label className="block text-sm font-medium text-muted">
                  Test Endpoint
                </label>
                <p className="text-xs text-muted">
                  An endpoint to verify credentials work after setup.
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={guideTestMethod}
                    onChange={(e) => setGuideTestMethod(e.target.value)}
                    className="rounded border border-white/10 bg-surface-light px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>HEAD</option>
                  </select>
                  <input
                    type="text"
                    value={guideTestPath}
                    onChange={(e) => setGuideTestPath(e.target.value)}
                    placeholder="/v1/me"
                    className="flex-1 rounded border border-white/10 bg-surface-light px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
                  />
                  <span className="text-xs text-muted">expects</span>
                  <input
                    type="text"
                    value={guideTestStatus}
                    onChange={(e) => setGuideTestStatus(e.target.value)}
                    className="w-16 rounded border border-white/10 bg-surface-light px-2 py-1.5 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-muted">
                  Notes
                </label>
                <textarea
                  value={guideNotes}
                  onChange={(e) => setGuideNotes(e.target.value)}
                  placeholder="Tips, gotchas, billing requirements..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="mb-2 text-sm font-medium text-red-400">Validation failed:</p>
            <ul className="space-y-1">
              {errors.map((err, i) => (
                <li key={i} className="text-sm text-red-300">
                  &bull; {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
            <p className="text-sm text-accent">
              Service registered successfully! Redirecting to{" "}
              <span className="font-mono">/directory/{success}</span>...
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light disabled:opacity-50"
        >
          {loading
            ? mode === "discover"
              ? "Discovering..."
              : "Validating..."
            : mode === "discover"
              ? "Discover & register"
              : "Validate & register"}
        </button>
      </form>
    </div>
  );
}
