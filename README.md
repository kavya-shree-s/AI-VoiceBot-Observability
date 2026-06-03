# Call Recording Extractor

A Next.js web tool to bulk-download Breeze Buddy call recordings from a CSV.

Upload the daily `call_details_*.csv` export, paste your Breeze Bearer token, optionally
filter by `Outcome` and date range, and download every matching recording bundled
into a single ZIP. Failed downloads are listed in `_errors.csv` inside the ZIP.

## Features

- Bearer token stays in the browser tab (sessionStorage) — never persisted server-side
- CSV parsed client-side with PapaParse
- Filters: `Outcome` (multi-select) + `Start Time` date range
- 8 parallel downloads with retry on transient failures
- Files in the ZIP named `<Mobile>_<Name>_<CallID>.mp3`
- Partial failures don't abort the run — they're collected in `_errors.csv`

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Tests

```bash
npm test
```

## Production build

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t call-recording-extractor .
docker run --rm -p 3000:3000 call-recording-extractor
```

The image is built using `output: "standalone"` so it's small and self-contained.
Deploy on any host that runs Docker (Railway, Render, Fly.io, EC2, etc.).

> Note: jobs are kept in-memory and auto-purge after 1 hour, so run a single
> container instance. The ZIP is freed from memory as soon as it's downloaded.

## Configuration

| Env var                | Default                                                                              | Purpose                                                  |
| ---------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `BREEZE_RECORDING_URL` | `https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/leads/recording`        | Base URL the server calls; the Call ID is appended.      |
| `BREEZE_TEMPLATES_URL` | `https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/templates/list`         | Templates list endpoint for the Template filter.         |
| `BREEZE_LOGIN_URL`     | `https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/login`                  | Login endpoint; username/password is exchanged for a token. |
| `BREEZE_LEADS_URL`     | `https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/leads`                  | Base URL for lead/transcription lookups; the Call ID is appended. |
| `BREEZE_ANALYTICS_URL` | `https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/analytics`              | Analytics endpoint used by the Analytics dashboard tab. |
| `EVALUATOR_URL`        | `http://localhost:8000`                                                              | Base URL of the Python evaluator sidecar (see below).    |

## AI evaluation (Prodloop)

Call recordings can be evaluated with the Prodloop SDK (latency, hallucination,
extraction accuracy, conversation-flow compliance, etc.). Because the SDK is
Python-only, evaluation runs in a **FastAPI sidecar** under
[`evaluator-service/`](./evaluator-service/README.md).

Flow: the **Evaluate** button in the Preview list → Next.js `POST /api/evaluate`
fetches the recording by Call ID (reusing the breeze token), then forwards the
audio to the sidecar, which calls `ProdloopClient.evaluate_call()`.

To use it, run both processes:

```bash
# terminal 1 — Next.js
npm run dev

# terminal 2 — Python sidecar
cd evaluator-service
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # then set PRODLOOP_API_KEY
uvicorn app.main:app --reload --port 8000
```

Point Next.js at the sidecar with `EVALUATOR_URL` if it's not on
`http://localhost:8000`.

## How to get the Bearer token

1. Open https://buddy.breezelabs.app/ and sign in
2. Open DevTools → Network tab → click any request that hits `clairvoyance.breezelabs.app`
3. In Request Headers copy the value after `Authorization: Bearer ` (just the long string)
4. Paste into the tool's Bearer token field

The token typically expires after one hour. If you start getting 401s, refresh
your browser session and paste the new token.

## CSV format

The CSV must be the Breeze Buddy `call_details_*.csv` export. The tool reads:

- `Call ID` — used in the API URL
- `Name`, `Mobile Number` — used to name the saved files
- `Outcome`, `Start Time` — used for filtering
