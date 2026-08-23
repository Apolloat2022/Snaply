"""Pydantic contracts shared between the vision/pricing agents and the API layer."""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, HttpUrl


class ItemCondition(str, Enum):
    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class AnalyzeItemRequest(BaseModel):
    image_url: HttpUrl = Field(..., description="Public/signed Supabase Storage URL for the uploaded image")
    seller_region: str | None = Field(
        default=None, description="ISO region/postal code, used to bias comparable-listing search"
    )


class IdentifiedItem(BaseModel):
    """Output of the vision step — no pricing yet."""

    item_name: str
    manufacturer: str | None = None
    category: str
    condition: ItemCondition
    condition_notes: str
    distinguishing_features: list[str] = Field(default_factory=list)


class ComparableListing(BaseModel):
    source: str
    title: str
    price: float
    url: str | None = None


class AnalyzeItemResponse(BaseModel):
    title: str
    description: str
    category: str
    manufacturer: str | None = None
    condition: ItemCondition
    listing_price: float = Field(..., description="AI-optimized listing price in USD")
    estimated_shipping_weight_lb: float = Field(..., gt=0)
    comparables: list[ComparableListing] = Field(default_factory=list)
    confidence: float = Field(..., ge=0, le=1)
