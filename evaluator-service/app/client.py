"""Single reusable ProdloopClient (module-level singleton).

Step 3 of the integration: never instantiate the client per request.
The instance is created lazily so the service can boot (and tests can run)
without the API key being present, failing clearly only when actually used.
"""

from functools import lru_cache

from prodloop import ProdloopClient

from app.config import get_settings


@lru_cache(maxsize=1)
def get_client() -> ProdloopClient:
    settings = get_settings()
    if not settings.prodloop_api_key:
        # ProdloopClient itself raises ValidationError on empty key, but we
        # give a clearer message pointing at the env var.
        raise RuntimeError(
            "PRODLOOP_API_KEY is not set. Add it to evaluator-service/.env "
            "or the process environment."
        )
    return ProdloopClient(
        api_key=settings.prodloop_api_key,
        timeout_seconds=settings.evaluate_timeout_seconds,
    )
