import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@snaply-app/db";

interface PatchBody {
  read: boolean;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = (await req.json()) as PatchBody;

  if (typeof body.read !== "boolean") {
    return NextResponse.json({ error: "read must be a boolean." }, { status: 400 });
  }

  const { id } = await params;

  try {
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: body.read },
    });
    return NextResponse.json({ notification });
  } catch {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
}
