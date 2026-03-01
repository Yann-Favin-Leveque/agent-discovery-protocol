import { NextRequest, NextResponse } from "next/server";
import { validateManifest } from "@/lib/validate";
import { logAudit } from "@/lib/db";
import { getClientIp } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { valid: false, errors: [{ path: "$", message: "Invalid JSON." }] },
      { status: 400 }
    );
  }

  const result = validateManifest(body);

  if (!result.valid) {
    await logAudit({
      action: "validation_failed",
      ip_address: getClientIp(request),
      details: JSON.stringify({ error_count: result.errors.length }),
    });
  }

  return NextResponse.json({
    valid: result.valid,
    errors: result.errors,
  });
}
