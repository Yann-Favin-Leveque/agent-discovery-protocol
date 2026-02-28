"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "discover" | "paste";

export default function SubmitPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("discover");
  const [domain, setDomain] = useState("");
  const [manifest, setManifest] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSuccess(null);

    try {
      const body =
        mode === "discover"
          ? { domain: domain.trim() }
          : { manifest: JSON.parse(manifest) };

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
