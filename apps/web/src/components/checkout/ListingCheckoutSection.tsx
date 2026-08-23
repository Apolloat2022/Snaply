"use client";

import { useState } from "react";
import SquareCheckout from "./SquareCheckout";
import type { Listing } from "@/types/listing";

interface ListingCheckoutSectionProps {
  listing: Listing;
  buyerId: string;
}

export default function ListingCheckoutSection({ listing, buyerId }: ListingCheckoutSectionProps) {
  const [paymentId, setPaymentId] = useState<string | null>(null);

  if (paymentId) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-medium text-green-900">Payment complete!</p>
        <p className="mt-1 text-sm text-green-800">Confirmation #{paymentId}</p>
      </div>
    );
  }

  return <SquareCheckout listing={listing} buyerId={buyerId} onPaymentSuccess={setPaymentId} />;
}
