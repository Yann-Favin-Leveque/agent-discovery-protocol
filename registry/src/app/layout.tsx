import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "AgentDNS — The DNS for AI Agents",
    template: "%s | AgentDNS",
  },
  description:
    "Discover any API. Zero installation. One gateway. The searchable registry for the Agent Discovery Protocol. Replace all your MCP plugins with a single protocol.",
  keywords: [
    "AI agents",
    "API discovery",
    "MCP",
    "agent gateway",
    "agent discovery protocol",
    "LLM tools",
    "API registry",
  ],
  authors: [{ name: "AgentDNS" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AgentDNS",
    title: "AgentDNS — The DNS for AI Agents",
    description:
      "Discover any API. Zero installation. One gateway. Replace all your MCP plugins with a single protocol.",
    url: "https://agent-dns.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentDNS — The DNS for AI Agents",
    description:
      "Discover any API. Zero installation. One gateway. Replace all your MCP plugins with a single protocol.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  metadataBase: new URL("https://agent-dns.dev"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
