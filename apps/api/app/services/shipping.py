"""Rough weight estimation used to seed the postal fee calculation on checkout."""
from __future__ import annotations

_CATEGORY_BASE_WEIGHT_LB = {
    "electronics": 2.5,
    "apparel": 0.8,
    "footwear": 2.0,
    "furniture": 25.0,
    "collectibles": 1.0,
    "home & kitchen": 3.0,
    "books & media": 1.2,
    "toys & games": 1.5,
}

_DEFAULT_WEIGHT_LB = 2.0


def estimate_weight_lb(category: str, item_name: str) -> float:
    key = category.strip().lower()
    base = _CATEGORY_BASE_WEIGHT_LB.get(key, _DEFAULT_WEIGHT_LB)

    name = item_name.lower()
    if "mini" in name or "small" in name:
        base *= 0.6
    elif "large" in name or "xl" in name or "oversized" in name:
        base *= 1.5

    return round(base, 2)
