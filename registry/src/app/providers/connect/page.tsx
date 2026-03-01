"use client";

import { useState } from "react";
import Link from "next/link";

export default function ConnectStripePage() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for status
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const status = params?.get("status");
  const urlError = params?.get("error");
  const urlDomain = params?.get("domain");

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/providers/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      // Redirect to Stripe onboarding
      window.location.href = data.data.onboarding_url;
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <Link
        href="/docs/providers"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Provider docs
      </Link>

      <h1 className="mt-6 text-3xl font-bold">Connect with Stripe</h1>
      <p className="mt-3 text-muted">
        Connect your Stripe account to receive payments from agents that subscribe to
        your API. The AgentDNS registry handles billing — you get payouts directly to
        your Stripe account.
      </p>

      {/* Success state */}
      {status === "success" && (
        <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-6">
          <h2 className="text-xl font-bold text-accent">Stripe connected!</h2>
          <p className="mt-2 text-sm text-muted">
            Your Stripe account is now connected for <strong className="text-foreground">{urlDomain}</strong>.
            Agents can now subscribe to your paid plans and you&apos;ll receive payouts
            directly to your Stripe account.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/docs/providers"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-light"
            >
              Back to provider docs
            </Link>
            <Link
              href="/directory"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            >
              View directory
            </Link>
          </div>
        </div>
      )}

      {/* Pending state */}
      {status === "pending" && (
        <div className="mt-8 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6">
          <h2 className="text-xl font-bold text-yellow-400">Onboarding incomplete</h2>
          <p className="mt-2 text-sm text-muted">
            Your Stripe account for <strong className="text-foreground">{urlDomain}</strong> needs
            additional information. Please complete the Stripe onboarding to enable payments.
          </p>
        </div>
      )}

      {/* Error from callback */}
      {urlError && (
        <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm text-red-400">
            Something went wrong: {urlError.replace(/_/g, " ")}. Please try again.
          </p>
        </div>
      )}

      {/* Connect form */}
      {!status && (
        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-muted" htmlFor="domain">
              Service domain
            </label>
            <input
              id="domain"
              type="text"
              placeholder="api.example.com"
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              The domain of your service as registered in the AgentDNS directory.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              We&apos;ll use this for your Stripe Connect account.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading || !domain || !email}
            className="w-full rounded-lg bg-[#635BFF] px-5 py-3 font-medium text-white transition-colors hover:bg-[#7A73FF] disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect with Stripe"}
          </button>

          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <h3 className="text-sm font-semibold">How it works</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-accent">1.</span>
                <span>You connect your existing Stripe account (or create one)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-accent">2.</span>
                <span>Add pricing plans to your service manifest</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-accent">3.</span>
                <span>Agents subscribe to your API through the gateway</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-accent">4.</span>
                <span>You receive payouts directly to your bank account</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-muted">
              AgentDNS charges a 10% platform fee on subscriptions to cover discovery,
              auth brokering, payment processing, and support.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
