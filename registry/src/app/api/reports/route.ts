import { NextRequest, NextResponse } from "next/server";
import { getServiceByDomain, insertReport, logAudit } from "@/lib/db";
import { getClientIp, stripHtml } from "@/lib/sanitize";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limit
  const rl = checkRateLimit(`${ip}:report`, RATE_LIMITS.report);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  const reason = typeof body.reason === "string" ? stripHtml(body.reason).slice(0, 500).trim() : "";

  if (!domain) {
    return NextResponse.json(
      { success: false, error: "Missing required field: domain" },
      { status: 400 }
    );
  }

  if (!reason || reason.length < 5) {
    return NextResponse.json(
      { success: false, error: "Reason must be at least 5 characters." },
      { status: 400 }
    );
  }

  const service = await getServiceByDomain(domain);
  if (!service) {
    return NextResponse.json(
      { success: false, error: `Service '${domain}' not found.` },
      { status: 404 }
    );
  }

  await insertReport({
    service_domain: domain,
    reporter_ip: ip,
    reason,
  });

  await logAudit({
    action: "service_reported",
    domain,
    ip_address: ip,
    details: JSON.stringify({ reason }),
  });

  return NextResponse.json({
    success: true,
    data: { message: "Thank you. We'll review this report." },
  });
}
