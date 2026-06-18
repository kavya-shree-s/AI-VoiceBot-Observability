# Breeze Transcript Insights MCP — Design

**Date:** 2026-06-15
**Status:** Approved (design), ready for implementation planning

## Goal

Add **aggregate insight mining** over call transcripts: have Claude read across
*many* calls to surface recurring failure modes and data-driven template-improvement
suggestions. This is qualitative analysis of transcript *text*, complementing the
existing purely statistical insights in `lib/analytics/insights.ts` (outcome-distribution
deltas between periods).

Delivered as a **reusable MCP server** exposing the Breeze transcript corpus as thin
data tools, plus an app-side orchestration layer that drives Claude through a
map-reduce over those tools. The server is usable both from the Next.js app (via the
Claude API remote-MCP connector) and interactively from Claude Desktop / Claude Code.

## Confirmed decisions

| Question | Decision |
|---|---|
| Primary goal | Aggregate insight mining (patterns / failure modes / template fixes across many calls) |
| Data source | Live Breeze API (`/leads/<id>`), fetched on demand |
| Consumer | Next.js app via the Claude API, with the MCP attached as a remote connector |
| MCP vs tool-use | A true, reusable MCP server (not inline tool-use) |
| Analysis pattern | Thin data tools; the consuming Claude drives map-reduce (no LLM inside the server) |
| Call enumeration | The set of call/lead IDs comes from the `call_details_*.csv` the app already holds — no new Breeze "list leads" endpoint |
| Models | `claude-sonnet-4-6` for the per-transcript digest (map) step; `claude-opus-4-8` for the reduce/synthesis step; adaptive thinking |

## The Breeze API surface (existing)

- `GET /leads/<id>` — one lead incl. `metaData.transcription` (`lib/leadFetcher.ts` → `fetchLead`)
- `GET /leads/recording/<id>` — recording (`lib/fetcher.ts`) — **not used here**
- `POST /analytics` — server-side aggregates by `type`/`filters` (`app/api/analytics/route.ts`)
- There is **no** "list all leads" endpoint; the app discovers call IDs from the uploaded CSV.

## Architecture

```
┌─ lib/breeze/ (shared) ──────┐   reused by both
│  client.ts  fetchLead+batch │
│  transcription.ts (existing)│
│  taxonomy.ts (eval params)  │
└──────────────┬──────────────┘
               │ imported by
   ┌───────────┴───────────────┐
   │                           │
┌──▼── mcp/ (new) ──────┐  ┌───▼── app/ (existing) ──────┐
│ MCP server            │  │ Insights orchestration      │
│  tools/resources/     │  │  Claude API + MCP connector │
│  prompts + transport  │  │  map-reduce loop            │
└──────────┬────────────┘  │  → structured Insight[]     │
           │  attached as   │  → Insights.tsx renders     │
           └── remote MCP ──▶                             │
                            └─────────────────────────────┘
```

### Unit 1 — `lib/breeze/` (shared module)

Extract the Breeze-fetching logic currently in `lib/leadFetcher.ts` and
`lib/transcription.ts` into a shared module imported by **both** the Next.js app and
the MCP server, so there is one implementation of transcript fetching/cleaning.

- `client.ts` — `fetchLead` (moved/re-exported), plus `fetchTranscriptsBatch(ids, token)`
  with `p-limit` concurrency and per-id error collection (mirrors
  `app/api/transcriptions/route.ts`).
- `transcription.ts` — existing `extractTranscription`, `filterByKeyword`, etc. (unchanged).
- `taxonomy.ts` — re-export of the evaluation `PARAMETERS` vocabulary from
  `lib/evaluation.ts` for consistent failure-mode tagging.

**Depends on:** Breeze HTTP API, a Bearer token.

### Unit 2 — `mcp/` (the MCP server)

- **Stack:** TypeScript + `@modelcontextprotocol/sdk`. **Streamable HTTP** transport
  (required for the Claude API remote-MCP connector to attach by URL). A thin stdio
  entrypoint may also be provided for local Claude Desktop use.
- **Auth:** Breeze Bearer token passed via the `Authorization` header and forwarded to
  Breeze. The token is **never** a tool argument.
- **Tools (thin, data-only — no LLM in the server):**
  - `list_calls(calls[])` — accepts the call records the app holds from the CSV
    (`id`, `outcome`, `template`, `startTime`); returns metadata only, no transcripts.
    The "index."
  - `get_transcript(leadId)` — live fetch + cleaned user/assistant turns.
  - `get_transcripts_batch(ids[])` — concurrency-limited, count-bounded batch fetch.
  - `search_transcripts(ids[], keyword)` — fetch + `filterByKeyword`; returns matching
    IDs + snippets.
  - `sample_transcripts(ids[], n, stratifyBy)` — stratified sample (by `outcome` or
    `template`) so Claude mines a representative subset instead of all N.
  - `get_outcome_stats(filters)` — proxies `POST /analytics` for quantitative grounding.
- **Resource:** the evaluation taxonomy (`PARAMETERS`) so Claude tags findings with the
  existing vocabulary (`hallucination`, `section_sequencing`, …) rather than inventing labels.
- **Prompt:** a `mine_insights` MCP prompt encoding the map-reduce recipe.

**Depends on:** `lib/breeze/`, MCP SDK.

### Unit 3 — App-side Insights orchestration

- A backend route/module calls the Claude API (`claude-opus-4-8`, adaptive thinking)
  with the MCP server attached as a remote connector.
- **Map-reduce flow:**
  1. `sample_transcripts` → representative ID set.
  2. `get_transcripts_batch` in chunks (~10–20) → Claude digests each chunk into compact
     structured findings (map step; `claude-sonnet-4-6` to control cost).
  3. Accumulate findings across chunks.
  4. Cluster into common failure modes + suggested template improvements, tagged to the
     taxonomy (reduce step; `claude-opus-4-8`).
  5. Return a structured `Insight[]` (qualitative variant) for rendering.
- `app/analytics/Insights.tsx` is extended to render qualitative findings alongside the
  existing statistical insights.

**Depends on:** Claude API key (app-side), the MCP server URL + Breeze token.

## Data flow

CSV call records (already in app) → `list_calls` / `sample_transcripts` (IDs) →
`get_transcripts_batch` (live transcripts) → per-chunk digest (Sonnet) → accumulate →
cluster + propose fixes (Opus) → `Insight[]` → Insights tab.

## Error handling

- 401/403 from Breeze → surface as an auth failure so the app can prompt re-login
  (matches `app/api/transcriptions/route.ts`).
- Per-transcript fetch errors are collected, not fatal (matches the existing ZIP/CSV flow).
- Batch sizes are bounded to avoid context-window blowups; concurrency is limited via `p-limit`.
- Claude API: handle `stop_reason: "refusal"` and `max_tokens`; stream the reduce step if
  output is large.

## Testing

- Vitest with a mocked `fetchLead` (mirrors `lib/transcription.test.ts`): unit-test
  sampling stratification, batch bounding + error collection, keyword search, and the
  taxonomy resource payload.
- MCP tools tested at the handler level with a fixture transcript set.
- Orchestration tested against a small recorded transcript fixture (deterministic digests
  via mocked Claude responses).

## Scope boundaries (YAGNI)

**Out:** server-side LLM / API key inside the MCP server; a local transcript store (data
is live); audio/recording analysis. **In:** transcripts only, live fetch, thin tools,
client-driven reasoning.

## Open follow-ups (non-blocking)

- Exact deployment target/URL + auth scheme for the remote MCP server (env-configurable).
- Whether to also expose the `mine_insights` prompt as a one-click action in the UI.
