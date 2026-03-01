"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface HealthData {
  current_status: "up" | "down" | "degraded" | "unknown";
  response_time_ms: number | null;
  uptime_percentage: number;
  last_checked: string | null;
  history: Array<{
    status: string;
    response_time_ms: number | null;
    checked_at: string;
  }>;
}

export function HealthSection({ domain, trustLevel }: { domain: string; trustLevel: string }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (trustLevel !== "verified") {
      setLoading(false);
      return;
    }
    fetch(`/api/health/${domain}?days=7`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domain, trustLevel]);

  if (trustLevel === "community") {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Health</h2>
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <p className="text-sm leading-relaxed text-blue-300">
            This is a community-maintained manifest. Health monitoring is not available because
            this service doesn&apos;t host its own{" "}
            <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">/.well-known/agent</code>{" "}
            endpoint yet.{" "}
            <Link href="/docs/trust-levels" className="text-blue-400 underline hover:text-blue-300">
              Learn more about trust levels &rarr;
            </Link>
          </p>
        </div>
      </section>
    );
  }

  if (trustLevel === "unverified") {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Health</h2>
        <p className="mt-4 text-sm text-muted">
          Health monitoring is not available for unverified services.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Health</h2>
        <div className="mt-4 flex items-center gap-2 text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading health data...
        </div>
      </section>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Health</h2>
        <p className="mt-4 text-sm text-muted">
          No health data available yet. Data will appear after the next scheduled check.
        </p>
      </section>
    );
  }

  const statusBadge =
    data.current_status === "up" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        Operational
      </span>
    ) : data.current_status === "degraded" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-sm text-yellow-400">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
        Degraded
      </span>
    ) : data.current_status === "down" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-sm text-red-400">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        Down
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-sm text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-muted" />
        Unknown
      </span>
    );

  const chartData = data.history.map((h) => ({
    time: new Date(h.checked_at + "Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    response_time: h.response_time_ms,
  }));

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold">Health</h2>

      {/* Status + uptime row */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {statusBadge}
        <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
          <span className="text-xs text-muted">Response time</span>
          <p className="font-mono text-sm">
            {data.response_time_ms !== null ? `${data.response_time_ms}ms` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
          <span className="text-xs text-muted">Uptime (7d)</span>
          <p
            className={`font-mono text-sm ${
              data.uptime_percentage >= 99.5
                ? "text-accent"
                : data.uptime_percentage >= 95
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {data.uptime_percentage}%
          </p>
        </div>
        {data.last_checked && (
          <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
            <span className="text-xs text-muted">Last checked</span>
            <p className="font-mono text-sm">
              {new Date(data.last_checked + "Z").toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Response time chart */}
      {chartData.length > 1 && (
        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-5">
          <h3 className="mb-4 text-sm font-medium text-muted">
            Response Time (last 7 days)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#888888", fontSize: 11 }}
                  tickLine={{ stroke: "#333" }}
                  axisLine={{ stroke: "#333" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#888888", fontSize: 11 }}
                  tickLine={{ stroke: "#333" }}
                  axisLine={{ stroke: "#333" }}
                  unit="ms"
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#ededed",
                  }}
                  labelStyle={{ color: "#888888" }}
                  formatter={(value: number | undefined) => [`${value ?? 0}ms`, "Response time"]}
                />
                <Line
                  type="monotone"
                  dataKey="response_time"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
