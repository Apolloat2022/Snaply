import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@snaply-app/db";
import { computeCheckoutTotals, toSquareAmountCents } from "@/lib/pricing";
import { emailSellerOfSale, recordSaleNotification } from "@/lib/notifications";

/**
 * Server-only Square Payments API call. Re-derives the charge total from the
 * Listing record (never trusts the client-sent amount), stamps the buyer's
 * No Return Policy acceptance into the payment's order metadata, and — once
 * the card is charged — persists the Order and flips the Listing to SOLD.
 */

const SQUARE_API_BASE =
  process.env.SQUARE_ENV === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";

interface CreatePaymentBody {
  sourceId: string;
  idempotencyKey: string;
  listingId: string;
  buyerId: string;
  noReturnPolicy: {
    accepted: boolean;
    acceptedAt: string;
    policyText: string;
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreatePaymentBody;

  if (!body.noReturnPolicy?.accepted) {
    return NextResponse.json({ error: "No Return Policy must be accepted before checkout." }, { status: 400 });
  }
  if (!body.sourceId || !body.idempotencyKey || !body.listingId || !body.buyerId) {
    return NextResponse.json({ error: "Missing required payment fields." }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: body.listingId },
    include: { seller: true },
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
    itemCostCents: toSquareAmountCents(totals.itemCost),
    salesTaxCents: toSquareAmountCents(totals.salesTax),
    postalFeeCents: toSquareAmountCents(totals.postalFee),
  };
  const amountCents = toSquareAmountCents(totals.total);

  const squareResponse = await fetch(`${SQUARE_API_BASE}/v2/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Square-Version": "2024-08-21",
    },
    body: JSON.stringify({
      source_id: body.sourceId,
      idempotency_key: body.idempotencyKey,
      location_id: process.env.SQUARE_LOCATION_ID,
      amount_money: {
        amount: amountCents,
        currency: "USD",
      },
      note: `Marketplace order for listing ${body.listingId} — No Return Policy accepted`,
      metadata: {
        listing_id: body.listingId,
        buyer_id: body.buyerId,
        item_cost_cents: String(breakdown.itemCostCents),
        sales_tax_cents: String(breakdown.salesTaxCents),
        postal_fee_cents: String(breakdown.postalFeeCents),
        no_return_policy_accepted: "true",
        no_return_policy_accepted_at: body.noReturnPolicy.acceptedAt,
        no_return_policy_text: body.noReturnPolicy.policyText,
      },
    }),
  });

  const data = await squareResponse.json();

  if (!squareResponse.ok) {
    const message = data?.errors?.[0]?.detail ?? "Square payment failed.";
    return NextResponse.json({ error: message }, { status: squareResponse.status });
  }

  // Card is already charged at this point. Persisting the order/listing flip
  // and the in-app notification is best-effort bookkeeping — if it fails,
  // reconciliation should happen via Square's payment webhook rather than
  // retrying the charge itself.
  let createdOrderId: string | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      const flipped = await tx.listing.updateMany({
        where: { id: listing.id, status: "ACTIVE" },
        data: { status: "SOLD" },
      });
      if (flipped.count === 0) {
        throw new Error("Listing was sold concurrently.");
      }

      const order = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId: body.buyerId,
          itemCostCents: breakdown.itemCostCents,
          salesTaxCents: breakdown.salesTaxCents,
          postalFeeCents: breakdown.postalFeeCents,
          totalCents: amountCents,
          status: "PAID",
          squarePaymentId: data.payment.id,
          squareIdempotencyKey: body.idempotencyKey,
          noReturnPolicyAccepted: true,
          noReturnPolicyAcceptedAt: body.noReturnPolicy.acceptedAt,
          noReturnPolicyText: body.noReturnPolicy.policyText,
        },
      });

      await recordSaleNotification(tx, {
        sellerId: listing.sellerId,
        listingId: listing.id,
        listingTitle: listing.title,
        orderId: order.id,
        totalCents: amountCents,
      });

      createdOrderId = order.id;
    });

    // Outside the transaction — an email-delivery failure shouldn't roll back
    // a sale that's already been charged and recorded.
    if (createdOrderId) {
      await emailSellerOfSale(listing.seller.email, {
        listingTitle: listing.title,
        orderId: createdOrderId,
        totalCents: amountCents,
      }).catch((err) => console.error("Seller sale email failed", { paymentId: data.payment.id, err }));
    }
  } catch (err) {
    console.error("Payment succeeded but order bookkeeping failed", { paymentId: data.payment.id, err });
  }

  return NextResponse.json({ paymentId: data.payment.id, status: data.payment.status });
}
