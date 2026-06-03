"""FastAPI sidecar that wraps the Prodloop evaluation SDK.

Exposes:
  GET  /health   - liveness probe
  GET  /credits  - remaining Prodloop credits
  POST /evaluate - multipart audio upload + JSON params -> evaluation result

The Next.js app fetches a recording by Call ID and forwards it here as a
multipart upload. This service persists it to a temp file, calls
ProdloopClient.evaluate_call(), and cleans the temp file up afterwards.
"""

import json
import logging
import os
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prodloop.exceptions import APIError, ValidationError

from app.client import get_client
from app.config import get_settings

logger = logging.getLogger("evaluator")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Prodloop Evaluator Sidecar", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_ALLOWED_AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".webm"}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "api_key_configured": bool(settings.prodloop_api_key)}


@app.get("/credits")
def credits() -> Dict[str, Any]:
    try:
        return get_client().get_credit_balance()
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except APIError as exc:
        raise HTTPException(status_code=_api_status(exc), detail=exc.message)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/evaluate")
async def evaluate(
    audio_file: UploadFile = File(...),
    payload: str = Form(...),
) -> JSONResponse:
    """Evaluate an uploaded recording.

    `payload` is a JSON string:
      {
        "parameters": ["e2e_response_time", "hallucination", ...],
        "thresholds": {"e2e_response_time_max_ms": 800},     # optional
        "input_prompt": "...",                                # optional
        "extraction_schema": {"customer_name": "string"},     # optional
        "bot_captured_variables": {"customer_name": "ram"}    # optional
      }
    """
    try:
        meta = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="payload must be valid JSON")
    if not isinstance(meta, dict):
        raise HTTPException(status_code=400, detail="payload must be a JSON object")

    parameters: List[str] = meta.get("parameters") or []
    if not parameters:
        raise HTTPException(
            status_code=400, detail="At least one evaluation parameter is required."
        )

    _validate_upload(audio_file)

    tmp_path = await _persist_to_temp(audio_file)
    try:
        client = get_client()
        result = client.evaluate_call(
            audio_file_path=tmp_path,
            parameters=parameters,
            thresholds=meta.get("thresholds"),
            extraction_schema=meta.get("extraction_schema"),
            bot_captured_variables=meta.get("bot_captured_variables"),
            input_prompt=meta.get("input_prompt"),
        )
        logger.info(
            "evaluation ok: params=%s file=%s",
            parameters,
            audio_file.filename,
        )
        return JSONResponse(content={"result": result})
    except ValidationError as exc:
        # Invalid local inputs (bad params, missing prompt/schema) -> 400.
        raise HTTPException(status_code=400, detail=str(exc))
    except APIError as exc:
        # Backend failure -> surface status, default to 502.
        logger.warning("prodloop APIError %s: %s", exc.status_code, exc.message)
        raise HTTPException(status_code=_api_status(exc), detail=exc.message)
    except RuntimeError as exc:
        # Missing API key etc.
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _safe_unlink(tmp_path)


def _validate_upload(audio_file: UploadFile) -> None:
    name = (audio_file.filename or "").lower()
    ext = os.path.splitext(name)[1]
    content_type = (audio_file.content_type or "").lower()
    looks_audio = content_type.startswith("audio/") or ext in _ALLOWED_AUDIO_EXTS
    if not looks_audio:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported audio file (content-type={content_type!r}, "
                f"ext={ext!r}). Expected an audio recording."
            ),
        )


async def _persist_to_temp(audio_file: UploadFile) -> str:
    suffix = os.path.splitext(audio_file.filename or "")[1] or ".mp3"
    max_bytes = settings.max_audio_bytes
    total = 0
    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="prodloop_")
    try:
        with os.fdopen(fd, "wb") as out:
            while True:
                chunk = await audio_file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Audio exceeds max size of {max_bytes} bytes.",
                    )
                out.write(chunk)
    except Exception:
        _safe_unlink(tmp_path)
        raise
    if total == 0:
        _safe_unlink(tmp_path)
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
    return tmp_path


def _safe_unlink(path: Optional[str]) -> None:
    if not path:
        return
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass
    except OSError as exc:
        logger.warning("failed to delete temp file %s: %s", path, exc)


def _api_status(exc: APIError) -> int:
    code = getattr(exc, "status_code", 502) or 502
    # Pass through 4xx as-is; collapse server/unknown errors to 502.
    if 400 <= code < 500:
        return code
    return 502
