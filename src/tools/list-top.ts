import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import type { UnifiedModel, ModelCategory } from "../types.js";
import { formatTopList, fmtScore, fmtElo, fmtContext, fmtPrice } from "./formatters.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import {
  getBlendedTokenPrice,
  getCompositeBenchmarkScore,
  getCostEfficiencyScore,
} from "../data/percentiles.js";

export function registerListTopTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "list_top_models",
    {
      title: "List top models",
      description:
        `List top-ranked LLM/VLM models for a category (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Categories: coding, math, vision, general, cost-effective, open-source, speed, context-window, reasoning. " +
        "Returns a compact Markdown table (~250 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
      category: z
        .enum([
          "coding",
          "math",
          "vision",
          "general",
          "cost-effective",
          "open-source",
          "speed",
          "context-window",
          "reasoning",
        ])
        .describe("Category to rank models by"),
      limit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe("Number of models to return (default: 10)"),
      min_context: z
        .number()
        .optional()
        .describe("Minimum context window in tokens"),
      min_release_date: z
        .string()
        .optional()
        .describe("Minimum release date (YYYY-MM-DD). Excludes older models"),
    },
    },
    async ({ category, limit, min_context, min_release_date }) => {
      await registry.ensureLoaded();

      const effectiveLimit = limit ?? 10;
      const models = registry.getTopModels(category as ModelCategory, effectiveLimit, {
        minContext: min_context,
        minReleaseDate: min_release_date,
      });

      if (models.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No models found for category "${category}".`,
            },
          ],
        };
      }

      const keyScoreExtractor = getKeyScoreExtractor(category as ModelCategory);
      const fetchedAt = registry.getCacheFreshnessMs();
      const output = formatTopList(
        category,
        models,
        keyScoreExtractor,
        effectiveLimit,
        fetchedAt
      );

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function getKeyScoreExtractor(
  category: ModelCategory
): (m: UnifiedModel) => string {
  switch (category) {
    case "coding":
      return (m) =>
        fmtCompositeWithParts(getCompositeBenchmarkScore(m, "coding"), [
          ["SWE", fmtScore(m.benchmarks.sweBenchVerified)],
          ["Aider", fmtScore(m.benchmarks.aiderPolyglot)],
          ["Elo", fmtElo(m.benchmarks.arenaElo)],
        ]);

    case "math":
      return (m) =>
        fmtCompositeWithParts(getCompositeBenchmarkScore(m, "math"), [
          ["MATH", fmtScore(m.benchmarks.math500)],
          ["GPQA", fmtScore(m.benchmarks.gpqaDiamond)],
          ["AIME", fmtScore(m.benchmarks.aime2024)],
        ]);

    case "vision":
      return (m) =>
        fmtCompositeWithParts(getCompositeBenchmarkScore(m, "vision"), [
          ["MMMU", fmtScore(m.benchmarks.mmmu)],
          ["MMB", fmtScore(m.benchmarks.mmBench)],
          ["OCR", fmtScore(m.benchmarks.ocrBench)],
        ]);

    case "general":
      return (m) =>
        fmtCompositeWithParts(getCompositeBenchmarkScore(m, "general"), [
          ["Elo", fmtElo(m.benchmarks.arenaElo)],
          ["MMLU", fmtScore(m.benchmarks.mmluPro)],
          ["GPQA", fmtScore(m.benchmarks.gpqaDiamond)],
        ]);

    case "cost-effective":
      return (m) => {
        const blended = getBlendedTokenPrice(m);
        const score = getCostEfficiencyScore(m);
        return score !== undefined
          ? `${score.toFixed(1)} perf/$ (${fmtPrice(blended)}/1M)`
          : `${fmtPrice(blended)}/1M`;
      };

    case "open-source":
      return (m) =>
        fmtCompositeWithParts(
          getCompositeBenchmarkScore(m, "general") ??
            getCompositeBenchmarkScore(m, "coding") ??
            getCompositeBenchmarkScore(m, "vision"),
          [
            ["Elo", fmtElo(m.benchmarks.arenaElo)],
            ["SWE", fmtScore(m.benchmarks.sweBenchVerified)],
            ["MMMU", fmtScore(m.benchmarks.mmmu)],
          ]
        );

    case "speed":
      return (m) => `${fmtPrice(m.pricing.output)}/1M out`;

    case "context-window":
      return (m) => fmtContext(m.capabilities.contextLength);

    case "reasoning":
      return (m) =>
        fmtCompositeWithParts(getCompositeBenchmarkScore(m, "reasoning"), [
          ["GPQA", fmtScore(m.benchmarks.gpqaDiamond)],
          ["MATH", fmtScore(m.benchmarks.math500)],
          ["AIME", fmtScore(m.benchmarks.aime2024)],
        ]);

    default:
      return () => "n/a";
  }
}

function fmtCompositeWithParts(
  score: number | undefined,
  parts: [label: string, value: string][]
): string {
  if (score === undefined) return "n/a";

  const availableParts = parts
    .filter(([, value]) => value !== "n/a")
    .map(([label, value]) => `${label} ${value}`);

  const suffix = availableParts.length > 0 ? ` (${availableParts.join(", ")})` : "";
  return `Composite ${fmtScore(score)}${suffix}`;
}
