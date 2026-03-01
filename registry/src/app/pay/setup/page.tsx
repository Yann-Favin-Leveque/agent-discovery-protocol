"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function PaymentSetupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "card">("email");

  // Get email from URL params if provided (from gateway redirect)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramEmail = params.get("email");
    if (paramEmail) {
      setEmail(paramEmail);
    }
  }, []);

  async function handleGetSetupIntent() {
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }

      setClientSecret(data.data.client_secret);
      setStep("card");
    } catch {
      setError("Failed to initialize payment setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <Link
        href="/"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Home
      </Link>

      <h1 className="mt-6 text-3xl font-bold">Set up payment method</h1>
      <p className="mt-3 text-muted">
        Save a payment method to subscribe to paid APIs through the AgentDNS gateway.
        Your card is stored securely by Stripe — we never see your full card number.
      </p>

      {success ? (
        <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-6">
          <h2 className="text-xl font-bold text-accent">Payment method saved!</h2>
          <p className="mt-2 text-sm text-muted">
            Your card has been saved. You can now subscribe to paid APIs through the
            gateway. Return to your agent to continue.
          </p>
        </div>
      ) : step === "email" ? (
        <div className="mt-8 space-y-6">
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
              The email associated with your AgentDNS account.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGetSetupIntent}
            disabled={loading || !email}
            className="w-full rounded-lg bg-accent px-5 py-3 font-medium text-black transition-colors hover:bg-accent-light disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Continue"}
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-white/10 bg-surface p-6">
            <p className="text-sm text-muted">
              Stripe Elements card form will load here.
            </p>
            <p className="mt-2 text-xs text-muted">
              Client secret: <code className="text-accent">{clientSecret?.slice(0, 20)}...</code>
            </p>
            <p className="mt-4 text-sm text-muted">
              To complete the integration, add{" "}
              <code className="text-accent">@stripe/stripe-js</code> and{" "}
              <code className="text-accent">@stripe/react-stripe-js</code> for the
              embedded card form. For now, use the{" "}
              <a
                href="https://dashboard.stripe.com/test/setup-intents"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Stripe Dashboard
              </a>{" "}
              to manage payment methods.
            </p>
          </div>

          <button
            onClick={() => setSuccess(true)}
            className="w-full rounded-lg bg-accent px-5 py-3 font-medium text-black transition-colors hover:bg-accent-light"
          >
            I&apos;ve added my card in Stripe Dashboard
          </button>

          <button
            onClick={() => {
              setStep("email");
              setClientSecret(null);
            }}
            className="w-full rounded-lg border border-white/10 px-5 py-3 font-medium text-foreground transition-colors hover:bg-white/5"
          >
            Back
          </button>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-white/5 bg-surface p-5">
        <h3 className="text-sm font-semibold">Secure payments</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>Payments processed by Stripe — PCI-DSS compliant</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>Your agent can never auto-approve charges</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>Cancel any subscription at any time</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
