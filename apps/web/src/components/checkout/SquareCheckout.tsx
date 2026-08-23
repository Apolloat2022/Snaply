"use client";

import { useEffect, useRef, useState } from "react";
import { computeCheckoutTotals } from "@/lib/pricing";
import type { Listing } from "@/types/listing";

const SQUARE_SDK_SRC =
  process.env.NEXT_PUBLIC_SQUARE_ENV === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";

const SQUARE_APP_ID = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? "";
const SQUARE_LOCATION_ID = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";

const NO_RETURN_POLICY_TEXT =
  "All sales are final. This item is sold as-is based on the AI-assessed condition above; " +
  "no returns, exchanges, or refunds will be issued after purchase.";

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: unknown }>;
  destroy: () => Promise<void>;
}

interface SquareCheckoutProps {
  listing: Listing;
  buyerId: string;
  onPaymentSuccess: (paymentId: string) => void;
}

type Status = "idle" | "loading_sdk" | "ready" | "submitting" | "error";

export default function SquareCheckout({ listing, buyerId, onPaymentSuccess }: SquareCheckoutProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedNoReturnPolicy, setAcceptedNoReturnPolicy] = useState(false);

  const cardRef = useRef<SquareCard | null>(null);
  const cardContainerId = "square-card-container";

  const totals = computeCheckoutTotals(
    listing.listingPrice,
    listing.regionCode,
    listing.estimatedShippingWeightLb
  );

  useEffect(() => {
    let cancelled = false;

    async function initSquare() {
      setStatus("loading_sdk");
      try {
        await loadSquareSdk();
        if (cancelled || !window.Square) return;

        const payments = await window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach(`#${cardContainerId}`);

        if (cancelled) {
          await card.destroy();
          return;
        }

        cardRef.current = card;
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMessage("Unable to load the payment form. Please refresh and try again.");
          setStatus("error");
        }
      }
    }

    initSquare();

    return () => {
      cancelled = true;
      cardRef.current?.destroy().catch(() => {});
    };
  }, []);

  async function handlePayment() {
    if (!acceptedNoReturnPolicy) {
      setErrorMessage("You must accept the No Return Policy to complete this purchase.");
      return;
    }
    if (!cardRef.current) return;

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error("Card tokenization failed.");
      }

      const response = await fetch("/api/square/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          idempotencyKey: crypto.randomUUID(),
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
        throw new Error(body.error ?? "Payment failed.");
      }

      const { paymentId } = await response.json();
      onPaymentSuccess(paymentId);
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Payment failed.");
      setStatus("ready");
    }
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

      <div id={cardContainerId} className="mt-4 min-h-[90px]" />

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

      {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}

      <button
        type="button"
        onClick={handlePayment}
        disabled={status !== "ready" || !acceptedNoReturnPolicy}
        className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Processing…" : `Pay $${totals.total.toFixed(2)}`}
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

function loadSquareSdk(): Promise<void> {
  if (window.Square) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SQUARE_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Square SDK failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = SQUARE_SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(script);
  });
}
