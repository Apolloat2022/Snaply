import { NextRequest, NextResponse } from "next/server";
import { prisma, ItemCondition as PrismaItemCondition } from "@snaply-app/db";
import type { ComparableListing, ItemCondition } from "@/types/listing";

interface CreateListingBody {
  sellerId: string;
  imageUrl: string;
  title: string;
  description: string;
  category: string;
  manufacturer?: string | null;
  condition: ItemCondition;
  listingPrice: number;
  estimatedShippingWeightLb: number;
  regionCode: string;
  aiConfidence?: number;
  comparables?: ComparableListing[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateListingBody;

  const missing = ["sellerId", "imageUrl", "title", "description", "category", "condition", "regionCode"].filter(
    (field) => !body[field as keyof CreateListingBody]
  );
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }
  if (!(body.listingPrice > 0) || !(body.estimatedShippingWeightLb > 0)) {
    return NextResponse.json({ error: "listingPrice and estimatedShippingWeightLb must be positive." }, { status: 400 });
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId: body.sellerId,
      imageUrl: body.imageUrl,
      title: body.title,
      description: body.description,
      category: body.category,
      manufacturer: body.manufacturer ?? null,
      condition: body.condition.toUpperCase() as PrismaItemCondition,
      listingPrice: body.listingPrice,
      estimatedShippingWeightLb: body.estimatedShippingWeightLb,
      regionCode: body.regionCode,
      aiConfidence: body.aiConfidence ?? null,
      comparables: body.comparables ?? undefined,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
