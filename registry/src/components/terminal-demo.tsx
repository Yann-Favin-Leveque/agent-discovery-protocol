"use client";

import { useEffect, useState } from "react";

interface TerminalLine {
  type: "command" | "output" | "success" | "info" | "blank";
  text: string;
  delay: number; // ms before this line appears
}

const lines: TerminalLine[] = [
  { type: "info", text: '# User: "Send an invoice to Acme Corp for $5,000"', delay: 0 },
  { type: "blank", text: "", delay: 600 },
  { type: "command", text: '> discover({ query: "create invoice" })', delay: 800 },
  { type: "blank", text: "", delay: 400 },
  { type: "output", text: "Found 2 service(s):", delay: 600 },
  { type: "output", text: "  InvoiceNinja (api.invoiceninja.com) [NOT CONNECTED]", delay: 100 },
  { type: "output", text: "    - create_invoice: Create and send a professional invoice", delay: 100 },
  { type: "output", text: "  BillingBot (api.billingbot.io) [NOT CONNECTED]", delay: 100 },
  { type: "output", text: "    - create_invoice: Generate invoices with templates", delay: 100 },
  { type: "blank", text: "", delay: 800 },
  { type: "command", text: '> discover({ domain: "api.invoiceninja.com", capability: "create_invoice" })', delay: 600 },
  { type: "blank", text: "", delay: 400 },
  { type: "output", text: "create_invoice — InvoiceNinja", delay: 500 },
  { type: "output", text: "  Endpoint: POST /v1/invoices", delay: 100 },
  { type: "output", text: "  Parameters:", delay: 100 },
  { type: "output", text: "    - client_name (string, required)", delay: 50 },
  { type: "output", text: "    - amount (number, required)", delay: 50 },
  { type: "output", text: "    - currency (string, optional)", delay: 50 },
  { type: "blank", text: "", delay: 800 },
  { type: "command", text: '> auth({ domain: "api.invoiceninja.com", api_key: "INJ-abc123" })', delay: 600 },
  { type: "success", text: "API key stored for InvoiceNinja. Connected.", delay: 500 },
  { type: "blank", text: "", delay: 800 },
  { type: "command", text: '> call({ domain: "api.invoiceninja.com", capability: "create_invoice",', delay: 600 },
  { type: "command", text: '    params: { client_name: "Acme Corp", amount: 500000, currency: "USD" } })', delay: 100 },
  { type: "blank", text: "", delay: 400 },
  { type: "success", text: "create_invoice on api.invoiceninja.com — HTTP 201", delay: 800 },
  { type: "output", text: '  { "invoice_id": "INV-2024-0042", "status": "sent" }', delay: 200 },
  { type: "blank", text: "", delay: 600 },
  { type: "info", text: '# Agent: "Done! Invoice INV-2024-0042 for $5,000 sent to Acme Corp."', delay: 400 },
];

export function TerminalDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Start animation when component mounts (via IntersectionObserver)
    const timeout = setTimeout(() => setStarted(true), 500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!started || visibleCount >= lines.length) return;

    const nextLine = lines[visibleCount];
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, nextLine.delay);

    return () => clearTimeout(timer);
  }, [started, visibleCount]);

  const colorMap: Record<TerminalLine["type"], string> = {
    command: "text-accent-light",
    output: "text-muted",
    success: "text-accent",
    info: "text-white/40",
    blank: "",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-surface shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/60" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
        <div className="h-3 w-3 rounded-full bg-green-500/60" />
        <span className="ml-3 font-mono text-xs text-muted">
          agent-gateway
        </span>
      </div>

      {/* Terminal content */}
      <div className="h-[420px] overflow-y-auto p-4 font-mono text-sm leading-relaxed">
        {lines.slice(0, visibleCount).map((line, i) => (
          <div key={i} className={`${colorMap[line.type]} min-h-[1.375rem]`}>
            {line.text}
          </div>
        ))}
        {visibleCount < lines.length && (
          <span className="inline-block h-4 w-2 animate-pulse bg-accent/60" />
        )}
      </div>
    </div>
  );
}
