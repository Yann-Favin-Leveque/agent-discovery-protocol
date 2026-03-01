"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ServiceHealth {
  domain: string;
  name: string;
  status: "up" | "down" | "degraded" | "unknown" | "not_monitored";
  response_time_ms: number | null;
  uptime_percentage: number;
  last_checked: string | null;
  trust_level: string;
}

interface HealthData {
  overall_status: "healthy" | "degraded" | "down";
  total_monitored: number;
  healthy: number;
  degraded: number;
  down: number;
  services: ServiceHealth[];
  last_updated: string;
}

type FilterStatus = "all" | "up" | "down" | "degraded" | "community";

export function StatusDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      }
    } catch {
      setError("Failed to load status data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredServices = data?.services.filter((s) => {
    if (filter === "community") {
      if (s.trust_level !== "community") return false;
    } else if (filter !== "all") {
      if (s.status !== filter) return false;
      if (s.trust_level === "community") return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return s.domain.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  const overallColor =
    !data || data.down > 0 ? "red" : data.degraded > 0 ? "yellow" : "green";

  const overallLabel =
    !data
      ? "Loading..."
      : data.down > 0
        ? "Some services are down"
        : data.degraded > 0
          ? "Some services degraded"
          : "All systems operational";

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold">Service Status</h1>
        <p className="mt-2 text-muted">
          Real-time health monitoring for the AgentDNS registry
        </p>
      </div>

      {/* Trust level note */}
      <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 px-5 py-3 text-sm text-blue-300">
        Only verified services are health-monitored.{" "}
        <Link href="/docs/trust-levels" className="text-blue-400 underline hover:text-blue-300">
          Learn about trust levels &rarr;
        </Link>
      </div>

      {/* Overall status banner */}
      <div
        className={`mt-10 rounded-xl border p-8 text-center ${
          overallColor === "green"
            ? "border-accent/20 bg-accent/5"
            : overallColor === "yellow"
              ? "border-yellow-500/20 bg-yellow-500/5"
              : "border-red-500/20 bg-red-500/5"
        }`}
      >
        <div className="flex items-center justify-center gap-3">
          <span
            className={`inline-block h-4 w-4 rounded-full ${
              overallColor === "green"
                ? "bg-accent shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                : overallColor === "yellow"
                  ? "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]"
                  : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
            }`}
          />
          <span className="text-2xl font-bold">{overallLabel}</span>
        </div>
        {data && (
          <p className="mt-3 font-mono text-sm text-muted">
            {data.healthy} of {data.total_monitored} services healthy
            {data.degraded > 0 && ` · ${data.degraded} degraded`}
            {data.down > 0 && ` · ${data.down} down`}
          </p>
        )}
      </div>

      {/* Filters & search */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "up", "down", "degraded", "community"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? f === "community" ? "bg-blue-500 text-white" : "bg-accent text-background"
                  : "bg-surface-light text-muted hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "up" ? "Up" : f === "down" ? "Down" : f === "degraded" ? "Degraded" : "Community"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-white/10 bg-surface-light px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none"
        />
      </div>

      {/* Service list */}
      <div className="mt-6 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="ml-3 text-muted">Loading status data...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="py-12 text-center text-muted">
            {data?.total_monitored === 0
              ? "No services are being monitored yet."
              : "No services match your filter."}
          </div>
        ) : (
          filteredServices.map((service) => (
            <ServiceStatusRow key={service.domain} service={service} />
          ))
        )}
      </div>

      {/* Footer note */}
      {data && (
        <div className="mt-8 text-center text-xs text-muted">
          Auto-refreshing every 60 seconds · Last updated{" "}
          {new Date(data.last_updated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function ServiceStatusRow({ service }: { service: ServiceHealth }) {
  // Community services: show info box instead of health data
  if (service.trust_level === "community") {
    return (
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-5 py-4">
        <div className="flex items-center gap-4">
          <span className="text-lg" title="Community">🔵</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link href={`/directory/${service.domain}`} className="font-semibold hover:text-accent transition-colors">
                {service.name}
              </Link>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">Community</span>
            </div>
            <p className="font-mono text-xs text-muted">{service.domain}</p>
            <p className="mt-2 text-sm text-blue-300/80">
              This is a community-maintained manifest. Health monitoring is not available because this service
              doesn&apos;t host its own <code className="text-blue-400">/.well-known/agent</code> endpoint yet.{" "}
              <Link href="/docs/trust-levels" className="text-blue-400 underline hover:text-blue-300">
                Learn more about trust levels &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statusIcon =
    service.status === "up"
      ? "🟢"
      : service.status === "down"
        ? "🔴"
        : service.status === "degraded"
          ? "🟡"
          : "⚪";

  const statusLabel =
    service.status === "up"
      ? "Operational"
      : service.status === "down"
        ? "Down"
        : service.status === "degraded"
          ? "Degraded"
          : "Unknown";

  return (
    <Link
      href={`/directory/${service.domain}`}
      className="flex items-center justify-between rounded-lg border border-white/5 bg-surface-light px-5 py-4 transition-colors hover:border-accent/20 hover:bg-surface-lighter"
    >
      <div className="flex items-center gap-4">
        <span className="text-lg" title={statusLabel}>
          {statusIcon}
        </span>
        <div>
          <p className="font-semibold">{service.name}</p>
          <p className="font-mono text-xs text-muted">{service.domain}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 text-right">
        <div>
          <p className="font-mono text-sm">
            {service.response_time_ms !== null
              ? `${service.response_time_ms}ms`
              : "—"}
          </p>
          <p className="text-xs text-muted">Response</p>
        </div>
        <div>
          <p
            className={`font-mono text-sm ${
              service.uptime_percentage >= 99.5
                ? "text-accent"
                : service.uptime_percentage >= 95
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {service.uptime_percentage}%
          </p>
          <p className="text-xs text-muted">Uptime (7d)</p>
        </div>
        <div className="hidden sm:block">
          <p className="font-mono text-xs text-muted">
            {service.last_checked
              ? formatRelativeTime(service.last_checked)
              : "Never"}
          </p>
          <p className="text-xs text-muted">Last check</p>
        </div>
      </div>
    </Link>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
