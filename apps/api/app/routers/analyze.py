from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, status
from google.genai import errors as genai_errors

from app.agents.pricing_graph import run_pricing_pipeline
from app.models.schemas import AnalyzeItemRequest, AnalyzeItemResponse

logger = logging.getLogger("api.analyze")

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze-item", response_model=AnalyzeItemResponse, status_code=status.HTTP_200_OK)
async def analyze_item(payload: AnalyzeItemRequest) -> AnalyzeItemResponse:
    """
    Vision-identify the uploaded item, price it against live secondary-market
    comparables, and return a ready-to-publish listing profile.
    """
    try:
        return await run_pricing_pipeline(str(payload.image_url))
    except genai_errors.APIError as exc:
        logger.exception("Gemini vision model call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vision model was unable to process the image.",
        ) from exc
    except httpx.HTTPError as exc:
        logger.exception("Market search or image fetch failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Comparable pricing search failed.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in pricing pipeline: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {type(exc).__name__}: {exc}",
        ) from exc
