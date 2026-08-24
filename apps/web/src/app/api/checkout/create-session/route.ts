import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@snaply-app/db";
import { stripe } from "@/lib/stripe";
import { computeCheckoutTotals, toAmountCents } from "@/lib/pricing";

/**
 * Server-only Stripe Checkout Session creation. Re-derives the charge total
 * from the Listing record (never trusts the client-sent amount), and stamps
 * the buyer's No Return Policy acceptance plus the authoritative cents
 * breakdown into the session metadata for the webhook to read at fulfillment
 * time (see api/webhooks/stripe/route.ts, which does the actual charge
 * bookkeeping — order creation, listing flip, notification — once Stripe
 * confirms the payment).
 */

interface CreateSessionBody {
  listingId: string;
  buyerId: string;
  noReturnPolicy: {
    accepted: boolean;
    acceptedAt: string;
    policyText: string;
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateSessionBody;

  if (!body.noReturnPolicy?.accepted) {
    return NextResponse.json({ error: "No Return Policy must be accepted before checkout." }, { status: 400 });
  }
  if (!body.listingId || !body.buyerId) {
    return NextResponse.json({ error: "Missing required checkout fields." }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: body.listingId },
  });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "This listing is no longer available." }, { status: 409 });
  }
  if (listing.sellerId === body.buyerId) {
    return NextResponse.json({ error: "You can't buy your own listing." }, { status: 400 });
  }

  const totals = computeCheckoutTotals(
    Number(listing.listingPrice),
    listing.regionCode,
    Number(listing.estimatedShippingWeightLb)
  );
  const breakdown = {
    itemCostCents: toAmountCents(totals.itemCost),
    salesTaxCents: toAmountCents(totals.salesTax),
    postalFeeCents: toAmountCents(totals.postalFee),
  };

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    redirect_on_completion: "never",
    return_url: `${req.nextUrl.origin}/listings/${listing.id}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: listing.title },
          unit_amount: breakdown.itemCostCents,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Sales tax" },
          unit_amount: breakdown.salesTaxCents,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Shipping (postal fee)" },
          unit_amount: breakdown.postalFeeCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      listing_id: listing.id,
      buyer_id: body.buyerId,
      item_cost_cents: String(breakdown.itemCostCents),
      sales_tax_cents: String(breakdown.salesTaxCents),
      postal_fee_cents: String(breakdown.postalFeeCents),
      no_return_policy_accepted: "true",
      no_return_policy_accepted_at: body.noReturnPolicy.acceptedAt,
      no_return_policy_text: body.noReturnPolicy.policyText,
    },
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}
