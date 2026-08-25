"use client";

import { useState } from "react";
import type { AnalyzeItemResponse, ItemCondition, Listing } from "@/types/listing";

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

interface ListingProfileFormProps {
  analysis: AnalyzeItemResponse;
  imageUrl: string;
  sellerId: string;
  defaultRegionCode: string;
  onPublished: (listing: Listing) => void;
}

interface FormState {
  title: string;
  description: string;
  category: string;
  manufacturer: string;
  condition: ItemCondition;
  listingPrice: string;
  estimatedShippingWeightLb: string;
  regionCode: string;
}

export default function ListingProfileForm({
  analysis,
  imageUrl,
  sellerId,
  defaultRegionCode,
  onPublished,
}: ListingProfileFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    title: analysis.title,
    description: analysis.description,
    category: analysis.category,
    manufacturer: analysis.manufacturer ?? "",
    condition: analysis.condition,
    listingPrice: analysis.listing_price.toFixed(2),
    estimatedShippingWeightLb: analysis.estimated_shipping_weight_lb.toString(),
    regionCode: defaultRegionCode,
  }));
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const listingPrice = Number(form.listingPrice);
    const weight = Number(form.estimatedShippingWeightLb);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      setErrorMessage("Listing price must be a positive number.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      setErrorMessage("Estimated shipping weight must be a positive number.");
      return;
    }
    if (!form.regionCode.trim()) {
      setErrorMessage("Region code is required to calculate sales tax at checkout.");
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          imageUrl,
          title: form.title,
          description: form.description,
          category: form.category,
          manufacturer: form.manufacturer || null,
          condition: form.condition,
          listingPrice,
          estimatedShippingWeightLb: weight,
          regionCode: form.regionCode.trim().toUpperCase(),
          aiConfidence: analysis.confidence,
          comparables: analysis.comparables,
        }),
      });

      let data: { error?: string; listing?: Listing } | null = null;
      try {
        data = await response.json();
      } catch {
        // Response was not JSON (e.g. 500 HTML or timeout)
      }

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error (${response.status}) while publishing listing.`);
      }

      if (!data?.listing) {
        throw new Error("Invalid response received from server.");
      }

      onPublished(data.listing);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to publish listing.");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Review your listing</h2>
        <ConfidenceBadge confidence={analysis.confidence} />
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        AI-generated from your photo — edit anything before publishing.
      </p>

      <div className="mt-4 grid gap-4">
        <Field label="Title">
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            required
            className="input"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            required
            rows={4}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <input
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Manufacturer">
            <input
              value={form.manufacturer}
              onChange={(e) => update("manufacturer", e.target.value)}
              placeholder="Optional"
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Condition">
            <select
              value={form.condition}
              onChange={(e) => update("condition", e.target.value as ItemCondition)}
              className="input"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Region code">
            <input
              value={form.regionCode}
              onChange={(e) => update("regionCode", e.target.value)}
              placeholder="e.g. CA"
              maxLength={2}
              required
              className="input uppercase"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Listing price (USD)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.listingPrice}
              onChange={(e) => update("listingPrice", e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Est. shipping weight (lb)">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={form.estimatedShippingWeightLb}
              onChange={(e) => update("estimatedShippingWeightLb", e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        {analysis.comparables.length > 0 && (
          <details className="rounded-lg border border-neutral-200 p-3 text-sm text-neutral-600">
            <summary className="cursor-pointer font-medium text-neutral-800">
              Comparable listings used for pricing ({analysis.comparables.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {analysis.comparables.map((c, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span className="truncate">
                    {c.source}: {c.title}
                  </span>
                  <span className="shrink-0">${c.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}

      <button
        type="submit"
        disabled={isPublishing}
        className="mt-5 w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPublishing ? "Publishing…" : "Publish listing"}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d4d4d4;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid #171717;
          outline-offset: 1px;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone = confidence >= 0.75 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      AI confidence: {pct}%
    </span>
  );
}
