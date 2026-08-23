"""LangGraph pipeline: identify item -> search secondary markets -> synthesize a listing.

Kept as a linear graph (rather than a plain function chain) so pricing/search steps can
later branch — e.g. retry search with a broader query if too few comparables are found —
without restructuring the call sites.
"""
from __future__ import annotations

import statistics
from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.models.schemas import AnalyzeItemResponse, ComparableListing, IdentifiedItem
from app.services import market_search, shipping, vision


class PricingState(TypedDict, total=False):
    image_url: str
    identified: IdentifiedItem
    comparables: list[ComparableListing]
    result: AnalyzeItemResponse


async def _identify_node(state: PricingState) -> PricingState:
    identified = await vision.identify_item(state["image_url"])
    return {"identified": identified}


async def _search_node(state: PricingState) -> PricingState:
    identified = state["identified"]
    query_parts = [identified.manufacturer, identified.item_name, *identified.distinguishing_features]
    query = " ".join(p for p in query_parts if p)
    comparables = await market_search.find_comparables(query)
    return {"comparables": comparables}


async def _synthesize_node(state: PricingState) -> PricingState:
    identified = state["identified"]
    comparables = state["comparables"]

    listing_price = _price_from_comparables(comparables, identified.condition)
    weight = shipping.estimate_weight_lb(identified.category, identified.item_name)

    title = f"{identified.manufacturer + ' ' if identified.manufacturer else ''}{identified.item_name}".strip()
    description = _build_description(identified)

    result = AnalyzeItemResponse(
        title=title,
        description=description,
        category=identified.category,
        manufacturer=identified.manufacturer,
        condition=identified.condition,
        listing_price=listing_price,
        estimated_shipping_weight_lb=weight,
        comparables=comparables,
        confidence=0.85 if len(comparables) >= 3 else 0.5,
    )
    return {"result": result}


_CONDITION_DISCOUNT = {
    "new": 1.0,
    "like_new": 0.9,
    "good": 0.75,
    "fair": 0.55,
    "poor": 0.35,
}


def _price_from_comparables(comparables: list[ComparableListing], condition) -> float:
    discount = _CONDITION_DISCOUNT.get(condition.value if hasattr(condition, "value") else condition, 0.7)

    if not comparables:
        # No market data available — fall back to a conservative placeholder the
        # seller is expected to review before publishing.
        return 25.0

    prices = [c.price for c in comparables]
    median_price = statistics.median(prices)
    return round(median_price * discount, 2)


def _build_description(identified: IdentifiedItem) -> str:
    features = ", ".join(identified.distinguishing_features) if identified.distinguishing_features else None
    lines = [
        f"{identified.item_name}"
        + (f" by {identified.manufacturer}" if identified.manufacturer else "")
        + f". Condition: {identified.condition.value.replace('_', ' ')}.",
        identified.condition_notes,
    ]
    if features:
        lines.append(f"Details: {features}.")
    return " ".join(lines)


def build_pricing_graph():
    graph = StateGraph(PricingState)
    graph.add_node("identify", _identify_node)
    graph.add_node("search", _search_node)
    graph.add_node("synthesize", _synthesize_node)

    graph.set_entry_point("identify")
    graph.add_edge("identify", "search")
    graph.add_edge("search", "synthesize")
    graph.add_edge("synthesize", END)

    return graph.compile()


_compiled_graph = None


async def run_pricing_pipeline(image_url: str) -> AnalyzeItemResponse:
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_pricing_graph()

    final_state: PricingState = await _compiled_graph.ainvoke({"image_url": image_url})
    return final_state["result"]
