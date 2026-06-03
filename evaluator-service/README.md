# Prodloop Evaluator Sidecar

A small FastAPI service that wraps the [`prodloop-observability-sdk`](https://pypi.org/project/prodloop-observability-sdk/)
to evaluate AI voice-bot call recordings. The Next.js app (`../`) calls this
service; the SDK is Python-only so it cannot run inside Node directly.

## Endpoints

| Method | Path        | Purpose                                                        |
| ------ | ----------- | -------------------------------------------------------------- |
| GET    | `/health`   | Liveness + whether the API key is configured.                  |
| GET    | `/credits`  | Remaining Prodloop credits (`get_credit_balance()`).           |
| POST   | `/evaluate` | Multipart audio upload + JSON `payload` → evaluation result.   |

`POST /evaluate` form fields:

- `audio_file` — the recording (mp3/wav/m4a/…).
- `payload` — JSON string:
  ```json
  {
    "parameters": ["e2e_response_time", "hallucination"],
    "thresholds": {"e2e_response_time_max_ms": 800},
    "input_prompt": "Bot instructions used during this call...",
    "extraction_schema": {"customer_name": "string"},
    "bot_captured_variables": {"customer_name": "ram"}
  }
  ```

Validation rules (enforced by the SDK): `hallucination` requires `input_prompt`;
`extraction_variables` requires both `extraction_schema` and
`bot_captured_variables`.

## Configuration

Copy `.env.example` to `.env`:

```
PRODLOOP_API_KEY=plk_...        # required
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
# MAX_AUDIO_BYTES=52428800
# PRODLOOP_TIMEOUT_SECONDS=1800
```

The key is read from `PRODLOOP_API_KEY` and sent by the SDK as a Bearer token.
Never hardcode it.

## Run locally

```bash
cd evaluator-service
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
. .venv/bin/activate
pytest                       # mocked, no API calls / credits
RUN_PRODLOOP_INTEGRATION=1 pytest   # also runs the live credits check
```

## Docker

```bash
docker build -t prodloop-evaluator .
docker run --rm -p 8000:8000 --env-file .env prodloop-evaluator
```

## How it fits together

```
Browser ──► Next.js /api/evaluate ──► (fetch recording by Call ID from breeze)
                                  └──► POST multipart audio ──► this service
                                                                   │
                                                          ProdloopClient.evaluate_call()
                                                                   │
                                                          Prodloop cloud function
```

The breeze Bearer token stays in the Next.js layer; this service only ever sees
the audio bytes and the chosen parameters.
