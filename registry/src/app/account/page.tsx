import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export const metadata: Metadata = {
  title: "Account — AgentDNS",
  description: "Manage your AgentDNS account.",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user) redirect("/login");

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

      {/* Gateway setup instructions */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Gateway</h2>
        <p className="mt-2 text-sm text-muted">
          The gateway stores your credentials locally in{" "}
          <code className="text-accent">~/.agent-gateway/credentials.json</code>.
          To set up the gateway:
        </p>
        <div className="mt-4 rounded-xl border border-white/5 bg-surface p-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted">Install the gateway</p>
              <code className="mt-1 block rounded-lg bg-black px-3 py-2 font-mono text-sm text-accent">
                npm install -g agent-gateway-mcp
              </code>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Configure services</p>
              <code className="mt-1 block rounded-lg bg-black px-3 py-2 font-mono text-sm text-accent">
                agent-gateway config
              </code>
              <p className="mt-2 text-sm text-muted">
                Opens a local browser page where you can sign in, add a payment
                method, and toggle services on/off.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
