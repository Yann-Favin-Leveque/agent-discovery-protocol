"use client";

import { useState } from "react";

export function ReportButton({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, reason: reason.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "Thank you. We'll review this report." });
        setReason("");
      } else {
        setResult({
          success: false,
          message: data.error ?? "Something went wrong.",
        });
      }
    } catch {
      setResult({ success: false, message: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted transition-colors hover:text-red-400"
      >
        Report
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-red-500/20 bg-surface-light p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-red-400">Report this service</h4>
        <button
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {result ? (
        <p
          className={`mt-3 text-sm ${
            result.success ? "text-accent" : "text-red-400"
          }`}
        >
          {result.message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reporting this service? (min 5 characters)"
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50"
          />
          <button
            type="submit"
            disabled={loading || reason.trim().length < 5}
            className="mt-2 rounded-lg bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Submit report"}
          </button>
        </form>
      )}
    </div>
  );
}
