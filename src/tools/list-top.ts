import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import type { UnifiedModel, ModelCategory } from "../types.js";
import { formatTopList, fmtScore, fmtElo, fmtContext, fmtPrice } from "./formatters.js";

export function registerListTopTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.tool(
    "list_top_models",
    "List top-ranked LLM/VLM models for a category. " +
      "Categories: coding, math, vision, general, cost-effective, open-source, speed, context-window, reasoning. " +
      "Returns a compact Markdown table (~250 tokens).",
    {
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
    },
    async ({ category, limit, min_context }) => {
      await registry.ensureLoaded();

      const effectiveLimit = limit ?? 10;
      let models = registry.getTopModels(category as ModelCategory, effectiveLimit + 10); // fetch extra for filtering

      if (min_context) {
        models = models.filter(
          (m) => m.capabilities.contextLength >= min_context
        );
      }

      models = models.slice(0, effectiveLimit);

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
        m.benchmarks.sweBenchVerified
          ? `SWE ${fmtScore(m.benchmarks.sweBenchVerified)}`
          : m.benchmarks.arenaElo
            ? `Elo ${fmtElo(m.benchmarks.arenaElo)}`
            : "n/a";

    case "math":
      return (m) =>
        m.benchmarks.math500
          ? `MATH ${fmtScore(m.benchmarks.math500)}`
          : m.benchmarks.gpqaDiamond
            ? `GPQA ${fmtScore(m.benchmarks.gpqaDiamond)}`
            : "n/a";

    case "vision":
      return (m) =>
        m.benchmarks.mmmu
          ? `MMMU ${fmtScore(m.benchmarks.mmmu)}`
          : "vision";

    case "general":
      return (m) =>
        m.benchmarks.arenaElo
          ? `Elo ${fmtElo(m.benchmarks.arenaElo)}`
          : m.benchmarks.mmluPro
            ? `MMLU ${fmtScore(m.benchmarks.mmluPro)}`
            : "n/a";

    case "cost-effective":
      return (m) => {
        const blended = m.pricing.input * 0.75 + m.pricing.output * 0.25;
        return `${fmtPrice(blended)}/1M`;
      };

    case "open-source":
      return (m) =>
        m.benchmarks.arenaElo
          ? `Elo ${fmtElo(m.benchmarks.arenaElo)}`
          : "OSS";

    case "speed":
      return (m) => `${fmtPrice(m.pricing.output)}/1M out`;

    case "context-window":
      return (m) => fmtContext(m.capabilities.contextLength);

    case "reasoning":
      return (m) =>
        m.benchmarks.gpqaDiamond
          ? `GPQA ${fmtScore(m.benchmarks.gpqaDiamond)}`
          : "reasoning";

    default:
      return () => "n/a";
  }
}
