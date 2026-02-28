import { NextRequest, NextResponse } from "next/server";
import { discoverServices, getCapabilitiesForService } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { success: false, error: "Missing required query parameter 'q'. Example: /api/discover?q=send+email" },
      { status: 400 }
    );
  }

  try {
    const results = discoverServices(q);

    const data = results.map((service) => ({
      service: {
        name: service.name,
        domain: service.domain,
        description: service.description,
        base_url: service.base_url,
        auth_type: service.auth_type,
        pricing_type: service.pricing_type,
        verified: !!service.verified,
      },
      matching_capabilities: service.matching_capabilities.map((cap) => ({
        name: cap.name,
        description: cap.description,
        detail_url: cap.detail_url.startsWith("http")
          ? cap.detail_url
          : `${service.base_url}${cap.detail_url}`,
      })),
      all_capabilities: getCapabilitiesForService(service.id).map((cap) => ({
        name: cap.name,
        description: cap.description,
        detail_url: cap.detail_url.startsWith("http")
          ? cap.detail_url
          : `${service.base_url}${cap.detail_url}`,
      })),
    }));

    return NextResponse.json({
      success: true,
      query: q,
      result_count: data.length,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
