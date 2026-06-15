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
import Anthropic from "@anthropic-ai/sdk";
import { taxonomyFor } from "../lib/insights/reasonTaxonomy.js";
import { classifyCall } from "../lib/insights/classify.js";
import { makeHaikuClassifier } from "../lib/insights/haikuClassifier.js";
import { reasonBreakdown } from "../lib/insights/aggregate.js";
import type { CallLabel } from "../lib/insights/types.js";

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
      description:
        "Fetch the given lead IDs and return only those whose transcript contains keyword, with a snippet.",
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
