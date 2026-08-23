export type ItemCondition = "new" | "like_new" | "good" | "fair" | "poor";

export interface ComparableListing {
  source: string;
  title: string;
  price: number;
  url?: string | null;
}

/** Mirrors FastAPI's AnalyzeItemResponse (apps/api/app/models/schemas.py). */
export interface AnalyzeItemResponse {
  title: string;
  description: string;
  category: string;
  manufacturer?: string | null;
  condition: ItemCondition;
  listing_price: number;
  estimated_shipping_weight_lb: number;
  comparables: ComparableListing[];
  confidence: number;
}

export interface Listing {
  id: string;
  sellerId: string;
  imageUrl: string;
  title: string;
  description: string;
  category: string;
  condition: ItemCondition;
  listingPrice: number;
  estimatedShippingWeightLb: number;
  regionCode: string;
}
