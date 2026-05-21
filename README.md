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
