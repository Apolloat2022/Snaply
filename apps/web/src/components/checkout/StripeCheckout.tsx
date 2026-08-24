"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { computeCheckoutTotals } from "@/lib/pricing";
import type { Listing } from "@/types/listing";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

const NO_RETURN_POLICY_TEXT =
  "All sales are final. This item is sold as-is based on the AI-assessed condition above; " +
  "no returns, exchanges, or refunds will be issued after purchase.";

interface StripeCheckoutProps {
  listing: Listing;
  buyerId: string;
  onPaymentSuccess: () => void;
}

export default function StripeCheckout({ listing, buyerId, onPaymentSuccess }: StripeCheckoutProps) {
  const [acceptedNoReturnPolicy, setAcceptedNoReturnPolicy] = useState(false);
  const [started, setStarted] = useState(false);

  const totals = computeCheckoutTotals(
    listing.listingPrice,
    listing.regionCode,
    listing.estimatedShippingWeightLb
  );

  const fetchClientSecret = useCallback(async () => {
    const response = await fetch("/api/checkout/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: listing.id,
        buyerId,
        // Displayed totals are for the buyer's benefit only — the server
        // re-derives the authoritative charge from the Listing record.
        noReturnPolicy: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          policyText: NO_RETURN_POLICY_TEXT,
        },
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Unable to start checkout.");
    }
    const { clientSecret } = await response.json();
    return clientSecret as string;
  }, [listing.id, buyerId]);

  if (started) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret, onComplete: onPaymentSuccess }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Checkout</h2>

      <dl className="mt-4 space-y-2 text-sm text-neutral-700">
        <Row label="Item price" value={totals.itemCost} />
        <Row label="Sales tax" value={totals.salesTax} />
        <Row label="Shipping (postal fee)" value={totals.postalFee} />
        <div className="my-2 border-t border-neutral-200" />
        <Row label="Total" value={totals.total} bold />
      </dl>

      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={acceptedNoReturnPolicy}
            onChange={(e) => setAcceptedNoReturnPolicy(e.target.checked)}
            className="mt-1"
          />
          <span>
            <strong>No Return Policy:</strong> {NO_RETURN_POLICY_TEXT}
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={() => setStarted(true)}
        disabled={!acceptedNoReturnPolicy}
        className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue to payment — ${totals.total.toFixed(2)}
      </button>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-neutral-900" : ""}`}>
      <dt>{label}</dt>
      <dd>${value.toFixed(2)}</dd>
    </div>
  );
}
