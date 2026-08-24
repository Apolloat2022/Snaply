import { notFound } from "next/navigation";
import { prisma } from "@snaply-app/db";
import ListingCheckoutSection from "@/components/checkout/ListingCheckoutSection";
import DashboardLink from "@/components/dashboard/DashboardLink";
import { CURRENT_BUYER_ID } from "@/lib/auth";
import type { Listing } from "@/types/listing";

interface ListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const record = await prisma.listing.findUnique({ where: { id } });

  if (!record || record.status !== "ACTIVE") {
    notFound();
  }

  const listing: Listing = {
    id: record.id,
    sellerId: record.sellerId,
    imageUrl: record.imageUrl,
    title: record.title,
    description: record.description,
    category: record.category,
    condition: record.condition.toLowerCase() as Listing["condition"],
    listingPrice: Number(record.listingPrice),
    estimatedShippingWeightLb: Number(record.estimatedShippingWeightLb),
    regionCode: record.regionCode,
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex justify-end">
        <DashboardLink />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full rounded-xl border border-neutral-200 object-cover"
          />
          <h1 className="mt-4 text-2xl font-semibold text-neutral-900">{listing.title}</h1>
          {record.manufacturer && <p className="text-neutral-500">{record.manufacturer}</p>}
          <p className="mt-2 text-sm uppercase tracking-wide text-neutral-500">
            {listing.condition.replace("_", " ")} · {listing.category}
          </p>
          <p className="mt-4 whitespace-pre-line text-neutral-700">{listing.description}</p>
        </div>

        <div>
          <ListingCheckoutSection listing={listing} buyerId={CURRENT_BUYER_ID} />
        </div>
      </div>
    </main>
  );
}
