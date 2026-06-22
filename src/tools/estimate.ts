import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import { escapeMarkdownInline, freshnessFooter, fmtPrice } from "./formatters.js";

export function registerEstimateTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "estimate_cost",
    {
      title: "Estimate cost",
      description:
        `Calculate estimated LLM API costs for a model (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Given model, input/output tokens, and optional monthly volume, returns per-call and monthly cost estimates. " +
        "Returns compact Markdown (~200-400 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        model: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe(
            'Model ID or partial name (e.g., "anthropic/claude-sonnet-4.6", "gpt-5.1")'
          ),
        input_tokens: z
          .number()
          .int()
          .min(0)
          .max(100_000_000)
          .default(10_000)
          .describe("Average input tokens per call (default: 10,000)"),
        output_tokens: z
          .number()
          .int()
          .min(0)
          .max(100_000_000)
          .default(2_000)
          .describe("Average output tokens per call (default: 2,000)"),
        monthly_calls: z
          .number()
          .int()
          .min(0)
          .max(10_000_000)
          .optional()
          .describe("Estimated monthly API calls (e.g., 30,000 for ~1000/day)"),
      },
    },
    async ({ model: modelQuery, input_tokens, output_tokens, monthly_calls }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const found = registry.getModel(modelQuery);

      if (!found) {
        const similar = registry.findSimilar(modelQuery);
        return {
          content: [
            {
              type: "text" as const,
              text: `Model "${escapeMarkdownInline(modelQuery)}" not found.${
                similar.length > 0
                  ? ` Did you mean: ${similar.map(escapeMarkdownInline).join(", ")}?`
                  : ""
              }`,
            },
          ],
        };
      }

      const inputPrice = found.pricing.input;
      const outputPrice = found.pricing.output;

      // Per-call costs
      const inputCost = (input_tokens / 1_000_000) * inputPrice;
      const outputCost = (output_tokens / 1_000_000) * outputPrice;
      const perCall = inputCost + outputCost;

      // Handle cache read pricing if available
      const cacheReadPrice = found.pricing.cacheRead;
      const cacheReadCost =
        cacheReadPrice !== undefined
          ? (input_tokens / 1_000_000) * cacheReadPrice
          : undefined;

      // Monthly projections
      let monthlyCost: number | undefined;
      let monthlyCacheCost: number | undefined;
      if (monthly_calls !== undefined && monthly_calls > 0) {
        monthlyCost = perCall * monthly_calls;
        if (cacheReadCost !== undefined) {
          monthlyCacheCost = cacheReadCost * monthly_calls;
        }
      }

      const output = formatCostEstimate(
        found.id,
        input_tokens,
        output_tokens,
        inputPrice,
        outputPrice,
        perCall,
        cacheReadCost,
        monthly_calls,
        monthlyCost,
        monthlyCacheCost,
        registry.getCacheFreshnessMs()
      );

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function formatCostEstimate(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  inputPrice: number,
  outputPrice: number,
  perCall: number,
  cacheReadCost: number | undefined,
  monthlyCalls: number | undefined,
  monthlyCost: number | undefined,
  monthlyCacheCost: number | undefined,
  fetchedAt?: number
): string {
  const lines: string[] = [];

  lines.push(`## Cost estimate: ${escapeMarkdownInline(modelId)}`);
  lines.push("");

  const callLabel = `${(inputTokens / 1000).toFixed(0)}K in / ${(outputTokens / 1000).toFixed(0)}K out`;

  lines.push("### Per Call");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Input | ${(inputTokens / 1000).toFixed(0)}K tok × ${fmtPrice(inputPrice)}/1M = ${fmtPrice(inputCost(inputTokens, inputPrice))} |`);
  lines.push(`| Output | ${(outputTokens / 1000).toFixed(0)}K tok × ${fmtPrice(outputPrice)}/1M = ${fmtPrice(outputCost(outputTokens, outputPrice))} |`);
  lines.push(`| **Total** | **${fmtPrice(perCall)}** |`);
  if (cacheReadCost !== undefined) {
    lines.push(`| Cache Read (est.) | ${fmtPrice(cacheReadCost)} |`);
  }
  lines.push(`| Scenario | ${callLabel} |`);

  if (monthlyCalls !== undefined && monthlyCost !== undefined) {
    lines.push("");
    lines.push("### Monthly Projections");
    lines.push("| Volume | Cost |");
    lines.push("|--------|------|");
    lines.push(`| ${fmtCalls(monthlyCalls)} calls | **${fmtPrice(monthlyCost)}** |`);
    if (monthlyCacheCost !== undefined) {
      lines.push(`| ${fmtCalls(monthlyCalls)} calls (cached) | **${fmtPrice(monthlyCacheCost)}** |`);
    }
    // Per-day breakdown
    const dailyCalls = Math.round(monthlyCalls / 30);
    lines.push(`| Daily avg (${fmtCalls(dailyCalls)} calls) | ${fmtPrice(monthlyCost / 30)} |`);
  }

  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}

function inputCost(tokens: number, price: number): number {
  return (tokens / 1_000_000) * price;
}

function outputCost(tokens: number, price: number): number {
  return (tokens / 1_000_000) * price;
}

function fmtCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
