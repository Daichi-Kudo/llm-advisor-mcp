import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import type { UnifiedModel, UseCase } from "../types.js";
import { fmtPrice, fmtContext, fmtScore, fmtElo, freshnessFooter } from "./formatters.js";

export function registerRecommendTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.tool(
    "recommend_model",
    "Get personalized model recommendations based on use case, budget, and requirements. " +
      "Returns top 3 picks with reasoning (~350 tokens).",
    {
      use_case: z
        .enum(["coding", "math", "general", "vision", "creative", "reasoning", "cost-effective"])
        .describe("Primary use case"),
      max_input_price: z
        .number()
        .optional()
        .describe("Max input price in USD per 1M tokens"),
      max_output_price: z
        .number()
        .optional()
        .describe("Max output price in USD per 1M tokens"),
      min_context: z
        .number()
        .optional()
        .describe("Minimum context window in tokens"),
      require_vision: z
        .boolean()
        .optional()
        .describe("Require vision/image input support"),
      require_tools: z
        .boolean()
        .optional()
        .describe("Require function/tool calling support"),
      require_open_source: z
        .boolean()
        .optional()
        .describe("Require open-source license"),
    },
    async ({
      use_case,
      max_input_price,
      max_output_price,
      min_context,
      require_vision,
      require_tools,
      require_open_source,
    }) => {
      await registry.ensureLoaded();

      let candidates = registry.getAllModels();

      // Apply hard filters
      if (max_input_price !== undefined) {
        candidates = candidates.filter((m) => m.pricing.input <= max_input_price);
      }
      if (max_output_price !== undefined) {
        candidates = candidates.filter((m) => m.pricing.output <= max_output_price);
      }
      if (min_context !== undefined) {
        candidates = candidates.filter(
          (m) => m.capabilities.contextLength >= min_context
        );
      }
      if (require_vision) {
        candidates = candidates.filter((m) =>
          m.capabilities.inputModalities.includes("image")
        );
      }
      if (require_tools) {
        candidates = candidates.filter((m) => m.capabilities.supportsTools);
      }
      if (require_open_source) {
        candidates = candidates.filter((m) => m.metadata.isOpenSource);
      }

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No models match your criteria. Try relaxing the budget or requirements.",
            },
          ],
        };
      }

      // Score and rank
      const scored = candidates
        .map((m) => ({ model: m, score: computeScore(m, use_case as UseCase) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const fetchedAt = registry.getCacheFreshnessMs();
      const output = formatRecommendations(scored, use_case, fetchedAt);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

/** Compute a composite score for a model given a use case */
function computeScore(model: UnifiedModel, useCase: UseCase): number {
  const weights = getWeights(useCase);
  let score = 0;

  // Benchmark component (0-100 scale)
  const benchScore = getBenchmarkScore(model, useCase);
  score += benchScore * weights.benchmark;

  // Price component (inversely proportional — cheaper is better)
  // Normalize: $0 = 100 points, $30/1M = 0 points
  const blended = model.pricing.input * 0.6 + model.pricing.output * 0.4;
  const priceScore = Math.max(0, 100 - (blended / 30) * 100);
  score += priceScore * weights.price;

  // Capability bonus
  if (model.capabilities.supportsTools) score += 3;
  if (model.capabilities.supportsReasoning) score += 2;
  if (model.capabilities.contextLength >= 200_000) score += 2;

  return score;
}

interface Weights {
  benchmark: number;
  price: number;
}

function getWeights(useCase: UseCase): Weights {
  switch (useCase) {
    case "coding":
      return { benchmark: 0.7, price: 0.3 };
    case "math":
    case "reasoning":
      return { benchmark: 0.75, price: 0.25 };
    case "general":
      return { benchmark: 0.5, price: 0.5 };
    case "vision":
      return { benchmark: 0.6, price: 0.4 };
    case "creative":
      return { benchmark: 0.4, price: 0.6 };
    case "cost-effective":
      return { benchmark: 0.3, price: 0.7 };
    default:
      return { benchmark: 0.5, price: 0.5 };
  }
}

function getBenchmarkScore(model: UnifiedModel, useCase: UseCase): number {
  switch (useCase) {
    case "coding":
      return model.benchmarks.sweBenchVerified ?? (model.benchmarks.arenaElo ? normalizeElo(model.benchmarks.arenaElo) : 0);
    case "math":
    case "reasoning":
      return model.benchmarks.gpqaDiamond ?? model.benchmarks.math500 ?? (model.benchmarks.arenaElo ? normalizeElo(model.benchmarks.arenaElo) : 0);
    case "vision":
      return model.benchmarks.mmmu ?? 0;
    case "general":
    case "creative":
      return model.benchmarks.arenaElo ? normalizeElo(model.benchmarks.arenaElo) : (model.benchmarks.mmluPro ?? 0);
    case "cost-effective":
      return model.benchmarks.arenaElo ? normalizeElo(model.benchmarks.arenaElo) : 0;
    default:
      return model.benchmarks.arenaElo ? normalizeElo(model.benchmarks.arenaElo) : 0;
  }
}

/** Normalize Arena Elo (900-1500) to a 0-100 scale */
function normalizeElo(elo: number): number {
  return Math.max(0, Math.min(100, ((elo - 900) / 600) * 100));
}

function formatRecommendations(
  scored: Array<{ model: UnifiedModel; score: number }>,
  useCase: string,
  fetchedAt?: number
): string {
  const lines: string[] = [];
  lines.push(`## Recommended for: ${useCase}`);
  lines.push("");

  for (let i = 0; i < scored.length; i++) {
    const { model, score } = scored[i];
    const medal = ["1.", "2.", "3."][i];

    lines.push(
      `### ${medal} ${model.id} (score: ${score.toFixed(0)})`
    );

    // Compact summary line
    const parts: string[] = [];
    parts.push(`Input: ${fmtPrice(model.pricing.input)}/1M`);
    parts.push(`Output: ${fmtPrice(model.pricing.output)}/1M`);
    parts.push(`Context: ${fmtContext(model.capabilities.contextLength)}`);
    lines.push(parts.join(" | "));

    // Key benchmarks for this use case
    const benchParts: string[] = [];
    if (model.benchmarks.sweBenchVerified) {
      benchParts.push(`SWE-bench: ${fmtScore(model.benchmarks.sweBenchVerified)}`);
    }
    if (model.benchmarks.arenaElo) {
      benchParts.push(`Arena: ${fmtElo(model.benchmarks.arenaElo)}`);
    }
    if (model.benchmarks.gpqaDiamond) {
      benchParts.push(`GPQA: ${fmtScore(model.benchmarks.gpqaDiamond)}`);
    }
    if (model.benchmarks.mmmu) {
      benchParts.push(`MMMU: ${fmtScore(model.benchmarks.mmmu)}`);
    }
    if (benchParts.length > 0) {
      lines.push(`Benchmarks: ${benchParts.join(", ")}`);
    }

    // Strengths
    const strengths: string[] = [];
    if (model.metadata.isOpenSource) strengths.push("open-source");
    if (model.capabilities.supportsReasoning) strengths.push("reasoning");
    if (model.capabilities.supportsTools) strengths.push("tools");
    if (model.capabilities.inputModalities.includes("image")) strengths.push("vision");
    if (model.capabilities.contextLength >= 1_000_000) strengths.push("1M+ context");
    if (model.pricing.input === 0 && model.pricing.output === 0) strengths.push("free");
    if (strengths.length > 0) {
      lines.push(`Strengths: ${strengths.join(", ")}`);
    }

    lines.push("");
  }

  lines.push(freshnessFooter(fetchedAt));
  return lines.join("\n");
}
