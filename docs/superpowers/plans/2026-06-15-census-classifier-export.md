# Census Classifier + Workbook Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sampled qualitative miner with a full-census, per-call classifier that labels every in-scope call into a fixed taxonomy, aggregates exact counts in code, and exports a multi-sheet `.xlsx` matching the analyst's `Transferred_call_analysis_*.xlsx`.

**Architecture:** New units under `lib/insights/`: a config taxonomy, transcript helpers, a per-call classifier (Haiku structured outputs, injected for tests), a pure deterministic aggregator, and a workbook builder (`exceljs`). The route runs census fetch → classify → aggregate → JSON or `.xlsx`. The MCP server gains `classify_call`/`aggregate_breakdown` tools. The UI renders the breakdown table + a download button.

**Tech Stack:** TypeScript, `@anthropic-ai/sdk` (`claude-haiku-4-5`, structured outputs), `exceljs`, `p-limit`, Vitest. Aggregation is plain TS — no LLM.

**Spec:** `docs/superpowers/specs/2026-06-15-census-classifier-export-design.md`

**Conventions:** logic lives under `lib/` with **relative** imports (vitest has no `@/` alias, includes `lib/**/*.test.ts`). Run tests with `npm test`. The previous `lib/insights/orchestrator.ts` + `claude.ts` map-reduce path is retired in Task 12.

---

### Task 1: Shared census input type

**Files:**
- Create: `lib/insights/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// lib/insights/types.ts

/** One call to classify — richer than CallRef so Per_call can show phone/name. */
export type CallInput = {
  leadId: string;
  callId: string;
  phone: string;
  name: string;
  outcome: string;
  template: string;
  startTime: string;
};

/** A call after classification (or with an error if it could not be classified). */
export type CallLabel = {
  callId: string;
  phone: string;
  name: string;
  startTime: string;
  reasonCategory: string;
  reasonDetail: string;
  driverClaimedOnline: boolean;
  explicitHuman: boolean;
  lastUserTurn: string;
  snippet: string;
  nTurns: number;
  recordingUrl: string;
  error?: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/insights/types.ts
git commit -m "feat: census CallInput/CallLabel types"
```

---

### Task 2: Fixed reason taxonomy (seeded from the xlsx)

**Files:**
- Create: `lib/insights/reasonTaxonomy.ts`
- Test: `lib/insights/reasonTaxonomy.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/reasonTaxonomy.test.ts
import { describe, it, expect } from "vitest";
import { taxonomyFor, isValidLabel, UNCLASSIFIED } from "./reasonTaxonomy";

describe("reasonTaxonomy", () => {
  it("returns the driver-rides-block-support taxonomy with the seeded categories", () => {
    const tax = taxonomyFor("driver-rides-block-support");
    const cats = tax.map((c) => c.category);
    expect(cats).toContain("TEST_RIDE_VERIFY_FAILED");
    expect(cats).toContain("OUT_OF_SCOPE");
    expect(cats).toContain("TECH_ERROR");
    const testRide = tax.find((c) => c.category === "TEST_RIDE_VERIFY_FAILED")!;
    expect(testRide.details).toContain("Test-ride failed: notification not received");
  });

  it("falls back to the default taxonomy for an unknown template", () => {
    expect(taxonomyFor("unknown-template").length).toBeGreaterThan(0);
  });

  it("validates a (category, detail) pairing", () => {
    const tax = taxonomyFor("driver-rides-block-support");
    expect(isValidLabel(tax, "OUT_OF_SCOPE", "Out-of-scope query")).toBe(true);
    expect(isValidLabel(tax, "OUT_OF_SCOPE", "Test-ride failed: driver offline")).toBe(false);
    expect(isValidLabel(tax, "NOT_A_CATEGORY", "x")).toBe(false);
  });

  it("exposes an UNCLASSIFIED bucket for fetch/classify failures", () => {
    expect(UNCLASSIFIED.category).toBe("UNCLASSIFIED");
    expect(typeof UNCLASSIFIED.detail).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/reasonTaxonomy.test.ts`
Expected: FAIL — cannot find module `./reasonTaxonomy`.

- [ ] **Step 3: Write the taxonomy**

