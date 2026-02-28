"use client";

import { useState } from "react";

export function ManifestToggle({ manifest }: { manifest: object }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <span>{show ? "Hide" : "Show"} raw manifest</span>
        <span className="font-mono text-xs">{show ? "▲" : "▼"}</span>
      </button>

      {show && (
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-surface-light p-5 font-mono text-xs leading-relaxed text-foreground">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      )}
    </div>
  );
}
