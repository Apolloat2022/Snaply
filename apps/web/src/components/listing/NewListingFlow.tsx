"use client";

import { useState } from "react";
import ImageDropzone from "@/components/upload/ImageDropzone";
import ListingProfileForm from "@/components/listing/ListingProfileForm";
import { CURRENT_SELLER_ID } from "@/lib/auth";
import type { AnalyzeItemResponse, Listing } from "@/types/listing";

const DEFAULT_REGION_CODE = "CA";

type FlowStep =
  | { name: "upload" }
  | { name: "review"; analysis: AnalyzeItemResponse; imageUrl: string }
  | { name: "published"; listing: Listing };

export default function NewListingFlow() {
  const [step, setStep] = useState<FlowStep>({ name: "upload" });

  return (
    <div>
      {step.name === "upload" && (
        <ImageDropzone
          sellerRegion={DEFAULT_REGION_CODE}
          onAnalyzed={(analysis, imageUrl) => setStep({ name: "review", analysis, imageUrl })}
        />
      )}

      {step.name === "review" && (
        <ListingProfileForm
          analysis={step.analysis}
          imageUrl={step.imageUrl}
          sellerId={CURRENT_SELLER_ID}
          defaultRegionCode={DEFAULT_REGION_CODE}
          onPublished={(listing) => setStep({ name: "published", listing })}
        />
      )}

      {step.name === "published" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="font-medium text-green-900">Listing published!</p>
          <p className="mt-1 text-sm text-green-800">
            &ldquo;{step.listing.title}&rdquo; is live at ${step.listing.listingPrice}.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <a
              href={`/listings/${step.listing.id}`}
              className="rounded-lg bg-green-900 px-4 py-2 text-sm font-medium text-white"
            >
              View listing
            </a>
            <button
              type="button"
              onClick={() => setStep({ name: "upload" })}
              className="rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-900"
            >
              List another item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