```typescript
// lib/insights/reasonTaxonomy.ts

export type ReasonCategory = { category: string; details: string[] };
export type Taxonomy = ReasonCategory[];

/** Used when a transcript cannot be fetched or classified. */
export const UNCLASSIFIED = {
  category: "UNCLASSIFIED",
  detail: "Could not classify",
};

// Seeded verbatim from Transferred_call_analysis_2026-06-11.xlsx.
const DRIVER_RIDES_BLOCK_SUPPORT: Taxonomy = [
  {
    category: "TEST_RIDE_VERIFY_FAILED",
    details: [
      "Test-ride failed: notification not received",
      "Test-ride failed: GPS/location off",
      "Test-ride failed: driver offline",
      "Test-ride failed: driver on ride",
    ],
  },
  { category: "OUT_OF_SCOPE", details: ["Out-of-scope query"] },
  { category: "RIDES_UNRESOLVED", details: ["Rides still not coming after troubleshooting"] },
  { category: "TECH_ERROR", details: ["Technical / API error"] },
  { category: "OTHER_ESCALATION", details: ["Other / early human demand"] },
  { category: "BLOCK_UNBLOCK", details: ["Account block / unblock request"] },
];

const BY_TEMPLATE: Record<string, Taxonomy> = {
  "driver-rides-block-support": DRIVER_RIDES_BLOCK_SUPPORT,
};

const DEFAULT_TAXONOMY: Taxonomy = DRIVER_RIDES_BLOCK_SUPPORT;

export function taxonomyFor(template: string): Taxonomy {
  return BY_TEMPLATE[template] ?? DEFAULT_TAXONOMY;
}

export function isValidLabel(tax: Taxonomy, category: string, detail: string): boolean {
  const c = tax.find((x) => x.category === category);
  return !!c && c.details.includes(detail);
}

/** Flat list of every allowed detail across categories (for the classifier enum). */
export function flatDetails(tax: Taxonomy): string[] {
  return tax.flatMap((c) => c.details);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/reasonTaxonomy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights/reasonTaxonomy.ts lib/insights/reasonTaxonomy.test.ts
git commit -m "feat: fixed reason taxonomy seeded from the xlsx"
```

---

### Task 3: Transcript helpers (turn count + last user turn)

**Files:**
- Create: `lib/insights/transcript.ts`
- Test: `lib/insights/transcript.test.ts`

`extractTranscription` joins turns as `"role: content"` lines. These helpers parse that.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/transcript.test.ts
import { describe, it, expect } from "vitest";
import { countTurns, lastUserTurn } from "./transcript";

const t = "assistant: hello\nuser: ನಮಸ್ಕಾರ\nassistant: how can I help\nuser: refund please";

