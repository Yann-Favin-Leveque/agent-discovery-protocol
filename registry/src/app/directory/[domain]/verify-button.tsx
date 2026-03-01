"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyButton({ domain }: { domain: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    verified: boolean;
    trust_level?: string;
    detail_url_ok?: boolean;
    response_time_ms?: number;
  } | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/verify/${domain}`, { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setError(data.errors?.join(", ") ?? data.error ?? "Verification failed.");
        return;
      }

      setResult(data.data);
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
        <p className="mt-2 max-w-xs text-xs text-red-400">{error}</p>
      )}
      {result && (
        <div className="mt-2 space-y-0.5">
          <p className={`text-xs ${
            result.trust_level === "verified" ? "text-accent" :
            result.trust_level === "community" ? "text-blue-400" :
            "text-yellow-400"
          }`}>
            {result.trust_level === "verified" ? "Verified" :
             result.trust_level === "community" ? "Community" :
             "Unverified"} — {result.response_time_ms}ms
          </p>
          {result.detail_url_ok !== undefined && (
            <p className={`text-xs ${result.detail_url_ok ? "text-accent" : "text-yellow-400"}`}>
              Detail URL: {result.detail_url_ok ? "reachable" : "unreachable"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
