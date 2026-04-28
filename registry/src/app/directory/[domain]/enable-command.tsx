"use client";

import { useState } from "react";

const COMMAND = "agent-gateway config";

export function EnableCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can fail in non-secure contexts; ignore silently.
    }
  }

  return (
    <button
      onClick={copy}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black px-4 py-3 text-left transition-colors hover:border-accent/30"
    >
      <code className="font-mono text-sm text-accent">{COMMAND}</code>
      <span className="font-mono text-xs text-muted">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