describe("transcript helpers", () => {
  it("countTurns counts non-empty role lines", () => {
    expect(countTurns(t)).toBe(4);
    expect(countTurns("")).toBe(0);
  });

  it("lastUserTurn returns the last user line content verbatim", () => {
    expect(lastUserTurn(t)).toBe("refund please");
    expect(lastUserTurn("assistant: hi")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/transcript.test.ts`
Expected: FAIL — cannot find module `./transcript`.

- [ ] **Step 3: Write the helpers**

```typescript
// lib/insights/transcript.ts

const LINE = /^(\w+):\s?(.*)$/;

export function countTurns(transcription: string): number {
  if (!transcription.trim()) return 0;
  return transcription.split("\n").filter((l) => LINE.test(l.trim())).length;
}

export function lastUserTurn(transcription: string): string {
  const lines = transcription.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].trim().match(LINE);
    if (m && m[1] === "user") return m[2];
  }
  return "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/transcript.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights/transcript.ts lib/insights/transcript.test.ts
git commit -m "feat: transcript turn-count + last-user-turn helpers"
```

---

### Task 4: Lead-details batch fetch (transcript + recording URL)

**Files:**
- Modify: `lib/breeze/client.ts`
- Test: `lib/breeze/leadDetails.test.ts`

Per_call needs `recording_url`; the existing batch returns only the transcript. Add a richer batch fetch reusing `fetchLead` + the existing extractors.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/breeze/leadDetails.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../leadFetcher", () => ({ fetchLead: vi.fn() }));

import { fetchLead } from "../leadFetcher";
import { fetchLeadDetailsBatch } from "./client";

describe("fetchLeadDetailsBatch", () => {
  beforeEach(() => vi.mocked(fetchLead).mockReset());

  it("returns transcript + recordingUrl per id", async () => {
    vi.mocked(fetchLead).mockResolvedValue({
      ok: true,
      data: {
        recording_url: "https://rec/1.mp3",
        metaData: { transcription: [{ role: "user", content: "hi" }] },
      },
    });
    const out = await fetchLeadDetailsBatch(["1"], "tok");
    expect(out[0]).toEqual({
      leadId: "1",
      transcription: "user: hi",
      recordingUrl: "https://rec/1.mp3",
    });
  });

  it("captures errors per id", async () => {
    vi.mocked(fetchLead).mockResolvedValue({ ok: false, message: "HTTP 404" });
    const out = await fetchLeadDetailsBatch(["1"], "tok");
    expect(out[0]).toEqual({
      leadId: "1",
      transcription: "",
      recordingUrl: "",
      error: "HTTP 404",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/breeze/leadDetails.test.ts`
Expected: FAIL — `fetchLeadDetailsBatch` is not exported.

- [ ] **Step 3: Add `fetchLeadDetailsBatch` to `lib/breeze/client.ts`**

Add these imports at the top if missing, then append the function:

`extractRecordingUrl` already lives in `lib/transcription.ts` (used by `app/api/transcriptions/route.ts`). Extend the existing `import { extractTranscription } from "../transcription";` line in `lib/breeze/client.ts` to also import it:

```typescript
// lib/breeze/client.ts — widen the existing transcription import
import { extractTranscription, extractRecordingUrl } from "../transcription";
```

Append:

```typescript
export type LeadDetails = {
  leadId: string;
  transcription: string;
  recordingUrl: string;
  error?: string;
};

/** Like fetchTranscriptsBatch but also returns the recording URL (for Per_call). */
export async function fetchLeadDetailsBatch(
  ids: string[],
  token: string
): Promise<LeadDetails[]> {
  const limit = pLimit(CONCURRENCY);
  return Promise.all(
    ids.map((leadId) =>
      limit(async (): Promise<LeadDetails> => {
        const res = await fetchLead(leadId, token);
        if (!res.ok) {
          return { leadId, transcription: "", recordingUrl: "", error: res.message };
        }
        return {
          leadId,
          transcription: extractTranscription(res.data),
          recordingUrl: extractRecordingUrl(res.data),
        };
      })
    )
  );
}
```

Note: this batch is **not** capped at `MAX_BATCH` — the census loops the whole population; the route bounds concurrency via `CONCURRENCY`.

Verify `extractRecordingUrl` is exported from `lib/transcription.ts` (it is — used by `app/api/transcriptions/route.ts`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/breeze/leadDetails.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/breeze/client.ts lib/breeze/leadDetails.test.ts
git commit -m "feat: lead-details batch fetch (transcript + recording url)"
```

---

### Task 5: Per-call classifier

**Files:**
- Create: `lib/insights/classify.ts`
- Test: `lib/insights/classify.test.ts`

`classifyCall` takes an **injected** `ClassifyFn` so tests need no network. It derives `nTurns`/`lastUserTurn` in code, coerces out-of-taxonomy labels to UNCLASSIFIED's nearest valid bucket, and never throws.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/classify.test.ts
import { describe, it, expect, vi } from "vitest";
import { classifyCall, type ClassifyFn } from "./classify";
import { taxonomyFor } from "./reasonTaxonomy";
import type { CallInput, LeadDetails } from "./classify";

const tax = taxonomyFor("driver-rides-block-support");
const input: CallInput = {
  leadId: "1", callId: "c1", phone: "9991", name: "RAJU",
  outcome: "TRANSFERRED", template: "driver-rides-block-support", startTime: "2026-06-11",
};
const details: LeadDetails = {
  leadId: "1",
  transcription: "assistant: hi\nuser: notification ಬರ್ತಾ ಇಲ್ಲ",
  recordingUrl: "https://rec/1.mp3",
};

describe("classifyCall", () => {
  it("maps a valid raw label and derives nTurns/lastUserTurn in code", async () => {
    const fn: ClassifyFn = vi.fn().mockResolvedValue({
      reasonCategory: "TEST_RIDE_VERIFY_FAILED",
      reasonDetail: "Test-ride failed: notification not received",
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "notification ಬರ್ತಾ ಇಲ್ಲ",
    });
    const out = await classifyCall(input, details, tax, fn);
    expect(out.reasonCategory).toBe("TEST_RIDE_VERIFY_FAILED");
    expect(out.nTurns).toBe(2);
    expect(out.lastUserTurn).toBe("notification ಬರ್ತಾ ಇಲ್ಲ");
    expect(out.recordingUrl).toBe("https://rec/1.mp3");
    expect(out.error).toBeUndefined();
  });

  it("coerces an out-of-taxonomy label to UNCLASSIFIED", async () => {
    const fn: ClassifyFn = vi.fn().mockResolvedValue({
      reasonCategory: "MADE_UP",
      reasonDetail: "nonsense",
      driverClaimedOnline: false,
      explicitHuman: true,
      snippet: "x",
    });
    const out = await classifyCall(input, details, tax, fn);
    expect(out.reasonCategory).toBe("UNCLASSIFIED");
    expect(out.explicitHuman).toBe(true);
  });

  it("marks an errored fetch as UNCLASSIFIED with the error", async () => {
    const fn: ClassifyFn = vi.fn();
    const out = await classifyCall(
      input,
      { leadId: "1", transcription: "", recordingUrl: "", error: "HTTP 404" },
      tax,
      fn
    );
    expect(out.error).toBe("HTTP 404");
    expect(out.reasonCategory).toBe("UNCLASSIFIED");
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/classify.test.ts`
Expected: FAIL — cannot find module `./classify`.

- [ ] **Step 3: Write the classifier**

```typescript
// lib/insights/classify.ts
import { countTurns, lastUserTurn } from "./transcript";
import { isValidLabel, UNCLASSIFIED, type Taxonomy } from "./reasonTaxonomy";
import type { CallInput, CallLabel } from "./types";
import type { LeadDetails } from "../breeze/client";

export type { CallInput } from "./types";
export type { LeadDetails } from "../breeze/client";

/** The raw label the LLM returns (before code-side reconciliation). */
export type RawLabel = {
  reasonCategory: string;
  reasonDetail: string;
  driverClaimedOnline: boolean;
  explicitHuman: boolean;
  snippet: string;
};

/** Injected classifier: given a transcript + taxonomy, returns a raw label. */
export type ClassifyFn = (transcript: string, tax: Taxonomy) => Promise<RawLabel>;

export async function classifyCall(
  input: CallInput,
  details: LeadDetails,
  tax: Taxonomy,
  classify: ClassifyFn
): Promise<CallLabel> {
  const base = {
    callId: input.callId,
    phone: input.phone,
    name: input.name,
    startTime: input.startTime,
    nTurns: countTurns(details.transcription),
    lastUserTurn: lastUserTurn(details.transcription),
    recordingUrl: details.recordingUrl,
  };

  if (details.error || !details.transcription.trim()) {
    return {
      ...base,
      reasonCategory: UNCLASSIFIED.category,
      reasonDetail: UNCLASSIFIED.detail,
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "",
      error: details.error ?? "empty transcript",
    };
  }

  try {
    const raw = await classify(details.transcription, tax);
    const valid = isValidLabel(tax, raw.reasonCategory, raw.reasonDetail);
    return {
      ...base,
      reasonCategory: valid ? raw.reasonCategory : UNCLASSIFIED.category,
      reasonDetail: valid ? raw.reasonDetail : UNCLASSIFIED.detail,
      driverClaimedOnline: Boolean(raw.driverClaimedOnline),
      explicitHuman: Boolean(raw.explicitHuman),
      snippet: raw.snippet ?? "",
    };
  } catch (e) {
    return {
      ...base,
      reasonCategory: UNCLASSIFIED.category,
      reasonDetail: UNCLASSIFIED.detail,
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/classify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights/classify.ts lib/insights/classify.test.ts
git commit -m "feat: per-call classifier with taxonomy coercion"
```

---

### Task 6: Concrete Haiku classifier (structured outputs)

**Files:**
- Create: `lib/insights/haikuClassifier.ts`

Thin adapter — no unit test (the injected `ClassifyFn` is tested in Task 5). Verified by `tsc` in Task 11.

- [ ] **Step 1: Write the adapter**

```typescript
// lib/insights/haikuClassifier.ts
import type Anthropic from "@anthropic-ai/sdk";
import { flatDetails, type Taxonomy } from "./reasonTaxonomy";
import type { ClassifyFn, RawLabel } from "./classify";

const SYSTEM =
  "You classify a single AI voice-bot call transcript into the reason it was transferred " +
  "to a human. Use ONLY the provided category and detail values. Also judge whether the " +
  "driver claimed to be online, and whether they explicitly demanded a human at any point. " +
  "Pick the verbatim snippet (may be Kannada) that best evidences the reason.";

export function makeHaikuClassifier(client: Anthropic): ClassifyFn {
  return async (transcript, tax: Taxonomy): Promise<RawLabel> => {
    const categories = tax.map((c) => c.category);
    const details = flatDetails(tax);
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Categories: ${JSON.stringify(categories)}\n` +
            `Details: ${JSON.stringify(details)}\n\n` +
            `Transcript:\n${transcript}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          name: "call_label",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              reasonCategory: { type: "string", enum: categories },
              reasonDetail: { type: "string", enum: details },
              driverClaimedOnline: { type: "boolean" },
              explicitHuman: { type: "boolean" },
              snippet: { type: "string" },
            },
            required: [
              "reasonCategory",
              "reasonDetail",
              "driverClaimedOnline",
              "explicitHuman",
              "snippet",
            ],
          },
        },
      },
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return JSON.parse(text) as RawLabel;
  };
}
```

> If `output_config` is not yet typed in the installed SDK, cast the request object `as never` at the `create(...)` call and leave a `// structured outputs` comment; the wire API accepts it. Verify against the SDK version in Task 11 and adjust.

- [ ] **Step 2: Commit**

```bash
git add lib/insights/haikuClassifier.ts
git commit -m "feat: Haiku structured-output classifier adapter"
```

---

### Task 7: Deterministic aggregation

**Files:**
- Create: `lib/insights/aggregate.ts`
- Test: `lib/insights/aggregate.test.ts`

Pure functions over `CallLabel[]`. No LLM.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/aggregate.test.ts
import { describe, it, expect } from "vitest";
import { reasonBreakdown, summary, qaSubset } from "./aggregate";
import type { CallLabel } from "./types";

function label(p: Partial<CallLabel>): CallLabel {
  return {
    callId: "c", phone: "", name: "", startTime: "",
    reasonCategory: "OUT_OF_SCOPE", reasonDetail: "Out-of-scope query",
    driverClaimedOnline: false, explicitHuman: false,
    lastUserTurn: "", snippet: "", nTurns: 1, recordingUrl: "",
    ...p,
  };
}

const labels: CallLabel[] = [
  label({ callId: "1", reasonCategory: "TEST_RIDE_VERIFY_FAILED", reasonDetail: "Test-ride failed: notification not received" }),
  label({ callId: "2", reasonCategory: "TEST_RIDE_VERIFY_FAILED", reasonDetail: "Test-ride failed: notification not received" }),
  label({ callId: "3", reasonCategory: "OUT_OF_SCOPE", reasonDetail: "Out-of-scope query", explicitHuman: true }),
  label({ callId: "4", reasonCategory: "UNCLASSIFIED", reasonDetail: "Could not classify", error: "HTTP 404" }),
];

describe("reasonBreakdown", () => {
  it("counts each (category, detail) with exact % of total, sorted desc", () => {
    const rows = reasonBreakdown(labels);
    expect(rows[0]).toEqual({
      category: "TEST_RIDE_VERIFY_FAILED",
      detail: "Test-ride failed: notification not received",
      calls: 2,
      pct: 50,
    });
    // UNCLASSIFIED is included so totals reconcile to the full population.
    const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
    expect(totalCalls).toBe(4);
    const pctSum = rows.reduce((s, r) => s + r.pct, 0);
    expect(Math.round(pctSum)).toBe(100);
  });
});

describe("summary", () => {
  it("reports totals, biggest category, and explicit-human count", () => {
    const s = summary(labels, { reportDate: "2026-06-11", template: "driver-rides-block-support" });
    expect(s.totalCalls).toBe(4);
    expect(s.biggestCategory.category).toBe("TEST_RIDE_VERIFY_FAILED");
    expect(s.biggestCategory.calls).toBe(2);
    expect(s.explicitHuman).toBe(1);
    expect(s.unclassified).toBe(1);
  });
});

describe("qaSubset", () => {
  it("filters labels by predicate", () => {
    const qa = qaSubset(labels, (l) => l.reasonDetail.includes("notification not received"));
    expect(qa).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/aggregate.test.ts`
Expected: FAIL — cannot find module `./aggregate`.

- [ ] **Step 3: Write the aggregator**

```typescript
// lib/insights/aggregate.ts
import type { CallLabel } from "./types";

export type BreakdownRow = {
  category: string;
  detail: string;
  calls: number;
  pct: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function reasonBreakdown(labels: CallLabel[]): BreakdownRow[] {
  const total = labels.length || 1;
  const counts = new Map<string, BreakdownRow>();
  for (const l of labels) {
    const key = `${l.reasonCategory}||${l.reasonDetail}`;
    const row = counts.get(key) ?? {
      category: l.reasonCategory,
      detail: l.reasonDetail,
      calls: 0,
      pct: 0,
    };
    row.calls += 1;
    counts.set(key, row);
  }
  const rows = [...counts.values()];
  for (const r of rows) r.pct = round1((r.calls / total) * 100);
  rows.sort((a, b) => b.calls - a.calls || a.category.localeCompare(b.category));
  return rows;
}

export type Summary = {
  reportDate: string;
  template: string;
  totalCalls: number;
  biggestCategory: { category: string; calls: number; pct: number };
  explicitHuman: number;
  unclassified: number;
};

export function summary(
  labels: CallLabel[],
  opts: { reportDate: string; template: string }
): Summary {
  const total = labels.length;
  const byCat = new Map<string, number>();
  for (const l of labels) byCat.set(l.reasonCategory, (byCat.get(l.reasonCategory) ?? 0) + 1);
  let biggest = { category: "—", calls: 0, pct: 0 };
  for (const [category, calls] of byCat) {
    if (calls > biggest.calls) {
      biggest = { category, calls, pct: round1((calls / (total || 1)) * 100) };
    }
  }
  return {
    reportDate: opts.reportDate,
    template: opts.template,
    totalCalls: total,
    biggestCategory: biggest,
    explicitHuman: labels.filter((l) => l.explicitHuman).length,
    unclassified: labels.filter((l) => l.reasonCategory === "UNCLASSIFIED").length,
  };
}

export function qaSubset(
  labels: CallLabel[],
  predicate: (l: CallLabel) => boolean
): CallLabel[] {
  return labels.filter(predicate);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/aggregate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/insights/aggregate.ts lib/insights/aggregate.test.ts
git commit -m "feat: deterministic reason aggregation (breakdown, summary, qa)"
```

---

### Task 8: Workbook builder (xlsx + csv)

**Files:**
- Create: `lib/insights/workbook.ts`
- Test: `lib/insights/workbook.test.ts`
- Modify: `package.json` (add `exceljs`)

- [ ] **Step 1: Install exceljs**

```bash
npm install exceljs
```

- [ ] **Step 2: Write the failing test**

```typescript
// lib/insights/workbook.test.ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook } from "./workbook";
import type { CallLabel } from "./types";

const labels: CallLabel[] = [
  {
    callId: "1", phone: "9991", name: "RAJU", startTime: "2026-06-11",
    reasonCategory: "OUT_OF_SCOPE", reasonDetail: "Out-of-scope query",
    driverClaimedOnline: false, explicitHuman: true,
    lastUserTurn: "x", snippet: "y", nTurns: 3, recordingUrl: "https://rec/1.mp3",
  },
];

describe("buildWorkbook", () => {
  it("produces a buffer with the expected sheets and Per_call rows", async () => {
    const buf = await buildWorkbook(labels, {
      reportDate: "2026-06-11",
      template: "driver-rides-block-support",
    });
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(
      expect.arrayContaining(["Summary", "Reason_breakdown", "Per_call"])
    );
    const perCall = wb.getWorksheet("Per_call")!;
    // header row + 1 data row
    expect(perCall.rowCount).toBe(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/insights/workbook.test.ts`
Expected: FAIL — cannot find module `./workbook`.

- [ ] **Step 4: Write the workbook builder**

```typescript
// lib/insights/workbook.ts
import ExcelJS from "exceljs";
import type { CallLabel } from "./types";
import { reasonBreakdown, summary } from "./aggregate";

export async function buildWorkbook(
  labels: CallLabel[],
  opts: { reportDate: string; template: string }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const s = summary(labels, opts);
  const sum = wb.addWorksheet("Summary");
  sum.addRow(["Metric", "Value"]);
  sum.addRow(["Report date", s.reportDate]);
  sum.addRow(["Template", s.template]);
  sum.addRow(["Total calls", s.totalCalls]);
  sum.addRow([
    "Biggest reason category",
    `${s.biggestCategory.category} (${s.biggestCategory.calls}, ${s.biggestCategory.pct}%)`,
  ]);
  sum.addRow(["Explicit human demand (any point)", s.explicitHuman]);
  sum.addRow(["Unclassified", s.unclassified]);

  const br = wb.addWorksheet("Reason_breakdown");
  br.addRow(["Category", "Reason", "calls", "% of total"]);
  for (const r of reasonBreakdown(labels)) {
    br.addRow([r.category, r.detail, r.calls, r.pct]);
  }

  const pc = wb.addWorksheet("Per_call");
  pc.addRow([
    "call_id", "phone", "name", "reason_category", "reason_detail",
    "driver_claimed_online", "explicit_human", "n_turns", "last_user_turn",
    "start_time", "recording_url", "error",
  ]);
  for (const l of labels) {
    pc.addRow([
      l.callId, l.phone, l.name, l.reasonCategory, l.reasonDetail,
      l.driverClaimedOnline, l.explicitHuman, l.nTurns, l.lastUserTurn,
      l.startTime, l.recordingUrl, l.error ?? "",
    ]);
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/insights/workbook.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/insights/workbook.ts lib/insights/workbook.test.ts package.json package-lock.json
git commit -m "feat: xlsx workbook builder (Summary/Reason_breakdown/Per_call)"
```

---

### Task 9: Census orchestration

**Files:**
- Create: `lib/insights/census.ts`
- Test: `lib/insights/census.test.ts`

Ties fetch → classify together over the whole population, concurrency-bounded. The fetch and classify functions are injected for testability.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/insights/census.test.ts
import { describe, it, expect, vi } from "vitest";
import { runCensus } from "./census";
import type { CallInput } from "./types";
import type { LeadDetails } from "../breeze/client";

const inputs: CallInput[] = [
  { leadId: "1", callId: "c1", phone: "9991", name: "A", outcome: "TRANSFERRED", template: "driver-rides-block-support", startTime: "" },
  { leadId: "2", callId: "c2", phone: "9992", name: "B", outcome: "TRANSFERRED", template: "driver-rides-block-support", startTime: "" },
];

describe("runCensus", () => {
  it("fetches all, classifies each, returns one label per call", async () => {
    const fetchBatch = vi.fn(async (ids: string[]): Promise<LeadDetails[]> =>
      ids.map((leadId) => ({ leadId, transcription: "user: hi", recordingUrl: "" }))
    );
    const classify = vi.fn().mockResolvedValue({
      reasonCategory: "OUT_OF_SCOPE",
      reasonDetail: "Out-of-scope query",
      driverClaimedOnline: false,
      explicitHuman: false,
      snippet: "hi",
    });

    const labels = await runCensus(inputs, "tok", { fetchBatch, classify });
    expect(labels).toHaveLength(2);
    expect(labels[0].reasonCategory).toBe("OUT_OF_SCOPE");
    expect(fetchBatch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/insights/census.test.ts`
Expected: FAIL — cannot find module `./census`.

- [ ] **Step 3: Write the census orchestrator**

```typescript
// lib/insights/census.ts
import pLimit from "p-limit";
import { classifyCall, type ClassifyFn } from "./classify";
import { taxonomyFor } from "./reasonTaxonomy";
import type { CallInput, CallLabel } from "./types";
import type { LeadDetails } from "../breeze/client";

const CLASSIFY_CONCURRENCY = 8;
const FETCH_CHUNK = 25;

export type CensusDeps = {
  fetchBatch: (ids: string[], token: string) => Promise<LeadDetails[]>;
  classify: ClassifyFn;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runCensus(
  inputs: CallInput[],
  token: string,
  deps: CensusDeps
): Promise<CallLabel[]> {
  // 1. Fetch transcripts for the whole population, in chunks.
  const detailsById = new Map<string, LeadDetails>();
  for (const group of chunk(inputs, FETCH_CHUNK)) {
    const batch = await deps.fetchBatch(group.map((i) => i.leadId), token);
    for (const d of batch) detailsById.set(d.leadId, d);
  }

  // 2. Classify each call, concurrency-bounded.
  const limit = pLimit(CLASSIFY_CONCURRENCY);
  return Promise.all(
    inputs.map((input) =>
      limit(() => {
        const details =
          detailsById.get(input.leadId) ??
          { leadId: input.leadId, transcription: "", recordingUrl: "", error: "no transcript" };
        return classifyCall(input, details, taxonomyFor(input.template), deps.classify);
      })
    )
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/insights/census.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/insights/census.ts lib/insights/census.test.ts
git commit -m "feat: census orchestration (fetch-all + classify-each)"
```

---

### Task 10: Rewrite the API route (JSON + xlsx)

**Files:**
- Modify: `app/api/insights/route.ts` (full rewrite)

Thin route. Verified by `tsc` in Task 11 and manual run in Task 13.

- [ ] **Step 1: Rewrite the route**

```typescript
// app/api/insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchLeadDetailsBatch } from "@/lib/breeze/client";
import { runCensus } from "@/lib/insights/census";
import { makeHaikuClassifier } from "@/lib/insights/haikuClassifier";
import { reasonBreakdown, summary } from "@/lib/insights/aggregate";
import { buildWorkbook } from "@/lib/insights/workbook";
import type { CallInput } from "@/lib/insights/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  calls?: CallInput[];
  reportDate?: string;
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

  const classify = makeHaikuClassifier(new Anthropic());
  const reportDate = body.reportDate ?? new Date().toISOString().slice(0, 10);
  const template = body.calls[0].template || "driver-rides-block-support";

  try {
    const labels = await runCensus(body.calls, body.token, {
      fetchBatch: fetchLeadDetailsBatch,
      classify,
    });

    if (new URL(req.url).searchParams.get("format") === "xlsx") {
      const buf = await buildWorkbook(labels, { reportDate, template });
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="call_analysis_${reportDate}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      summary: summary(labels, { reportDate, template }),
      breakdown: reasonBreakdown(labels),
      perCall: labels,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/insights/route.ts
git commit -m "feat: census route returning breakdown JSON or xlsx download"
```

---

### Task 11: Type-check the project + MCP

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `output_config` errors in `haikuClassifier.ts`, apply the `as never` cast noted in Task 6 Step 1, then re-run.

- [ ] **Step 2: Type-check the MCP target**

Run: `npx tsc -p mcp/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore: type-check fixups for census classifier" || echo "nothing to commit"
```

---

### Task 12: Add MCP tools + retire the old map-reduce

**Files:**
- Modify: `mcp/server.ts` (add `classify_call`, `aggregate_breakdown`)
- Delete: `lib/insights/orchestrator.ts`, `lib/insights/orchestrator.test.ts`, `lib/insights/claude.ts`, `lib/insights/claude.test.ts`

- [ ] **Step 1: Delete the retired map-reduce path**

```bash
git rm lib/insights/orchestrator.ts lib/insights/orchestrator.test.ts \
       lib/insights/claude.ts lib/insights/claude.test.ts
```

- [ ] **Step 2: Add the two tools to `mcp/server.ts`**

Add imports near the other tool imports:

```typescript
import { taxonomyFor } from "../lib/insights/reasonTaxonomy.js";
import { classifyCall } from "../lib/insights/classify.js";
import { makeHaikuClassifier } from "../lib/insights/haikuClassifier.js";
import { reasonBreakdown } from "../lib/insights/aggregate.js";
import Anthropic from "@anthropic-ai/sdk";
import type { CallLabel } from "../lib/insights/types.js";
```

Inside `buildServer`, before `return server;`, register:

```typescript
  server.registerTool(
    "classify_call",
    {
      description:
        "Classify one transcript into the fixed reason taxonomy for its template. " +
        "Returns reason_category, reason_detail, driverClaimedOnline, explicitHuman.",
      inputSchema: {
        template: z.string(),
        transcription: z.string(),
        callId: z.string(),
        phone: z.string().optional(),
        name: z.string().optional(),
        startTime: z.string().optional(),
      },
    },
    async ({ template, transcription, callId, phone, name, startTime }) => {
      const classify = makeHaikuClassifier(new Anthropic());
      const label = await classifyCall(
        {
          leadId: callId,
          callId,
          phone: phone ?? "",
          name: name ?? "",
          outcome: "",
          template,
          startTime: startTime ?? "",
        },
        { leadId: callId, transcription, recordingUrl: "" },
        taxonomyFor(template),
        classify
      );
      return json(label);
    }
  );

  server.registerTool(
    "aggregate_breakdown",
    {
      description:
        "Aggregate an array of classified call labels into exact reason-breakdown counts and %.",
      inputSchema: { labels: z.array(z.any()) },
    },
    async ({ labels }) => json(reasonBreakdown(labels as CallLabel[]))
  );
```

> `makeHaikuClassifier` needs `ANTHROPIC_API_KEY` in the MCP server's environment for `classify_call` to work. Document this in the run note (Task 13).

- [ ] **Step 3: Type-check MCP**

Run: `npx tsc -p mcp/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Run the full suite (old map-reduce tests gone)**

Run: `npm test`
Expected: all pass; no references to the deleted `orchestrator`/`claude` modules remain.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: classify_call + aggregate_breakdown MCP tools; retire map-reduce"
```

---

### Task 13: Rewrite the UI (breakdown table + xlsx download)

**Files:**
- Modify: `app/InsightsMiner.tsx` (full rewrite)
- Modify: `app/page.tsx` (pass phone/name into the call records)

- [ ] **Step 1: Pass phone/name from the CSV rows in `app/page.tsx`**

The current mount maps `filtered` to `InsightsMiner rows={filtered}`. `InsightsMiner` already receives `CsvRow[]`; it will read `mobile`/`name` directly (no page change needed beyond confirming `rows={filtered}` stays). Confirm the existing mount block is:

```tsx
{rows.length > 0 && token && (
  <InsightsMiner rows={filtered} token={token} />
)}
```

- [ ] **Step 2: Rewrite `app/InsightsMiner.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Download } from "lucide-react";
import type { CsvRow } from "@/lib/types";

type BreakdownRow = { category: string; detail: string; calls: number; pct: number };
type Summary = {
  reportDate: string;
  template: string;
  totalCalls: number;
  biggestCategory: { category: string; calls: number; pct: number };
  explicitHuman: number;
  unclassified: number;
};

function toCalls(rows: CsvRow[]) {
  return rows.map((r) => ({
    leadId: r.leadId || r.callId,
    callId: r.callId,
    phone: r.mobile,
    name: r.name,
    outcome: r.outcome,
    template: r.template,
    startTime: r.startTime,
  }));
}

export function InsightsMiner({ rows, token }: { rows: CsvRow[]; token: string }) {
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, calls: toCalls(rows) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBreakdown(data.breakdown ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function download() {
    setError(null);
    try {
      const res = await fetch("/api/insights?format=xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, calls: toCalls(rows) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call_analysis_${summary?.reportDate ?? "export"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section
      className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-4"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <h3 className="text-h2">Transfer-reason analysis</h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
          {rows.length} calls in scope
        </span>
      </header>

      <div className="flex gap-2">
        <button
          onClick={analyze}
          disabled={running || rows.length === 0}
          className="rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {running ? `Classifying ${rows.length} calls…` : "Analyze transfer reasons"}
        </button>
        {breakdown.length > 0 && (
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <Download className="h-3.5 w-3.5" />
            Download workbook (.xlsx)
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[13px] text-[var(--danger)]">{error}</p>}

      {summary && (
        <p className="mt-3 text-caption text-[var(--muted)]">
          {summary.totalCalls} calls · biggest: {summary.biggestCategory.category} (
          {summary.biggestCategory.calls}, {summary.biggestCategory.pct}%) · explicit human:{" "}
          {summary.explicitHuman} · unclassified: {summary.unclassified}
        </p>
      )}

      {breakdown.length > 0 && (
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted-2)]">
              <th className="py-1 pr-2">Category</th>
              <th className="py-1 pr-2">Reason</th>
              <th className="py-1 pr-2 text-right">Calls</th>
              <th className="py-1 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="py-1.5 pr-2 font-mono text-[11px]">{r.category}</td>
                <td className="py-1.5 pr-2">{r.detail}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.calls}</td>
                <td className="py-1.5 text-right tabular-nums">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev` (with `ANTHROPIC_API_KEY` set), upload a CSV, filter to `TRANSFERRED`, click **Analyze transfer reasons** → a breakdown table renders → **Download workbook (.xlsx)** → open the file and confirm Summary / Reason_breakdown / Per_call sheets match the format of `Transferred_call_analysis_*.xlsx`.

- [ ] **Step 5: Commit**

```bash
git add app/InsightsMiner.tsx app/page.tsx
git commit -m "feat: transfer-reason breakdown table + xlsx download UI"
```

---

### Task 14: Full sweep

- [ ] **Step 1: Run everything**

Run: `npm test && npx tsc --noEmit && npx tsc -p mcp/tsconfig.json && npm run lint`
Expected: all tests pass, no type/lint errors.

- [ ] **Step 2: Commit any fixups**

```bash
git add -A
git commit -m "chore: green sweep for census classifier + export" || echo "nothing to commit"
```

---

## Notes for the implementer

- **Population:** the route classifies whatever `calls` it receives — filter to `TRANSFERRED` in the UI to reproduce the analyst's transferred-call report.
- **Models:** per-call classification is `claude-haiku-4-5` with structured outputs (enum-constrained category/detail). No Sonnet/Opus in this path.
- **Determinism:** all counts/% come from `aggregate.ts` (plain TS). The LLM only labels; never counts.
- **Taxonomy edits:** change `lib/insights/reasonTaxonomy.ts` as the bot flow evolves; add new templates to `BY_TEMPLATE`.
- **Runtime:** ~100 calls runs synchronously. If it ever exceeds the route timeout, move to a background job (out of scope here).
- **MCP `classify_call`** needs `ANTHROPIC_API_KEY` in the server environment.
