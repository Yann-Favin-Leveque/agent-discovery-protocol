"use client";

import { useState } from "react";

export function GatewayTokenSection() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateToken() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/token");
      const data = await res.json();
      if (data.success) {
        setToken(data.data.registry_token);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 rounded-xl border border-white/5 bg-surface p-6">
      <p className="text-sm text-muted">
        Generate a token to connect the Agent Gateway MCP to your account. Use
        it with <code className="text-accent">agent-gateway init</code>.
      </p>
      {!token ? (
        <button
          onClick={generateToken}
          disabled={loading}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-medium text-black transition-colors hover:bg-accent-light disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate registry token"}
        </button>
      ) : (
        <div className="mt-4">
          <div className="flex items-start gap-2">
            <code className="flex-1 rounded-lg bg-black p-3 font-mono text-xs text-accent break-all select-all">
              {token}
            </code>
            <button
              onClick={copyToken}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            This token expires in 30 days. Keep it secret — it grants access to
            your account.
          </p>
        </div>
      )}
    </div>
  );
}
