import type { Metadata } from "next";
import { StatusDashboard } from "./status-dashboard";

export const metadata: Metadata = {
  title: "Service Status",
  description: "Real-time health monitoring for all services in the AgentDNS registry.",
};

export default function StatusPage() {
  return <StatusDashboard />;
}
