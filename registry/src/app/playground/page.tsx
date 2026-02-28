"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ValidationError {
  path: string;
  message: string;
}

const EXAMPLE_MANIFEST = JSON.stringify(
  {
    spec_version: "1.0",
    name: "My API",
    description:
      "A brief description of what your API does, written for an LLM to understand when to use it.",
    base_url: "https://api.example.com",
    auth: { type: "none" },
    capabilities: [
      {
        name: "do_something",
        description: "Describe what this capability does in 1-2 sentences.",
        detail_url: "/capabilities/do_something",
      },
    ],
  },
  null,
  2
);

export default function PlaygroundPage() {
  const router = useRouter();
  const [input, setInput] = useState(EXAMPLE_MANIFEST);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [valid, setValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    domain?: string;
  } | null>(null);

  const validate = useCallback(async (json: string) => {
    if (!json.trim()) {
      setValid(null);
      setErrors([]);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      setValid(false);
      setErrors([
        {
          path: "$",
          message: `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`,
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setValid(data.valid);
      setErrors(data.errors ?? []);
    } catch {
      setValid(false);
      setErrors([{ path: "$", message: "Validation request failed." }]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => validate(input), 400);
    return () => clearTimeout(timer);
  }, [input, validate]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const parsed = JSON.parse(input);
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest: parsed }),
      });
      const data = await res.json();

      if (!data.success) {
        setSubmitResult({
          success: false,
          message: data.errors?.join(", ") ?? data.error ?? "Submission failed.",
        });
        return;
      }

      setSubmitResult({
        success: true,
        message: "Registered! Redirecting...",
        domain: data.data.domain,
      });
      setTimeout(() => router.push(`/directory/${data.data.domain}`), 1500);
    } catch {
      setSubmitResult({ success: false, message: "Invalid JSON or request failed." });
    } finally {
      setSubmitting(false);
    }
  }

  // Parse manifest for preview
  let preview: { name?: string; description?: string; capabilities?: Array<{ name: string; description: string }> } | null = null;
  if (valid) {
    try {
      preview = JSON.parse(input);
    } catch {
      // ignore
    }
  }

  // Map error paths to approximate line numbers
  const lineMap = new Map<string, number>();
  if (errors.length > 0) {
    const lines = input.split("\n");
    for (const err of errors) {
      const searchKey = err.path === "$" ? null : err.path.split(".").pop() ?? null;
      if (searchKey) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`"${searchKey}"`)) {
            lineMap.set(err.path, i + 1);
            break;
          }
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-bold">Manifest Validator</h1>
      <p className="mt-3 text-muted">
        Paste your manifest JSON below. Validation runs in real-time as you type.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted">Manifest JSON</label>
            {loading && (
              <span className="text-xs text-muted">Validating...</span>
            )}
          </div>
          <div className="relative mt-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              rows={24}
              className={`w-full rounded-xl border bg-surface-light p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 ${
                valid === true
                  ? "border-accent/30 focus:ring-accent"
                  : valid === false
                    ? "border-red-500/30 focus:ring-red-500"
                    : "border-white/10 focus:ring-white/20"
              }`}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setInput(EXAMPLE_MANIFEST)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              Reset to example
            </button>
            <button
              onClick={() => {
                try {
                  setInput(JSON.stringify(JSON.parse(input), null, 2));
                } catch {
                  // ignore if invalid JSON
                }
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              Format JSON
            </button>
          </div>
        </div>

        {/* Result panel */}
        <div>
          {/* Status */}
          {valid === true && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-5">
              <div className="flex items-center gap-2">
                <span className="text-lg text-accent">&#10003;</span>
                <span className="font-semibold text-accent">
                  Looks good!
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                This manifest is valid against the Agent Discovery Protocol spec v1.0.
              </p>
            </div>
          )}

          {valid === false && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
              <div className="flex items-center gap-2">
                <span className="text-lg text-red-400">&#10007;</span>
                <span className="font-semibold text-red-400">
                  {errors.length} {errors.length === 1 ? "error" : "errors"} found
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {errors.map((err, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-mono text-red-300">
                      {err.path}
                      {lineMap.has(err.path) && (
                        <span className="text-red-400/60">
                          {" "}(line {lineMap.get(err.path)})
                        </span>
                      )}
                    </span>
                    <span className="text-red-300/80">: {err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {valid === null && (
            <div className="rounded-xl border border-white/5 bg-surface-light p-5">
              <p className="text-sm text-muted">
                Start typing or paste a manifest to see validation results.
              </p>
            </div>
          )}

          {/* Preview */}
          {valid && preview && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted">
                Directory preview
              </h3>
              <div className="mt-3 rounded-xl border border-white/5 bg-surface-light p-5">
                <h4 className="font-semibold">{preview.name}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {preview.description}
                </p>
                {preview.capabilities && (
                  <div className="mt-4 space-y-2">
                    {preview.capabilities.map((cap, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-surface p-3"
                      >
                        <span className="font-mono text-xs text-accent">
                          {cap.name}
                        </span>
                        <p className="mt-1 text-xs text-muted">
                          {cap.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit button */}
              <div className="mt-6">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit to registry"}
                </button>

                {submitResult && (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-sm ${
                      submitResult.success
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-red-500/30 bg-red-500/10 text-red-300"
                    }`}
                  >
                    {submitResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
