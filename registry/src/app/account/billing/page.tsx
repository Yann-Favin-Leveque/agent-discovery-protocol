import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById, getUserSubscriptions, getUserTransactions } from "@/lib/db";

export const metadata: Metadata = {
  title: "Billing — AgentDNS",
  description: "Manage your subscriptions and payment methods.",
};

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login?return_to=/account/billing");

  const user = await getUserById(session.userId);
  if (!user) redirect("/login");

  const subscriptions = await getUserSubscriptions(user.id);
  const transactions = await getUserTransactions(user.id, 50);

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const monthlySpend = activeSubscriptions.reduce(
    (sum, s) =>
      sum +
      (s.interval === "month"
        ? s.price_cents
        : Math.round(s.price_cents / 12)),
    0
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/account"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Account
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Billing</h1>
      <p className="mt-4 text-muted">
        Manage your API subscriptions, payment methods, and view transaction
        history.
      </p>

      {/* Monthly spend */}
      <section className="mt-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <p className="text-sm text-muted">Monthly spend</p>
            <p className="mt-1 font-mono text-2xl font-bold">
              ${(monthlySpend / 100).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <p className="text-sm text-muted">Active plans</p>
            <p className="mt-1 font-mono text-2xl font-bold">
              {activeSubscriptions.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface p-5">
            <p className="text-sm text-muted">Payment method</p>
            {user.payment_method_added ? (
              <p className="mt-1 text-sm text-accent">Active</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">Not set up</p>
                <Link
                  href="/pay/setup"
                  className="mt-1 inline-block text-sm text-accent hover:underline"
                >
                  Add card
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Active subscriptions */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Active subscriptions</h2>
        {activeSubscriptions.length === 0 ? (
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
        ) : (
          <div className="mt-4 space-y-2">
            {activeSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-surface p-4"
              >
                <div>
                  <p className="font-semibold">{sub.service_domain}</p>
                  <p className="text-sm text-muted">
                    {sub.plan_name} · $
                    {(sub.price_cents / 100).toFixed(2)}/{sub.interval}
                  </p>
                  <p className="text-xs text-muted">
                    Since{" "}
                    {new Date(sub.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cancelled / past subscriptions */}
      {subscriptions.filter((s) => s.status !== "active").length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Past subscriptions</h2>
          <div className="mt-4 space-y-2">
            {subscriptions
              .filter((s) => s.status !== "active")
              .map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-surface p-4 opacity-60"
                >
                  <div>
                    <p className="font-semibold">{sub.service_domain}</p>
                    <p className="text-sm text-muted">
                      {sub.plan_name} · $
                      {(sub.price_cents / 100).toFixed(2)}/{sub.interval}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-muted">
                    {sub.status}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Transaction history */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Transaction history</h2>
        {transactions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/5 bg-surface p-8 text-center">
            <p className="text-sm text-muted">No transactions yet</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/5 bg-surface">
            <div className="border-b border-white/5 px-5 py-3">
              <div className="grid grid-cols-4 text-sm font-medium text-muted">
                <span>Date</span>
                <span>Service</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>
            </div>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-4 items-center border-b border-white/5 px-5 py-3 text-sm last:border-b-0"
              >
                <span className="text-muted">
                  {new Date(tx.created_at).toLocaleDateString()}
                </span>
                <span className="font-medium">{tx.service_domain}</span>
                <span className="text-right font-mono">
                  ${(tx.amount_cents / 100).toFixed(2)}
                </span>
                <span
                  className={`text-right text-xs ${
                    tx.status === "succeeded"
                      ? "text-accent"
                      : tx.status === "failed"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }`}
                >
                  {tx.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
