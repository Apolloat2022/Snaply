"""Multimodal LLM call: image URL in, structured item identification out."""
from __future__ import annotations

import anthropic

from app.config import get_settings
from app.models.schemas import IdentifiedItem

_IDENTIFY_TOOL = {
    "name": "record_identification",
    "description": "Record the identified item, manufacturer, category, and visual condition assessment.",
    "input_schema": {
        "type": "object",
        "properties": {
            "item_name": {"type": "string"},
            "manufacturer": {"type": ["string", "null"]},
            "category": {"type": "string", "description": "e.g. Electronics, Furniture, Apparel, Collectibles"},
            "condition": {
                "type": "string",
                "enum": ["new", "like_new", "good", "fair", "poor"],
            },
            "condition_notes": {
                "type": "string",
                "description": "Visible wear, damage, missing parts, or reasons for the condition grade",
            },
            "distinguishing_features": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Model numbers, colorways, materials, or other details useful for pricing search",
            },
        },
        "required": ["item_name", "category", "condition", "condition_notes"],
    },
}

_SYSTEM_PROMPT = (
    "You are a resale marketplace intake specialist. Given a photo of an item a seller wants to list, "
    "identify exactly what it is, who made it, and grade its visual condition as strictly as a "
    "professional reseller would. Only report what is visually verifiable in the image — do not guess "
    "specs you cannot see. Always respond by calling record_identification."
)


async def identify_item(image_url: str) -> IdentifiedItem:
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    response = await client.messages.create(
        model=settings.vision_model,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        tools=[_IDENTIFY_TOOL],
        tool_choice={"type": "tool", "name": "record_identification"},
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "url", "url": image_url}},
                    {"type": "text", "text": "Identify this item and grade its condition."},
                ],
            }
        ],
    )

    tool_use = next(block for block in response.content if block.type == "tool_use")
    payload = tool_use.input
    return IdentifiedItem.model_validate(payload)
