# Census Classifier + Workbook Export — Design

**Date:** 2026-06-15
**Status:** Approved (design), ready for implementation planning
**Supersedes the analysis approach in:** `2026-06-15-breeze-transcript-mcp-design.md`

## Goal

Turn the transcript-insights feature from a **sampled qualitative miner** into a
**full-census, per-call structured classifier** that produces exact aggregated numbers
and a downloadable multi-sheet workbook matching the analyst's existing
`Transferred_call_analysis_*.xlsx`. The LLM only *labels* each call; every count and
percentage is computed deterministically in TypeScript.

## Why (gap vs the manual xlsx)

| Dimension | Current feature | Target (the xlsx) |
|---|---|---|
| Coverage | ~20-call sample | Census — every in-scope call |
| Frequencies | LLM-estimated | Exact counts from labels, computed in code |
| Taxonomy | Generic eval defects | Fixed business reasons (config) |
| Per-call data | none | Every call labeled into structured fields |
| Output | on-screen cards | Multi-sheet `.xlsx` download |

The engine is **per-call classification**: once each call is labeled, the
Reason_breakdown, Summary, Per_call, and QA sheets all fall out by plain aggregation.

## Confirmed decisions

| Question | Decision |
|---|---|
| Scope (which upgrades) | Deterministic aggregation + real %, and xlsx/CSV export (per-call classification is the required engine) |
| Reason taxonomy source | Fixed list, config-driven, **seeded from the xlsx** |
| Population | Whatever call set is in scope (user filters to `TRANSFERRED` themselves) — not hard-coded |
| Per-call model | `claude-haiku-4-5` with structured outputs (`strict: true`) |
| Aggregation | Plain TypeScript — no LLM |
| Narrative Findings/Recommendations sheets | Out of scope for now (not selected) |

## Seed taxonomy (from the xlsx, exact)

```
TEST_RIDE_VERIFY_FAILED:
  - Test-ride failed: notification not received
  - Test-ride failed: GPS/location off
  - Test-ride failed: driver offline
  - Test-ride failed: driver on ride
OUT_OF_SCOPE:
  - Out-of-scope query
RIDES_UNRESOLVED:
  - Rides still not coming after troubleshooting
TECH_ERROR:
  - Technical / API error
OTHER_ESCALATION:
  - Other / early human demand
BLOCK_UNBLOCK:
  - Account block / unblock request
```

Stored per template (the export was `driver-rides-block-support`). Editable in one file.

## Per-call classification output (one row per call)

```ts
type CallLabel = {
  callId: string;
  reasonCategory: string;   // must be a taxonomy category
  reasonDetail: string;     // must be a detail under that category
  driverClaimedOnline: boolean;
  explicitHuman: boolean;   // driver explicitly demanded a human at any point
  lastUserTurn: string;     // verbatim, may be Kannada
  snippet: string;          // short verbatim grounding snippet
  nTurns: number;           // computed in code from the transcript, not asked
  error?: string;           // set if the call could not be classified
};
```

## Architecture (units, all under `lib/insights/`)

### `reasonTaxonomy.ts`
The fixed taxonomy seeded above. Shape: `Record<templateName, { category, details: string[] }[]>`
plus a default. Helper `taxonomyFor(template)` and `flatDetails(taxonomy)` (category→details).
Validation helper `isValidLabel(taxonomy, category, detail)`.

### `classify.ts`
`classifyCall(transcript, taxonomy, claude): Promise<CallLabel>` — one Haiku call with
structured outputs constraining `reasonCategory`/`reasonDetail` to taxonomy values and the
two booleans. `lastUserTurn` and `nTurns` derived from the transcript in code (the LLM
result is reconciled against the parsed turns). Errors are captured on the row, not thrown.
The classifier takes an **injected `classify` function** (`(transcript, taxonomy) => Promise<RawLabel>`)
so tests run without network; the concrete implementation calls Haiku with structured outputs.
This mirrors the dependency-injection style of the existing `lib/insights/claude.ts` (a different
shape from its text-only `ClaudeJson`, since classification needs a constrained JSON schema).

