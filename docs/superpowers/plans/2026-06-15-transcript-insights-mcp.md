# Breeze Transcript Insights MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable MCP server exposing Breeze call transcripts as thin data tools, plus an in-app Claude orchestration that map-reduces those tools into qualitative "insight mining" findings (recurring failure modes + template fixes).

**Architecture:** All testable logic lives under `lib/` (shared by app and server). `lib/breeze/` wraps Breeze fetching + sampling; `lib/mcp/tools.ts` holds tool logic; `mcp/server.ts` is thin MCP wiring (Streamable HTTP + stdio); `lib/insights/orchestrator.ts` drives the map-reduce by calling the same tool functions in-process and calling Claude (Sonnet for per-transcript digests, Opus for synthesis); `app/api/insights/route.ts` + `app/analytics/Insights.tsx` expose it in-product. The MCP HTTP server is the external/Claude-Desktop surface; the app reuses the tool functions directly so it needs no public MCP URL.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` v1.29.0, `zod`, `@anthropic-ai/sdk`, `express`, `p-limit` (already a dep), Vitest. Models: `claude-sonnet-4-6` (map), `claude-opus-4-8` (reduce), adaptive thinking.

**Spec:** `docs/superpowers/specs/2026-06-15-breeze-transcript-mcp-design.md`

**Conventions for every task:** imports inside `lib/` are **relative** (vitest has no `@/` alias and only includes `lib/**/*.test.ts`). Run all tests with `npm test`.

---

### Task 1: Shared Breeze types

**Files:**
- Create: `lib/breeze/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// lib/breeze/types.ts

/** Minimal call reference the app already holds from the call_details_*.csv. */
export type CallRef = {
  leadId: string;
  callId: string;
  outcome: string;
  template: string;
  startTime: string;
};

