import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeItemResponse } from "@/types/listing";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

// The vision + market-search pipeline routinely takes longer than Vercel's
// default 10s function timeout; 60 is the max the Hobby plan allows.
export const maxDuration = 60;

interface AnalyzeItemBody {
  image_url: string;
  seller_region?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AnalyzeItemBody;

  if (!body.image_url) {
    return NextResponse.json({ error: "image_url is required." }, { status: 400 });
  }

  let engineResponse: Response;
  try {
    engineResponse = await fetch(`${FASTAPI_BASE_URL}/api/analyze-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: body.image_url, seller_region: body.seller_region }),
      // Vision + market-search calls can run long; don't let Next.js's default fetch cache mask retries.
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "AI pricing engine is unreachable." }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await engineResponse.json();
  } catch {
    return NextResponse.json({ error: "AI pricing engine returned an invalid response." }, { status: 502 });
  }

  if (!engineResponse.ok) {
    const detail = typeof data === "object" && data !== null && "detail" in data ? (data as { detail?: string }).detail : undefined;
    return NextResponse.json({ error: detail ?? "Item analysis failed." }, { status: engineResponse.status });
  }

  return NextResponse.json(data as AnalyzeItemResponse);
}
