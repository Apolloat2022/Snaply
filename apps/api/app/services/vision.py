"""Multimodal LLM call: image URL in, structured item identification out."""
from __future__ import annotations

import json

import httpx
from google import genai
from google.genai import types

from app.config import get_settings
from app.models.schemas import IdentifiedItem

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "item_name": {"type": "string"},
        "manufacturer": {"type": "string", "nullable": True},
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
}

_SYSTEM_PROMPT = (
    "You are a resale marketplace intake specialist. Given a photo of an item a seller wants to list, "
    "identify exactly what it is, who made it, and grade its visual condition as strictly as a "
    "professional reseller would. Only report what is visually verifiable in the image — do not guess "
    "specs you cannot see. Respond with a JSON object matching the provided schema."
)


async def identify_item(image_url: str) -> IdentifiedItem:
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)

    # Fetch the image bytes so Gemini can receive it as inline data
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
    }
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as http:
        img_resp = await http.get(image_url)
        img_resp.raise_for_status()
        image_bytes = img_resp.content
        content_type = img_resp.headers.get("content-type", "image/jpeg").split(";")[0]
        if not content_type.startswith("image/"):
            content_type = "image/jpeg"

    response = await client.aio.models.generate_content(
        model=settings.vision_model,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=content_type),
                    types.Part.from_text(text="Identify this item and grade its condition."),
                ],
            )
        ],
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=_RESPONSE_SCHEMA,
        ),
    )

    payload = json.loads(response.text)
    return IdentifiedItem.model_validate(payload)
