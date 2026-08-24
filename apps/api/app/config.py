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

    # CORS — comma-separated origins (e.g. "https://a.com,https://b.com").
    # Deliberately a plain string, not a list: pydantic-settings parses
    # list-typed env vars as strict JSON, which is easy to get wrong typing
    # brackets/quotes into a dashboard text field, and fails closed by
    # crashing the whole app on boot rather than just rejecting CORS.
    allowed_origins: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
