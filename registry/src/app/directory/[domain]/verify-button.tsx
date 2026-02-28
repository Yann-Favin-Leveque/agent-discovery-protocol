"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyButton({ domain }: { domain: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/services/${domain}`, { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setError(data.errors?.join(", ") ?? data.error ?? "Verification failed.");
        return;
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleVerify}
        disabled={loading}
        className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {loading ? "Verifying..." : "Verify now"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
