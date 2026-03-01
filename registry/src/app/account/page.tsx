import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById, getUserSubscriptions, getUserTransactions } from "@/lib/db";
import { GatewayTokenSection } from "./gateway-token";

export const metadata: Metadata = {
  title: "Account — AgentDNS",
  description: "Manage your AgentDNS account, subscriptions, and billing.",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user) redirect("/login");

  const subscriptions = await getUserSubscriptions(user.id);
  const transactions = await getUserTransactions(user.id, 10);

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
      <h1 className="text-4xl font-bold">Account</h1>

      {/* User info */}
      <div className="mt-8 rounded-xl border border-white/5 bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">
              {user.name || user.email}
            </p>
            <p className="text-sm text-muted">{user.email}</p>
            <p className="mt-1 text-xs text-muted">
              Signed in with{" "}
              <span className="capitalize text-foreground">
                {user.provider}
              </span>
              {" · "}Member since{" "}
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
          <a
            href="/api/auth/logout"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-muted transition-colors hover:border-red-500/30 hover:text-red-400"
          >
            Sign out
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/5 bg-surface p-5">
          <p className="text-sm text-muted">Active subscriptions</p>
          <p className="mt-1 font-mono text-2xl font-bold">
            {activeSubscriptions.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-surface p-5">
          <p className="text-sm text-muted">Monthly spend</p>
          <p className="mt-1 font-mono text-2xl font-bold">
            ${(monthlySpend / 100).toFixed(2)}
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

      {/* Subscriptions */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Subscriptions</h2>
          <Link
            href="/account/billing"
            className="text-sm text-accent hover:underline"
          >
            View billing
          </Link>
        </div>
        {activeSubscriptions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/5 bg-surface p-8 text-center">
            <p className="text-muted">No active subscriptions</p>
            <p className="mt-2 text-sm text-muted">
              Use the{" "}
              <Link
                href="/directory"
                className="text-accent hover:underline"
              >
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
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent transactions</h2>
          <Link
            href="/account/billing"
            className="text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>
        {transactions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/5 bg-surface p-8 text-center">
            <p className="text-sm text-muted">No transactions yet</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/5 bg-surface">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-b border-white/5 px-5 py-3 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium">{tx.service_domain}</p>
                  <p className="text-xs text-muted">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono">
                    ${(tx.amount_cents / 100).toFixed(2)}
                  </p>
                  <p
                    className={`text-xs ${tx.status === "succeeded" ? "text-accent" : "text-yellow-400"}`}
                  >
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gateway token */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Gateway connection</h2>
        <p className="mt-2 text-sm text-muted">
          Connect the Agent Gateway MCP to your account for cloud-synced
          credentials and subscription management.
        </p>
        <GatewayTokenSection />
      </section>
    </div>
  );
}
