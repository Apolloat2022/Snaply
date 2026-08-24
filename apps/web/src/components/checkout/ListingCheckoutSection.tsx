"use client";

import { useState } from "react";
import StripeCheckout from "./StripeCheckout";
import type { Listing } from "@/types/listing";

interface ListingCheckoutSectionProps {
  listing: Listing;
  buyerId: string;
}

export default function ListingCheckoutSection({ listing, buyerId }: ListingCheckoutSectionProps) {
  const [complete, setComplete] = useState(false);

  if (complete) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-medium text-green-900">Payment complete!</p>
        <p className="mt-1 text-sm text-green-800">You&apos;ll receive a confirmation email shortly.</p>
      </div>
    );
  }

  return <StripeCheckout listing={listing} buyerId={buyerId} onPaymentSuccess={() => setComplete(true)} />;
}
