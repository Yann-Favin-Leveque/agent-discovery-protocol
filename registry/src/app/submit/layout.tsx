import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit a Service — AgentDNS",
  description:
    "Make your API discoverable by AI agents. Submit your domain and the registry will crawl your /.well-known/agent manifest.",
  openGraph: {
    title: "Submit a Service — AgentDNS",
    description:
      "Make your API discoverable by AI agents. Submit your domain to the registry.",
  },
};

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
