import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing — AgentDNS",
  description: "Manage your subscriptions and payment methods.",
};

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Home
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Billing</h1>
      <p className="mt-4 text-muted">
        Manage your API subscriptions, payment methods, and view transaction history.
      </p>

      {/* Auth required notice */}
      <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
        <h2 className="text-lg font-semibold text-yellow-400">Sign in required</h2>
        <p className="mt-2 text-sm text-muted">
          This page requires authentication. Sign in with your AgentDNS account to
          manage your billing.
        </p>
      </div>

      {/* Subscriptions section (placeholder) */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Active subscriptions</h2>
        <div className="mt-4 rounded-xl border border-white/5 bg-surface p-8 text-center">
          <p className="text-muted">No active subscriptions</p>
          <p className="mt-2 text-sm text-muted">
            Use the{" "}
            <Link href="/directory" className="text-accent hover:underline">
              directory
            </Link>{" "}
            to discover APIs, then subscribe through the gateway.
          </p>
        </div>
      </section>

      {/* Monthly spend (placeholder) */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Monthly spend</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <p className="text-sm text-muted">This month</p>
            <p className="mt-1 text-2xl font-bold font-mono">$0.00</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <p className="text-sm text-muted">Active plans</p>
            <p className="mt-1 text-2xl font-bold font-mono">0</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <p className="text-sm text-muted">Payment method</p>
            <p className="mt-1 text-sm text-muted">Not set up</p>
            <Link
              href="/pay/setup"
              className="mt-2 inline-block text-sm text-accent hover:underline"
            >
              Add card
            </Link>
          </div>
        </div>
      </section>

      {/* Transaction history (placeholder) */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Transaction history</h2>
        <div className="mt-4 rounded-xl border border-white/5 bg-surface">
          <div className="border-b border-white/5 px-5 py-3">
            <div className="grid grid-cols-5 text-sm font-medium text-muted">
              <span>Date</span>
              <span>Service</span>
              <span>Plan</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>
          </div>
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted">No transactions yet</p>
          </div>
        </div>
      </section>
    </div>
  );
}