/** Result of fetching one transcript live from Breeze. */
export type TranscriptResult = {
  leadId: string;
  transcription: string;
  error?: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/breeze/types.ts
git commit -m "feat: add shared Breeze types for transcript MCP"
```

---

### Task 2: Stratified sampling (pure function)

**Files:**
- Create: `lib/breeze/sample.ts`
- Test: `lib/breeze/sample.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/breeze/sample.test.ts
import { describe, it, expect } from "vitest";
import { stratifiedSample } from "./sample";
import type { CallRef } from "./types";

function ref(leadId: string, outcome: string): CallRef {
  return { leadId, callId: leadId, outcome, template: "t", startTime: "" };
}

describe("stratifiedSample", () => {
  it("returns all calls when n >= population", () => {
    const calls = [ref("1", "RESOLVED"), ref("2", "TRANSFERRED")];
    expect(stratifiedSample(calls, 5, "outcome")).toHaveLength(2);
  });

  it("returns empty for n<=0 or empty input", () => {
    expect(stratifiedSample([ref("1", "RESOLVED")], 0, "outcome")).toEqual([]);
    expect(stratifiedSample([], 5, "outcome")).toEqual([]);
  });

  it("spreads the sample across strata (round-robin), not all from one group", () => {
    const calls = [
      ref("a1", "RESOLVED"), ref("a2", "RESOLVED"), ref("a3", "RESOLVED"),
      ref("b1", "TRANSFERRED"), ref("b2", "TRANSFERRED"),
    ];
    const out = stratifiedSample(calls, 2, "outcome");
    expect(out).toHaveLength(2);
    const outcomes = new Set(out.map((c) => c.outcome));
    expect(outcomes.size).toBe(2); // one from each stratum
  });

  it("is deterministic for the same input", () => {
    const calls = [ref("a1", "X"), ref("a2", "X"), ref("b1", "Y")];
    expect(stratifiedSample(calls, 2, "outcome")).toEqual(
      stratifiedSample(calls, 2, "outcome")
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/breeze/sample.test.ts`
Expected: FAIL — cannot find module `./sample`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/breeze/sample.ts
import type { CallRef } from "./types";

/**
 * Deterministically picks up to `n` calls spread across strata, so a sample
 * over many calls stays representative of each outcome/template rather than
 * over-weighting the largest group. Round-robins groups in first-seen order.
 */
export function stratifiedSample(
  calls: CallRef[],
  n: number,
  stratifyBy: "outcome" | "template"
): CallRef[] {
  if (n <= 0 || calls.length === 0) return [];
  if (calls.length <= n) return [...calls];

  const groups = new Map<string, CallRef[]>();
  for (const c of calls) {
    const key = c[stratifyBy] || "(none)";
    const g = groups.get(key) ?? [];
    g.push(c);
    groups.set(key, g);
  }

  const groupList = [...groups.values()];
  const cursors = new Array(groupList.length).fill(0);
  const result: CallRef[] = [];
  let i = 0;
  const safety = calls.length * 2;
  while (result.length < n && i < safety) {
    const idx = i % groupList.length;
    const g = groupList[idx];
    if (cursors[idx] < g.length) {
      result.push(g[cursors[idx]]);
      cursors[idx] += 1;
    }
    i += 1;
  }
  return result.slice(0, n);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/breeze/sample.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/breeze/sample.ts lib/breeze/sample.test.ts
git commit -m "feat: stratified transcript sampling for insight mining"
```

---

### Task 3: Batch transcript fetch + keyword search

**Files:**
- Create: `lib/breeze/client.ts`
- Test: `lib/breeze/client.test.ts`

This reuses the existing `fetchLead` (`lib/leadFetcher.ts`) and `extractTranscription` (`lib/transcription.ts`). The test mocks `fetchLead` via `vi.mock`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/breeze/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../leadFetcher", () => ({
  fetchLead: vi.fn(),
}));

import { fetchLead } from "../leadFetcher";
import { fetchTranscriptsBatch, searchTranscripts, MAX_BATCH } from "./client";

const lead = (turns: Array<{ role: string; content: string }>) => ({
  ok: true as const,
  data: { metaData: { transcription: turns } },
});

describe("fetchTranscriptsBatch", () => {
  beforeEach(() => vi.mocked(fetchLead).mockReset());

  it("returns cleaned transcripts keyed by leadId", async () => {
    vi.mocked(fetchLead).mockResolvedValue(
      lead([{ role: "assistant", content: "hi" }, { role: "user", content: "hello" }])
    );
    const out = await fetchTranscriptsBatch(["1", "2"], "tok");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ leadId: "1", transcription: "assistant: hi\nuser: hello" });
  });

  it("collects per-id errors instead of throwing", async () => {
    vi.mocked(fetchLead).mockResolvedValue({ ok: false, message: "HTTP 500" });
    const out = await fetchTranscriptsBatch(["1"], "tok");
    expect(out[0]).toEqual({ leadId: "1", transcription: "", error: "HTTP 500" });
  });

  it("bounds the batch to MAX_BATCH ids", async () => {
    vi.mocked(fetchLead).mockResolvedValue(lead([{ role: "user", content: "x" }]));
    const ids = Array.from({ length: MAX_BATCH + 5 }, (_, i) => String(i));
    const out = await fetchTranscriptsBatch(ids, "tok");
    expect(out).toHaveLength(MAX_BATCH);
  });
});

describe("searchTranscripts", () => {
  beforeEach(() => vi.mocked(fetchLead).mockReset());

  it("returns only matches with a snippet, case-insensitive", async () => {
    vi.mocked(fetchLead)
      .mockResolvedValueOnce(lead([{ role: "user", content: "I want a REFUND please" }]))
      .mockResolvedValueOnce(lead([{ role: "user", content: "thanks" }]));
    const out = await searchTranscripts(["1", "2"], "refund", "tok");
    expect(out).toHaveLength(1);
    expect(out[0].leadId).toBe("1");
    expect(out[0].snippet.toLowerCase()).toContain("refund");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/breeze/client.test.ts`
Expected: FAIL — cannot find module `./client`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/breeze/client.ts
import pLimit from "p-limit";
import { fetchLead } from "../leadFetcher";
import { extractTranscription } from "../transcription";
import type { TranscriptResult } from "./types";

const CONCURRENCY = 5;
export const MAX_BATCH = 25;

/** Fetches several transcripts live, bounded + concurrency-limited, errors collected. */
export async function fetchTranscriptsBatch(
  ids: string[],
  token: string
): Promise<TranscriptResult[]> {
  const bounded = ids.slice(0, MAX_BATCH);
  const limit = pLimit(CONCURRENCY);
  return Promise.all(
    bounded.map((leadId) =>
      limit(async (): Promise<TranscriptResult> => {
        const res = await fetchLead(leadId, token);
        if (!res.ok) return { leadId, transcription: "", error: res.message };
        return { leadId, transcription: extractTranscription(res.data) };
      })
    )
  );
}

function snippetAround(text: string, q: string, pad = 60): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text.slice(0, pad * 2);
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + q.length + pad);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export type SearchHit = { leadId: string; snippet: string };

/** Fetches transcripts and returns only those containing keyword, with a snippet. */
export async function searchTranscripts(
  ids: string[],
  keyword: string,
  token: string
): Promise<SearchHit[]> {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  const batch = await fetchTranscriptsBatch(ids, token);
  return batch
    .filter((b) => !b.error && b.transcription.toLowerCase().includes(q))
    .map((b) => ({ leadId: b.leadId, snippet: snippetAround(b.transcription, q) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/breeze/client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/breeze/client.ts lib/breeze/client.test.ts
git commit -m "feat: batch transcript fetch + keyword search for MCP"
```

---

### Task 4: Failure-mode taxonomy + outcome stats proxy

**Files:**
- Create: `lib/breeze/taxonomy.ts`
- Modify: `lib/breeze/client.ts` (add `fetchOutcomeStats`)
- Test: `lib/breeze/taxonomy.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/breeze/taxonomy.test.ts
import { describe, it, expect } from "vitest";
import { failureModeTaxonomy } from "./taxonomy";

describe("failureModeTaxonomy", () => {
  it("exposes the evaluation parameter vocabulary", () => {
    const tax = failureModeTaxonomy();
    expect(tax.length).toBeGreaterThan(0);
    const values = tax.map((t) => t.value);
    expect(values).toContain("hallucination");
    expect(values).toContain("section_sequencing");
    expect(tax[0]).toHaveProperty("label");
    expect(tax[0]).toHaveProperty("group");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/breeze/taxonomy.test.ts`
Expected: FAIL — cannot find module `./taxonomy`.

- [ ] **Step 3: Write the taxonomy module**

```typescript
// lib/breeze/taxonomy.ts
import { PARAMETERS } from "../evaluation";

export type TaxonomyEntry = { value: string; label: string; group: string };

/** The existing evaluation vocabulary, so insight findings tag failure modes
 *  with known labels (hallucination, section_sequencing, …) not invented ones. */
export function failureModeTaxonomy(): TaxonomyEntry[] {
  return PARAMETERS.map((p) => ({ value: p.value, label: p.label, group: p.group }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/breeze/taxonomy.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `fetchOutcomeStats` to `lib/breeze/client.ts`**

Append to `lib/breeze/client.ts`:

```typescript
const ANALYTICS_URL =
  process.env.BREEZE_ANALYTICS_URL ??
  "https://clairvoyance.breezelabs.app/agent/voice/breeze-buddy/analytics";

/** Proxies the Breeze /analytics endpoint for quantitative grounding. */
export async function fetchOutcomeStats(
  type: string,
  filters: Record<string, unknown>,
  token: string
): Promise<unknown> {
  const res = await fetch(ANALYTICS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, filters, options: {} }),
  });
  if (!res.ok) throw new Error(`Analytics upstream ${res.status}`);
  return res.json();
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/breeze/taxonomy.ts lib/breeze/taxonomy.test.ts lib/breeze/client.ts
git commit -m "feat: failure-mode taxonomy + outcome stats proxy"
```

---

### Task 5: MCP tool logic functions

**Files:**
- Create: `lib/mcp/tools.ts`
- Test: `lib/mcp/tools.test.ts`

These wrap the `lib/breeze` functions into the tool surface used by both the MCP server and the app orchestrator. Pure orchestration over the (mockable) breeze layer.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/mcp/tools.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../breeze/client", () => ({
  fetchTranscriptsBatch: vi.fn(),
  searchTranscripts: vi.fn(),
  fetchOutcomeStats: vi.fn(),
}));

import {
  fetchTranscriptsBatch,
  searchTranscripts,
  fetchOutcomeStats,
} from "../breeze/client";
import { listCalls, sampleCalls, getTranscriptsBatch, search, outcomeStats } from "./tools";
import type { CallRef } from "../breeze/types";

const calls: CallRef[] = [
  { leadId: "1", callId: "c1", outcome: "RESOLVED", template: "t1", startTime: "" },
  { leadId: "2", callId: "c2", outcome: "TRANSFERRED", template: "t2", startTime: "" },
];

describe("mcp tool logic", () => {
  beforeEach(() => {
    vi.mocked(fetchTranscriptsBatch).mockReset();
    vi.mocked(searchTranscripts).mockReset();
    vi.mocked(fetchOutcomeStats).mockReset();
  });

  it("listCalls returns metadata only (no transcript field)", () => {
    const out = listCalls(calls);
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty("transcription");
    expect(out[0].outcome).toBe("RESOLVED");
  });

  it("sampleCalls delegates to stratified sampling", () => {
    const out = sampleCalls(calls, 1, "outcome");
    expect(out).toHaveLength(1);
  });

  it("getTranscriptsBatch delegates to the breeze client", async () => {
    vi.mocked(fetchTranscriptsBatch).mockResolvedValue([
      { leadId: "1", transcription: "assistant: hi" },
    ]);
    const out = await getTranscriptsBatch(["1"], "tok");
    expect(out[0].transcription).toBe("assistant: hi");
    expect(fetchTranscriptsBatch).toHaveBeenCalledWith(["1"], "tok");
  });

  it("search delegates to searchTranscripts", async () => {
    vi.mocked(searchTranscripts).mockResolvedValue([{ leadId: "1", snippet: "…refund…" }]);
    const out = await search(["1"], "refund", "tok");
    expect(out[0].leadId).toBe("1");
  });

  it("outcomeStats delegates to fetchOutcomeStats", async () => {
    vi.mocked(fetchOutcomeStats).mockResolvedValue({ total_calls: 10 });
    const out = await outcomeStats("performance", {}, "tok");
    expect(out).toEqual({ total_calls: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/mcp/tools.test.ts`
Expected: FAIL — cannot find module `./tools`.

- [ ] **Step 3: Write the tool logic**

```typescript
// lib/mcp/tools.ts
import {
  fetchTranscriptsBatch,
  searchTranscripts,
  fetchOutcomeStats,
  type SearchHit,
} from "../breeze/client";
import { stratifiedSample } from "../breeze/sample";
import type { CallRef, TranscriptResult } from "../breeze/types";

export function listCalls(calls: CallRef[]): CallRef[] {
  return calls.map(({ leadId, callId, outcome, template, startTime }) => ({
    leadId,
    callId,
    outcome,
    template,
    startTime,
  }));
}

export function sampleCalls(
  calls: CallRef[],
  n: number,
  stratifyBy: "outcome" | "template"
): CallRef[] {
  return stratifiedSample(calls, n, stratifyBy);
}

export function getTranscriptsBatch(
  ids: string[],
  token: string
): Promise<TranscriptResult[]> {
  return fetchTranscriptsBatch(ids, token);
}

export function search(
  ids: string[],
  keyword: string,
  token: string
): Promise<SearchHit[]> {
  return searchTranscripts(ids, keyword, token);
}

export function outcomeStats(
  type: string,
  filters: Record<string, unknown>,
  token: string
): Promise<unknown> {
  return fetchOutcomeStats(type, filters, token);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/mcp/tools.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/tools.ts lib/mcp/tools.test.ts
git commit -m "feat: MCP tool logic over the breeze layer"
```

---

### Task 6: MCP server wiring (Streamable HTTP + stdio)

**Files:**
- Create: `mcp/server.ts`
- Create: `mcp/tsconfig.json`
- Modify: `package.json` (scripts)

Thin wiring only — registers the Task 5 functions as MCP tools, the taxonomy as a resource, and the `mine_insights` prompt. The Breeze token comes from the `Authorization` header (HTTP) or `BREEZE_TOKEN` env (stdio). No unit test — verified by the smoke run in Step 5.

- [ ] **Step 1: Add a tsconfig for the server build target**

```jsonc
// mcp/tsconfig.json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true
  },
  "include": ["server.ts", "../lib/**/*.ts"]
}
```

- [ ] **Step 2: Write the server**

```typescript
// mcp/server.ts
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  listCalls,
  sampleCalls,
  getTranscriptsBatch,
  search,
  outcomeStats,
} from "../lib/mcp/tools.js";
import { failureModeTaxonomy } from "../lib/breeze/taxonomy.js";
import type { CallRef } from "../lib/breeze/types.js";

const callRefShape = {
  leadId: z.string(),
  callId: z.string(),
  outcome: z.string(),
  template: z.string(),
  startTime: z.string(),
};

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

/** Builds a fresh server instance. `token` is the Breeze bearer for this session. */
function buildServer(token: string): McpServer {
  const server = new McpServer({ name: "breeze-transcript-insights", version: "0.1.0" });

  server.registerTool(
    "list_calls",
    {
      description:
        "Index the provided call records (from the app's call_details CSV). Returns metadata only, no transcripts.",
      inputSchema: { calls: z.array(z.object(callRefShape)) },
    },
    async ({ calls }) => json(listCalls(calls as CallRef[]))
  );

  server.registerTool(
    "sample_transcripts",
    {
      description:
        "Stratified sample of up to n call records by outcome or template, so analysis stays representative.",
      inputSchema: {
        calls: z.array(z.object(callRefShape)),
        n: z.number().int().positive(),
        stratifyBy: z.enum(["outcome", "template"]),
      },
    },
    async ({ calls, n, stratifyBy }) =>
      json(sampleCalls(calls as CallRef[], n, stratifyBy))
  );

  server.registerTool(
    "get_transcripts_batch",
    {
      description:
        "Fetch cleaned transcripts live from Breeze for up to 25 lead IDs. Errors are returned per id, not thrown.",
      inputSchema: { ids: z.array(z.string()) },
    },
    async ({ ids }) => json(await getTranscriptsBatch(ids, token))
  );

  server.registerTool(
    "search_transcripts",
    {
      description: "Fetch the given lead IDs and return only those whose transcript contains keyword, with a snippet.",
      inputSchema: { ids: z.array(z.string()), keyword: z.string() },
    },
    async ({ ids, keyword }) => json(await search(ids, keyword, token))
  );

  server.registerTool(
    "get_outcome_stats",
    {
      description: "Quantitative outcome aggregates from the Breeze /analytics endpoint.",
      inputSchema: {
        type: z.string(),
        filters: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ type, filters }) => json(await outcomeStats(type, filters ?? {}, token))
  );

  server.registerResource(
    "failure-mode-taxonomy",
    "breeze://taxonomy/failure-modes",
    {
      title: "Failure-mode taxonomy",
      description: "Evaluation vocabulary for tagging transcript findings.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(failureModeTaxonomy()),
        },
      ],
    })
  );

  server.registerPrompt(
    "mine_insights",
    {
      title: "Mine transcript insights",
      description: "Map-reduce recipe to surface recurring failure modes and template fixes.",
      argsSchema: { focus: z.string().optional() },
    },
    ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Mine aggregate insights from call transcripts.\n" +
              "1. Call sample_transcripts to get a representative subset.\n" +
              "2. Fetch them with get_transcripts_batch in chunks.\n" +
              "3. For each chunk, note recurring problems, tagging each with a value from the failure-mode-taxonomy resource.\n" +
              "4. Cluster across chunks into the top recurring failure modes, each with frequency, an example, and a concrete template-improvement suggestion.\n" +
              (focus ? `Focus area: ${focus}\n` : ""),
          },
        },
      ],
    })
  );

  return server;
}

async function main() {
  if (process.argv.includes("--stdio")) {
    const token = process.env.BREEZE_TOKEN ?? "";
    const server = buildServer(token);
    await server.connect(new StdioServerTransport());
    return;
  }

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Stateless: a fresh server + transport per request, Breeze token from the header.
  app.post("/mcp", async (req: Request, res: Response) => {
    const auth = req.header("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const server = buildServer(token);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = Number(process.env.MCP_PORT ?? 8765);
  app.listen(port, () => {
    console.error(`breeze-transcript-insights MCP listening on :${port}/mcp`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Add run scripts to `package.json`**

In the `"scripts"` object of `package.json`, add:

```jsonc
"mcp:http": "tsx mcp/server.ts",
"mcp:stdio": "tsx mcp/server.ts --stdio"
```

Then install the runner:

```bash
npm install -D tsx
```

- [ ] **Step 4: Type-check the server**

Run: `npx tsc -p mcp/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Smoke-test the HTTP server (manual)**

```bash
npm run mcp:http &   # starts on :8765
sleep 2
curl -s -X POST http://localhost:8765/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer test' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
kill %1
```
Expected: a JSON-RPC result listing the five tools (`list_calls`, `sample_transcripts`, `get_transcripts_batch`, `search_transcripts`, `get_outcome_stats`).

- [ ] **Step 6: Commit**

```bash
git add mcp/server.ts mcp/tsconfig.json package.json package-lock.json
git commit -m "feat: MCP server wiring (streamable HTTP + stdio)"
```

---

### Task 7: Insights orchestrator (map-reduce)

**Files:**
- Create: `lib/insights/orchestrator.ts`
- Test: `lib/insights/orchestrator.test.ts`

The orchestrator reuses the Task 5 tool functions in-process and calls an injected Claude client (Sonnet per-chunk digest → Opus synthesis). The client is injected so tests run without network. Output is a structured `QualitativeInsight[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/orchestrator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../mcp/tools", () => ({
  sampleCalls: vi.fn(),
  getTranscriptsBatch: vi.fn(),
}));

import { sampleCalls, getTranscriptsBatch } from "../mcp/tools";
import { mineInsights, type ClaudeJson } from "./orchestrator";
import type { CallRef } from "../breeze/types";

const calls: CallRef[] = Array.from({ length: 4 }, (_, i) => ({
  leadId: String(i),
  callId: String(i),
  outcome: "RESOLVED",
  template: "t",
  startTime: "",
}));

describe("mineInsights", () => {
  beforeEach(() => {
    vi.mocked(sampleCalls).mockReset();
    vi.mocked(getTranscriptsBatch).mockReset();
  });

  it("samples, digests each chunk, then synthesizes insights", async () => {
    vi.mocked(sampleCalls).mockReturnValue(calls);
    vi.mocked(getTranscriptsBatch).mockResolvedValue(
      calls.map((c) => ({ leadId: c.leadId, transcription: "assistant: hi\nuser: refund" }))
    );

    // First N calls = digests (one per chunk); last call = synthesis.
    const claude: ClaudeJson = vi
      .fn()
      .mockResolvedValueOnce({ findings: [{ tag: "hallucination", note: "made up price" }] })
      .mockResolvedValueOnce({
        insights: [
          {
            tag: "hallucination",
            headline: "Bot invents prices",
            frequency: 3,
            example: "…",
            suggestion: "Add a price-lookup guard to the template.",
          },
        ],
      });

    const out = await mineInsights(
      { calls, token: "tok", sampleSize: 4, chunkSize: 4, stratifyBy: "outcome" },
      claude
    );

    expect(sampleCalls).toHaveBeenCalledWith(calls, 4, "outcome");
    expect(out).toHaveLength(1);
    expect(out[0].headline).toBe("Bot invents prices");
    expect(out[0].tag).toBe("hallucination");
  });

  it("returns empty when there are no calls", async () => {
    vi.mocked(sampleCalls).mockReturnValue([]);
    const claude: ClaudeJson = vi.fn();
    const out = await mineInsights(
      { calls: [], token: "tok", sampleSize: 4, chunkSize: 4, stratifyBy: "outcome" },
      claude
    );
    expect(out).toEqual([]);
    expect(claude).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/orchestrator.test.ts`
Expected: FAIL — cannot find module `./orchestrator`.

- [ ] **Step 3: Write the orchestrator**

```typescript
// lib/insights/orchestrator.ts
import { sampleCalls, getTranscriptsBatch } from "../mcp/tools";
import type { CallRef } from "../breeze/types";

export type QualitativeInsight = {
  tag: string;
  headline: string;
  frequency: number;
  example: string;
  suggestion: string;
};

/** Injected Claude call: takes (model, system, user) and returns parsed JSON. */
export type ClaudeJson = (
  model: string,
  system: string,
  user: string
) => Promise<unknown>;

export type MineOptions = {
  calls: CallRef[];
  token: string;
  sampleSize: number;
  chunkSize: number;
  stratifyBy: "outcome" | "template";
};

const MAP_MODEL = "claude-sonnet-4-6";
const REDUCE_MODEL = "claude-opus-4-8";

const DIGEST_SYSTEM =
  "You analyze AI voice-bot call transcripts. For the given transcripts, list recurring problems. " +
  "Reply ONLY with JSON: {\"findings\":[{\"tag\":string,\"note\":string}]}. " +
  "Each tag must be a failure-mode value (e.g. hallucination, section_sequencing).";

const SYNTH_SYSTEM =
  "You synthesize per-chunk findings about AI voice-bot calls into the top recurring failure modes. " +
  "Reply ONLY with JSON: {\"insights\":[{\"tag\":string,\"headline\":string,\"frequency\":number," +
  "\"example\":string,\"suggestion\":string}]}. Each suggestion is a concrete template improvement.";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function mineInsights(
  opts: MineOptions,
  claude: ClaudeJson
): Promise<QualitativeInsight[]> {
  const sample = sampleCalls(opts.calls, opts.sampleSize, opts.stratifyBy);
  if (sample.length === 0) return [];

  const allFindings: unknown[] = [];
  for (const group of chunk(sample, opts.chunkSize)) {
    const transcripts = await getTranscriptsBatch(
      group.map((c) => c.leadId),
      opts.token
    );
    const usable = transcripts.filter((t) => !t.error && t.transcription);
    if (usable.length === 0) continue;
    const user = usable
      .map((t) => `--- call ${t.leadId} ---\n${t.transcription}`)
      .join("\n\n");
    const digest = (await claude(MAP_MODEL, DIGEST_SYSTEM, user)) as {
      findings?: unknown[];
    };
    if (Array.isArray(digest?.findings)) allFindings.push(...digest.findings);
  }

  if (allFindings.length === 0) return [];

  const synth = (await claude(
    REDUCE_MODEL,
    SYNTH_SYSTEM,
    JSON.stringify(allFindings)
  )) as { insights?: QualitativeInsight[] };

  return Array.isArray(synth?.insights) ? synth.insights : [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/orchestrator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights/orchestrator.ts lib/insights/orchestrator.test.ts
git commit -m "feat: map-reduce insight orchestrator"
```

---

### Task 8: Claude client adapter

**Files:**
- Create: `lib/insights/claude.ts`
- Test: `lib/insights/claude.test.ts`

A concrete `ClaudeJson` backed by `@anthropic-ai/sdk`, with robust JSON extraction. The Anthropic client is injected for testing.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/claude.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeClaudeJson } from "./claude";

describe("makeClaudeJson", () => {
  it("calls messages.create with the model and parses JSON from the text block", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"findings":[{"tag":"hallucination","note":"x"}]}' }],
    });
    const claude = makeClaudeJson({ messages: { create } } as never);
    const out = (await claude("claude-sonnet-4-6", "sys", "user")) as {
      findings: unknown[];
    };
    expect(out.findings).toHaveLength(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-6", system: "sys" })
    );
  });

  it("throws a clear error when no JSON is present", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "no json here" }] });
    const claude = makeClaudeJson({ messages: { create } } as never);
    await expect(claude("m", "s", "u")).rejects.toThrow(/no JSON/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/claude.test.ts`
Expected: FAIL — cannot find module `./claude`.

- [ ] **Step 3: Write the adapter**

```typescript
// lib/insights/claude.ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ClaudeJson } from "./orchestrator";

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude returned no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

/** Wraps an Anthropic client into the orchestrator's ClaudeJson contract. */
export function makeClaudeJson(client: Anthropic): ClaudeJson {
  return async (model, system, user) => {
    const res = await client.messages.create({
      model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return extractJson(text);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/claude.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights/claude.ts lib/insights/claude.test.ts
git commit -m "feat: Anthropic-backed ClaudeJson adapter"
```

---

### Task 9: Insights API route

**Files:**
- Create: `app/api/insights/route.ts`

Thin Next.js route: validates input, builds the Anthropic client, runs `mineInsights`. No unit test (covered by orchestrator tests); verified by Step 2 type-check.

- [ ] **Step 1: Write the route**

```typescript
// app/api/insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { mineInsights } from "@/lib/insights/orchestrator";
import { makeClaudeJson } from "@/lib/insights/claude";
import type { CallRef } from "@/lib/breeze/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  calls?: CallRef[];
  sampleSize?: number;
  chunkSize?: number;
  stratifyBy?: "outcome" | "template";
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  if (!Array.isArray(body.calls) || body.calls.length === 0) {
    return NextResponse.json({ error: "calls must be a non-empty array" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const claude = makeClaudeJson(new Anthropic());
  try {
    const insights = await mineInsights(
      {
        calls: body.calls,
        token: body.token,
        sampleSize: body.sampleSize ?? 20,
        chunkSize: body.chunkSize ?? 10,
        stratifyBy: body.stratifyBy ?? "outcome",
      },
      claude
    );
    return NextResponse.json({ insights });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Type-check the project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/insights/route.ts
git commit -m "feat: /api/insights route running the map-reduce"
```

---

### Task 10: Render qualitative insights in the Insights tab

**Files:**
- Modify: `app/analytics/Insights.tsx`

Add a "Mine transcript insights" action that POSTs the current call set to `/api/insights` and renders the returned findings beneath the existing statistical insights. Read `app/analytics/Insights.tsx`, `app/analytics/store.ts`, and `app/analytics/hooks.ts` first to match how the current call set, the Breeze token, and existing insights are accessed; reuse those patterns rather than introducing new state.

- [ ] **Step 1: Add the qualitative-insights section**

Within `app/analytics/Insights.tsx`, add local state and a fetch handler, then render the results. Use the existing component's styling classes. Insert this block (adapt the call-set/token accessors to whatever the surrounding component already uses):

```tsx
// inside the Insights component
const [mined, setMined] = useState<
  Array<{ tag: string; headline: string; frequency: number; example: string; suggestion: string }>
>([]);
const [mining, setMining] = useState(false);
const [mineError, setMineError] = useState<string | null>(null);

async function runMining() {
  setMining(true);
  setMineError(null);
  try {
    // `calls` and `token` come from the existing store/hooks used in this file.
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, calls }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    setMined(data.insights ?? []);
  } catch (e) {
    setMineError(e instanceof Error ? e.message : String(e));
  } finally {
    setMining(false);
  }
}
```

```tsx
{/* render below the existing statistical insights list */}
<div className="mt-4">
  <button
    onClick={runMining}
    disabled={mining}
    className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
  >
    {mining ? "Mining transcripts…" : "Mine transcript insights"}
  </button>
  {mineError && <p className="mt-2 text-sm text-red-600">{mineError}</p>}
  <ul className="mt-3 space-y-2">
    {mined.map((m, i) => (
      <li key={i} className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">{m.headline}</span>
          <span className="text-xs uppercase tracking-wide opacity-70">
            {m.tag} · {m.frequency}×
          </span>
        </div>
        <p className="mt-1 text-sm opacity-80">{m.suggestion}</p>
      </li>
    ))}
  </ul>
</div>
```

Ensure `useState` is imported (`import { useState } from "react";`) if not already.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the Analytics → Insights view, upload/select a call set, click **Mine transcript insights**, and confirm findings render (requires `ANTHROPIC_API_KEY` and a valid Breeze token in the session).

- [ ] **Step 4: Commit**

```bash
git add app/analytics/Insights.tsx
git commit -m "feat: render mined transcript insights in the Insights tab"
```

---

### Task 11: Full test + type sweep

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests pass (existing + new: sample, client, taxonomy, tools, orchestrator, claude).

- [ ] **Step 2: Type-check everything**

Run: `npx tsc --noEmit && npx tsc -p mcp/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore: green test + type sweep for transcript insights MCP" || echo "nothing to commit"
```

---

## Notes for the implementer

- **Breeze token** is per-request everywhere (header for MCP HTTP, `BREEZE_TOKEN` env for stdio, request body for `/api/insights`) — never hard-code or log it.
- **Models:** map step `claude-sonnet-4-6`, reduce step `claude-opus-4-8`, adaptive thinking, `output_config`/effort left default. Don't add `temperature`/`budget_tokens` (they 400 on these models).
- **External MCP use (Claude Desktop / Claude API connector):** point the client at `http://<host>:8765/mcp` with `Authorization: Bearer <breeze-token>`; the app itself uses the tool functions in-process, so a public URL is only needed for external clients.
- **DRY:** `lib/breeze/*` is the single source of transcript fetching for both the MCP server and the app — don't duplicate fetch logic in `mcp/` or the route.
