# Breeze Buddy → Prodloop Evaluation Pipeline

**Audience:** Prodloop SDK team
**Status:** Design / integration proposal
**Date:** 2026-05-25

## 1. Why this doc

Breeze Buddy (an outbound AI voice agent) exposes HTTP APIs to authenticate and
pull call records — same pattern as the Tata voice-bot integration. Each record
carries the call metadata **and a recording URL**. We want to turn this into a
fully automated pipeline that feeds recordings into the Prodloop SDK
(`ProdloopClient.evaluate_call()`) instead of the current manual flow
(operator uploads a `call_details_*.csv` and pastes a bearer token by hand).

This doc describes the two Breeze APIs (`/login`, `/analytics`), the data each
record carries, and **exactly how each field maps onto `evaluate_call()`** so the
Prodloop team can confirm the contract before we build it.

## 2. Current vs. target flow

**Today (manual):**

```
operator → paste Breeze bearer token in UI
operator → upload call_details_*.csv export
UI       → POST /api/evaluate { token, callId, parameters, ... }
/api/evaluate → fetchRecording(callId, token)  (Breeze recording endpoint)
              → POST evaluator-service /evaluate (multipart audio + payload)
evaluator-service → ProdloopClient.evaluate_call(...)
```

Code that already exists in this repo:

- `app/api/login/route.ts` — wraps Breeze `/login`, returns the access token.
- `app/api/recording/route.ts` + `lib/fetcher.ts` — fetch a single recording by Call ID.
- `app/api/evaluate/route.ts` — fetch recording + forward to the sidecar.
- `evaluator-service/app/main.py` — FastAPI sidecar, `POST /evaluate` → `evaluate_call()`.
- `evaluator-service/app/client.py` — singleton `ProdloopClient`.

**Target (automated pipeline):**

```
scheduler / trigger
  → POST Breeze /login                      → access_token
  → POST Breeze /analytics (date range)     → page of call records (incl. recording URL + metadata)
  → for each record:
        fetch recording (URL or Breeze recording endpoint)
        → ProdloopClient.evaluate_call(audio, parameters, schema, bot_captured_variables, ...)
        → persist evaluation result keyed by Call ID / Lead ID
  → next page until exhausted
```

The **only new Breeze integration piece** is `/analytics` — it replaces the
manual CSV upload. `/login` is already integrated.

## 3. Breeze APIs

### 3.1 `POST /login`

```
POST https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/login
Content-Type: application/json

{ "username": "<USER_NAME>", "password": "<PWD>" }
```

Response:

```json
{ "access_token": "<JWT>", "token_type": "Bearer", "expires_in": 3600 }
```

Notes:
- Token is a JWT; it expires after ~1 hour (`expires_in: 3600`).
- The JWT payload carries `reseller_ids[]` and `merchant_ids[]` (see `lib/jwt.ts`),
  used by the templates endpoint and useful for tagging evaluation results by org.
- The pipeline must refresh the token when it nears expiry across long paginated runs.

### 3.2 `POST /analytics` (call-details-download)

```
POST https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/analytics
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "call-details-download",
  "filters": { "date_from": "2026-05-22", "date_to": "2026-05-22" },
  "options": { "page": 1, "limit": 10, "sort_by": "call_initiated_time", "sort_order": "desc" }
}
```

Returns the call-details rows. Each row (CSV-shaped today) contains:

| Field             | Example                                                              | Notes |
| ----------------- | -------------------------------------------------------------------- | ----- |
| Lead ID           | `c0b9fb65-…`                                                         | stable per lead |
| Call ID           | `dd455478-…`                                                         | unique per call; primary key for the recording |
| Template          | `namma-yatri-customer-not-responding-kannada`                        | identifies bot script / language → drives `input_prompt` + `extraction_schema` choice |
| Name              | `MALATESHA M ROTTI`                                                   | |
| Mobile Number     | `917406408227`                                                       | |
| Start Time        | `2026-05-22 18:24:55`                                                 | |
| End Time          | `2026-05-22 18:26:40`                                                 | |
| Duration          | `104` (seconds)                                                      | useful sanity check vs. latency metrics |
| Outcome           | `TRANSFERRED`                                                        | call disposition (e.g. TRANSFERRED, customer-not-responding) |
| Metadata Outcome  | `{"driver_id":"…","driver_name":"…","driver_number":"…"}` (JSON str) | → `bot_captured_variables` / ground-truth |
| Attempt Count     | `1`                                                                  | |
| Record            | `https://buddy.breezelabs.app/calls/records/<leadId>`                | dashboard link (not the audio) |
| Recording URL     | `https://aps1.media.plivo.com/v1/Account/…/Recording/<uuid>.mp3`     | **direct audio**; can be fetched without a Breeze token |

> The pipeline can fetch audio two ways: (a) the direct **Recording URL** (Plivo
> CDN, no Breeze auth), or (b) the existing Breeze recording endpoint
> `…/breeze-buddy/leads/recording/<Call ID>` with the bearer token (`lib/fetcher.ts`).
> We default to (a) when present, falling back to (b).

