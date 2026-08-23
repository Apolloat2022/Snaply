import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeItemResponse } from "@/types/listing";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

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

  const data = await engineResponse.json();

  if (!engineResponse.ok) {
    return NextResponse.json({ error: data.detail ?? "Item analysis failed." }, { status: engineResponse.status });
  }

  return NextResponse.json(data as AnalyzeItemResponse);
}
