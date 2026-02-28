import { NextRequest, NextResponse } from "next/server";
import { validateManifest } from "@/lib/validate";

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

  return NextResponse.json({
    valid: result.valid,
    errors: result.errors,
  });
}
