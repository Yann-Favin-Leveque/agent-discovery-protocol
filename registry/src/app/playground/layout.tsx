import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playground — AgentDNS",
  description:
    "Validate your Agent Discovery Protocol manifest in real-time. Paste your JSON, see errors instantly, preview how it appears in the directory.",
  openGraph: {
    title: "Manifest Playground — AgentDNS",
    description:
      "Validate your Agent Discovery Protocol manifest in real-time before submitting.",
  },
};

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
