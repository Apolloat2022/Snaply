import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@snaply-app/db";

interface ReadAllBody {
  sellerId: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReadAllBody;

  if (!body.sellerId) {
    return NextResponse.json({ error: "sellerId is required." }, { status: 400 });
  }

  const result = await prisma.notification.updateMany({
    where: { userId: body.sellerId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ updated: result.count });
}
