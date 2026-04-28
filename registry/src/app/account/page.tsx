import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById, getUserEnablement } from "@/lib/db";

export const metadata: Metadata = {
  title: "Account — AgentDNS",
  description: "Manage your AgentDNS account.",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user) redirect("/login");

  // Best-effort enablement count. If this fails for any reason, fall back
  // to a simple "—" so the page still renders.
  let enabledCount: number | null = null;
  try {
    const rows = await getUserEnablement(session.userId);
    enabledCount = rows.filter((r: { enabled: boolean }) => r.enabled).length;
  } catch {
    enabledCount = null;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-4xl font-bold">
        Hello, {user.name || user.email.split("@")[0]}
      </h1>
      <p className="mt-2 text-sm text-muted">{user.email}</p>

      {/* User info */}
      <div className="mt-8 rounded-xl border border-white/5 bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted">
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

      {/* Your gateway */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Your gateway</h2>
        <div className="mt-4 rounded-xl border border-white/5 bg-surface p-6">
          <p className="text-sm text-muted">
            <span className="font-mono text-2xl text-accent">
              {enabledCount ?? "—"}
            </span>
            {" "}
            {enabledCount === 1 ? "service enabled" : "services enabled"}
          </p>
          <p className="mt-3 text-sm text-muted">
            Toggling services on or off, adding a payment method, and pasting
            BYO API keys all happen in the local config page — not here.
          </p>
        </div>
      </section>

      {/* Manage your services */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Manage your services</h2>
        <p className="mt-3 text-sm text-muted">
          All setup happens via the gateway CLI. Run this command in a
          terminal:
        </p>
        <code className="mt-3 block rounded-lg bg-black px-3 py-2 font-mono text-sm text-accent">
          agent-gateway config
        </code>
        <p className="mt-3 text-sm text-muted">
          It opens a local browser page where you can sign in, add a card,
          toggle services, and set per-service spending caps. Don&apos;t have
          the gateway yet?{" "}
          <a href="/docs/agents" className="text-accent hover:underline">
            Install it.
          </a>
        </p>
      </section>

      {/* Billing */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Billing</h2>
        <p className="mt-3 text-sm text-muted">
          Invoices, payment method, and full transaction history live in your
          Stripe customer portal.
        </p>
        <a
          href="/api/users/me/billing-portal"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-accent-light"
        >
          Open Stripe customer portal
        </a>
      </section>

      {/* Delete account */}
      <section className="mt-12 rounded-xl border border-white/5 bg-surface p-6">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="mt-2 text-sm text-muted">
          Account deletion is handled manually for now. Email{" "}
          <a
            href="mailto:support@agent-dns.dev"
            className="text-accent hover:underline"
          >
            support@agent-dns.dev
          </a>{" "}
          and we&apos;ll revoke all credentials, cancel any open invoice, and
          purge your data.
        </p>
      </section>
    </div>
  );
}
