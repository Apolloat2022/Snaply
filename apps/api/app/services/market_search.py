"""Secondary-market comparable pricing lookup.

Pluggable behind a single async function so the search backend (Tavily, SerpAPI,
a custom eBay/Mercari scraper, etc.) can be swapped without touching the agent graph.
"""
from __future__ import annotations

import httpx

from app.config import get_settings
from app.models.schemas import ComparableListing

_MAX_RESULTS = 8


async def find_comparables(query: str) -> list[ComparableListing]:
    """Search secondary markets for recently sold/listed comparable items."""
    settings = get_settings()
    if not settings.market_search_api_key:
        return []

    search_query = f"{query} sold price site:ebay.com OR site:mercari.com OR site:poshmark.com"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            settings.market_search_base_url,
            json={
                "api_key": settings.market_search_api_key,
                "query": search_query,
                "search_depth": "basic",
                "max_results": _MAX_RESULTS,
                "include_answer": False,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    comparables: list[ComparableListing] = []
    for result in data.get("results", [])[:_MAX_RESULTS]:
        price = _extract_price(result.get("content", "") + " " + result.get("title", ""))
        if price is None:
            continue
        comparables.append(
            ComparableListing(
                source=_source_from_url(result.get("url", "")),
                title=result.get("title", "")[:200],
                price=price,
                url=result.get("url"),
            )
        )
    return comparables


def _extract_price(text: str) -> float | None:
    import re

    match = re.search(r"\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)", text)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def _source_from_url(url: str) -> str:
    for site in ("ebay", "mercari", "poshmark", "etsy"):
        if site in url:
            return site
    return "web"