### `aggregate.ts` (pure, no LLM)
- `summary(labels, opts)` → report date, total calls, template, biggest category (n, %),
  explicit-human count, and the per-detail rollups the xlsx Summary shows.
- `reasonBreakdown(labels)` → rows `{ category, detail, calls, pct }` sorted by calls desc;
  `pct` = calls / total × 100, one decimal.
- `perCall(labels)` → the full labeled table (adds phone/name/startTime/recordingUrl from the
  CallRef + lead data threaded through).
- `qaSubset(labels, predicate)` → filtered call list (e.g. detail = "notification not received").

### `workbook.ts`
`buildWorkbook(sheets): Promise<Buffer>` using `exceljs`, sheets: Summary, Reason_breakdown,
Per_call, and any QA_* passed in. `toCsv(rows)` for the CSV variant (reuse existing CSV
escaping conventions).

### Orchestration — rewrite `app/api/insights/route.ts`
Census flow: fetch transcripts for **all** in-scope calls (concurrency-limited, errors
collected via the existing `fetchTranscriptsBatch`, looped past `MAX_BATCH`) → `classifyCall`
each (concurrency-limited) → aggregate → respond. `?format=xlsx` streams the workbook with a
`Content-Disposition` download header; default returns `{ summary, breakdown, perCall }` JSON.

### MCP server (`mcp/server.ts`)
Add `classify_call` (transcript + template → CallLabel) and `aggregate_breakdown`
(labels[] → breakdown) tools so the census pipeline is drivable from Claude Desktop and the
server stays in sync with the app.

### UI (`app/InsightsMiner.tsx`)
Replace the sampled-cards view with the **Reason_breakdown table** (category · detail · calls · %)
and a **"Download workbook (.xlsx)"** button (hits `/api/insights?format=xlsx`). Show progress
("Classifying N calls…") since a census of ~100 calls takes longer than a sample.

## Models & runtime

- Per-call classification: `claude-haiku-4-5`, structured outputs, bounded concurrency (~8).
- The previous Sonnet-digest / Opus-synthesis path is **removed** from this flow (aggregation
  is code). `lib/insights/orchestrator.ts` is retired/replaced.
- Synchronous for now. ~100 calls ≈ ~100 transcript fetches + ~100 Haiku calls. If this ever
  exceeds the route timeout, a background job is the follow-up (out of scope here).

## Error handling

- Transcript fetch failure → `CallLabel.error` set; the call appears in Per_call and is counted
  in an `UNCLASSIFIED` / "Could not classify" breakdown row so totals reconcile to the full
  population; its count is surfaced in Summary.
- Classification returns an out-of-taxonomy value → coerced to `OTHER_ESCALATION` /
  "Other / early human demand" with a logged warning (strict outputs make this rare).
- 401/403 from Breeze → surface auth failure (re-login), as today.
- Missing `ANTHROPIC_API_KEY` → 500 with a clear message (as today).

## Testing

- `reasonTaxonomy.test.ts` — every seeded detail maps to exactly one category; `isValidLabel`.
- `aggregate.test.ts` — counts, percentages (rounding), sort order, UNCLASSIFIED bucket,
  `qaSubset` filter. Pure, deterministic.
- `classify.test.ts` — mocked Haiku client: valid label passes through; out-of-taxonomy
  coerced; `nTurns`/`lastUserTurn` derived from the transcript; fetch error → `error` row.
- `workbook.test.ts` — `buildWorkbook` returns a non-empty buffer with the expected sheet
  names and row counts; `toCsv` escaping.

## Scope boundaries (YAGNI)

**Out:** narrative Findings/Recommendations sheets, model-derived taxonomy, background-job
runner, audio analysis, day-over-day trend storage. **In:** fixed taxonomy, census per-call
classification, deterministic aggregation, xlsx/CSV export, the two new MCP tools, the table UI.

## Open follow-ups (non-blocking)

- Background-job execution if the synchronous census times out at higher call volumes.
- Optional narrative Findings/Recommendations sheets (Opus pass) if wanted later.
