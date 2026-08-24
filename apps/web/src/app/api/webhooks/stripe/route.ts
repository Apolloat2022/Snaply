import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@snaply-app/db";
import { stripe } from "@/lib/stripe";
import { emailSellerOfSale, recordSaleNotification } from "@/lib/notifications";

/**
 * Fulfillment lives here, not in the checkout-session route or a client
 * success page: the buyer can close their browser after paying, so the only
 * reliable signal that a payment succeeded is this webhook. Handles both
 * checkout.session.completed and .async_payment_succeeded, gated on
 * payment_status, per Stripe's fulfillment guidance.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "unpaid") {
      await fulfillCheckoutSession(session);
    }
  }

  return NextResponse.json({ received: true });
}

async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const listingId = session.metadata?.listing_id;
  const buyerId = session.metadata?.buyer_id;
  if (!listingId || !buyerId) {
    console.error("Checkout session completed without listing/buyer metadata", { sessionId: session.id });
    return;
  }

  const alreadyFulfilled = await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session.id } });
  if (alreadyFulfilled) return;

  const listing = await prisma.listing.findUnique({ where: { id: listingId }, include: { seller: true } });
  if (!listing || listing.status !== "ACTIVE") {
    console.error("Checkout session completed for a listing that's no longer active", { sessionId: session.id, listingId });
    return;
  }

  const totalCents = session.amount_total ?? 0;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

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
          buyerId,
          itemCostCents: Number(session.metadata?.item_cost_cents ?? 0),
          salesTaxCents: Number(session.metadata?.sales_tax_cents ?? 0),
          postalFeeCents: Number(session.metadata?.postal_fee_cents ?? 0),
          totalCents,
          status: "PAID",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          noReturnPolicyAccepted: true,
          noReturnPolicyAcceptedAt: session.metadata?.no_return_policy_accepted_at,
          noReturnPolicyText: session.metadata?.no_return_policy_text ?? "",
        },
      });

      await recordSaleNotification(tx, {
        sellerId: listing.sellerId,
        listingId: listing.id,
        listingTitle: listing.title,
        orderId: order.id,
        totalCents,
      });

      createdOrderId = order.id;
    });

    if (createdOrderId) {
      await emailSellerOfSale(listing.seller.email, {
        listingTitle: listing.title,
        orderId: createdOrderId,
        totalCents,
      }).catch((err) => console.error("Seller sale email failed", { sessionId: session.id, err }));
    }
  } catch (err) {
    console.error("Payment succeeded but order bookkeeping failed", { sessionId: session.id, err });
  }
}