## 4. Mapping a Breeze record → `evaluate_call()`

This is the part we need the Prodloop team to confirm. The sidecar already calls:

```python
client.evaluate_call(
    audio_file_path=tmp_path,
    parameters=meta["parameters"],
    thresholds=meta.get("thresholds"),
    extraction_schema=meta.get("extraction_schema"),
    bot_captured_variables=meta.get("bot_captured_variables"),
    input_prompt=meta.get("input_prompt"),
)
```

Proposed mapping per Breeze record:

| `evaluate_call()` arg     | Source from Breeze record | Notes / open question |
| ------------------------- | ------------------------- | --------------------- |
| `audio_file_path`         | downloaded **Recording URL** (`.mp3`) | persisted to a temp file by the sidecar |
| `parameters`              | fixed set per pipeline run | e.g. `["e2e_response_time", "hallucination", "extraction_accuracy", "conversation_flow"]` — **which canonical parameter names does Prodloop expect?** |
| `thresholds`              | pipeline config | e.g. `{"e2e_response_time_max_ms": 800}` — confirm exact keys |
| `input_prompt`            | derived from **Template** | the system prompt the bot ran with for that template/language. We keep a `template → input_prompt` map. **Does Prodloop need the literal prompt text, or a prompt ID?** |
| `extraction_schema`       | derived from **Template** | e.g. `{"driver_name": "string", "driver_number": "string"}` |
| `bot_captured_variables`  | parsed **Metadata Outcome** JSON | `{"driver_id","driver_name","driver_number"}` — these are the variables the bot actually captured; used to score extraction accuracy |

Additional context we'd like to attach to each evaluation (for filtering/reporting),
**if the SDK supports arbitrary tags/metadata** — please confirm:

- `call_id`, `lead_id`, `template`, `outcome`, `attempt_count`, `duration_seconds`, `merchant_id` / `reseller_id` (from JWT).

### Open questions for Prodloop

1. **Parameter names** — canonical strings for latency / hallucination / extraction / flow-compliance?
2. **`input_prompt`** — literal text vs. a registered prompt ID? Per-call or per-template is fine?
3. **Tags/metadata** — can we attach `call_id`, `template`, `outcome`, org IDs to each `evaluate_call()` for later querying? If yes, what's the arg?
4. **Batch API** — is there a batch/async variant so we don't call `evaluate_call()` once per recording over a day's worth of calls? What concurrency / rate limits apply?
5. **Idempotency** — if we re-run a date range, can we dedupe by `call_id` on the Prodloop side, or do we own dedup?
6. **Credits** — `get_credit_balance()` exists; what's the credit cost per `evaluate_call()` and per evaluated minute, so we can budget a daily run?

## 5. Proposed pipeline (no code yet — design)

1. **Auth** — call `/login`; cache token + expiry; refresh when <5 min remain.
2. **Fetch page** — `POST /analytics` with the date range and `options.page`/`limit`;
   loop pages until an empty/short page (mirrors today's CSV, which is one `/analytics` export).
3. **Filter** — optionally by `Outcome` and/or `Template` (same filters the UI offers today).
4. **Per record** — download audio (Recording URL → temp file), build the
   `evaluate_call()` payload via the template/metadata mapping above, call the
   evaluator-service `/evaluate` (or the SDK directly inside the worker).
5. **Persist** — store the returned evaluation result keyed by `call_id` + `lead_id`,
   tagged with template/outcome/org.
6. **Concurrency & retries** — reuse the existing 8-way concurrency + retry pattern
   from `lib/extractor.ts` / `lib/fetcher.ts`; back off on Prodloop rate limits.

Config (env), extending what's already in `evaluator-service/.env.example` and the README:

| Env var                | Purpose |
| ---------------------- | ------- |
| `BREEZE_LOGIN_URL`     | already used by `app/api/login/route.ts` |
| `BREEZE_ANALYTICS_URL` | **new** — `…/breeze-buddy/analytics` |
| `BREEZE_RECORDING_URL` | already used (`lib/fetcher.ts`) — fallback audio fetch |
| `BREEZE_USERNAME` / `BREEZE_PASSWORD` | service credentials for unattended `/login` |
| `PRODLOOP_API_KEY`     | already used by the sidecar |

## 6. Data / security notes

- Recordings contain PII (driver name + phone). The current sidecar writes audio to
  a temp file and `unlink`s it after evaluation — the pipeline keeps that contract.
- The Breeze bearer token stays server-side (never shipped to the browser, as today).
- Plivo Recording URLs may be presigned/time-limited — confirm TTL so the pipeline
  fetches audio promptly after `/analytics` returns it.

## 7. What we need from Prodloop to proceed

- Sign-off on the **field → `evaluate_call()` mapping** in §4.
- Answers to the six **open questions** in §4.
- Guidance on **batch/async** evaluation and **rate limits** for daily runs.
