"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "discover" | "paste";

export default function SubmitPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("discover");
  const [domain, setDomain] = useState("");
  const [manifest, setManifest] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [pricingModel, setPricingModel] = useState<"free" | "pay_per_use" | "paid_tiered">("free");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

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

      // Send the contact / pricing / notes fields too. The API does not yet
      // persist them but we want to reserve the shape so this form does not
      // need a second redesign once the review backend lands.
      if (contactEmail.trim()) body.contact_email = contactEmail.trim();
      body.pricing_model = pricingModel;
      if (notes.trim()) body.submission_notes = notes.trim();

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
      <h1 className="text-4xl font-bold">Submit your service</h1>
      <p className="mt-3 text-muted">
        List your API in the AgentDNS catalog so any agent using the gateway
        can discover it. We review submissions within 48h.
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
              Service domain <span className="text-red-400">*</span>
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted">https://</span>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="api.example.com"
                required
                className="flex-1 rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-sm text-muted">/.well-known/agent</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              We&apos;ll fetch your manifest from{" "}
              <code className="text-accent">
                https://{domain || "{domain}"}/.well-known/agent
              </code>
              , validate it, and register your service.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-muted" htmlFor="manifest">
              Manifest JSON <span className="text-red-400">*</span>
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
              Use this when your service does not yet expose{" "}
              <code className="text-accent">/.well-known/agent</code>. The
              service will be registered as unverified until the live endpoint
              is reachable.
            </p>
          </div>
        )}

        {/* Contact email */}
        <div>
          <label className="block text-sm font-medium text-muted" htmlFor="contact_email">
            Contact email <span className="text-red-400">*</span>
          </label>
          <input
            id="contact_email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="mt-2 text-xs text-muted">
            Used for review feedback and the future provider partner program.
            Not displayed publicly.
          </p>
        </div>

        {/* Pricing model */}
        <div>
          <label className="block text-sm font-medium text-muted">
            Pricing model
          </label>
          <p className="mt-1 text-xs text-muted">
            Informational — helps us tag your listing. The actual billing
            handling depends on your tier in our service review.
          </p>
          <div className="mt-3 space-y-2">
            {([
              ["free", "Free", "No charge to call your API."],
              ["pay_per_use", "Pay-per-use", "Per-call or per-unit pricing."],
              ["paid_tiered", "Paid tiered", "Monthly plans with quotas."],
            ] as const).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  pricingModel === value
                    ? "border-accent/40 bg-accent/5"
                    : "border-white/10 bg-surface-light hover:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="pricing_model"
                  value={value}
                  checked={pricingModel === value}
                  onChange={() => setPricingModel(value)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted">{hint}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-muted" htmlFor="notes">
            Notes <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you want us to know during review — special access, pre-release status, billing details, etc."
            rows={4}
            className="mt-2 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
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
              Thanks. We&apos;ll review within 48h
              {contactEmail.trim() ? (
                <>
                  {" "}and email you at{" "}
                  <span className="font-mono">{contactEmail}</span>
                </>
              ) : null}
              . Redirecting to{" "}
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
            : "Submit for review"}
        </button>

        <p className="text-center text-xs text-muted">
          No payment setup required. AgentDNS handles billing for v1 services
          centrally — see{" "}
          <a href="/docs/providers" className="text-accent hover:underline">
            provider docs
          </a>
          .
        </p>
      </form>
    </div>
  );
}
