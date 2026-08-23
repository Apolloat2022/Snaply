from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Multimodal LLM
    anthropic_api_key: str = ""
    vision_model: str = "claude-sonnet-5"

    # Secondary-market search tool (e.g. Tavily, SerpAPI, or a custom scraper service)
    market_search_api_key: str = ""
    market_search_base_url: str = "https://api.tavily.com/search"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # CORS
    allowed_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
