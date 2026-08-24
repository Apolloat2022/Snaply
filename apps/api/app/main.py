from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import analyze

settings = get_settings()

app = FastAPI(title="Snaply — AI Pricing Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(analyze.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
