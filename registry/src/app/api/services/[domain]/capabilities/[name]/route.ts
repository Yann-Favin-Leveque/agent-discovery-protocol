import { NextRequest, NextResponse } from "next/server";
import { getCapabilityDetail } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { domain: string; name: string } }
) {
  try {
    const cap = await getCapabilityDetail(params.domain, params.name);

    if (!cap) {
      return NextResponse.json(
        { success: false, error: `Capability '${params.name}' not found on ${params.domain}.` },
        { status: 404 }
      );
    }

    if (!cap.detail_json) {
      return NextResponse.json(
        {
          success: false,
          error: `No detail data stored for capability '${params.name}' on ${params.domain}. The service may need to implement its own detail endpoint.`,
        },
        { status: 404 }
      );
    }

    // Return the CapabilityDetail JSON directly (not wrapped)
    return NextResponse.json(cap.detail_json);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
