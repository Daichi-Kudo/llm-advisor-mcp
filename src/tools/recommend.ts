import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ModelRegistry, modelMatchesFilters } from "../data/registry.js";
import { USE_CASES, type UnifiedModel, type UseCase } from "../types.js";
import { fmtPrice, fmtContext, fmtScore, fmtElo, freshnessFooter, escapeMarkdownInline } from "./formatters.js";
import {
  getBlendedTokenPrice,
  getCompositeBenchmarkScore,
  getOverallBenchmarkScore,
} from "../data/percentiles.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded, isoDateSchema } from "./schemas.js";

export function registerRecommendTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "recommend_model",
    {
      title: "Recommend model",
      description:
        `Get personalized model recommendations based on use case, budget, and requirements (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "The creative use case currently falls back to the general composite benchmark because no dedicated creative leaderboard is available. " +
        "Returns top 3 picks with reasoning (~350-550 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        use_case: z.enum(USE_CASES).describe("Primary use case"),
        max_input_price: z
          .number()
          .min(0)
          .max(1_000_000)
          .optional()
          .describe("Max input price in USD per 1M tokens"),
        max_output_price: z
          .number()
          .min(0)
          .max(1_000_000)
          .optional()
          .describe("Max output price in USD per 1M tokens"),
        min_context: z
          .number()
          .int()
          .min(1)
          .max(100_000_000)
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
        min_release_date: isoDateSchema
          .optional()
          .describe("Minimum release date (YYYY-MM-DD). Excludes older models"),
      },
    },
    async ({
      use_case,
      max_input_price,
      max_output_price,
      min_context,
      require_vision,
      require_tools,
      require_open_source,
      min_release_date,
    }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const candidates = registry.getAllModels().filter((m) =>
        modelMatchesFilters(m, {
          maxInputPrice: max_input_price,
          maxOutputPrice: max_output_price,
          minContext: min_context,
          minReleaseDate: min_release_date,
          requireVision: require_vision,
          requireTools: require_tools,
          requireOpenSource: require_open_source,
        })
      );

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No models found matching your requirements. Try increasing budget or reducing constraints.",
            },
          ],
        };
      }

      // Score and rank
      const scored = candidates
        .map((m) => ({ model: m, score: computeScore(m, use_case) }))
        .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
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
  const blended = getBlendedTokenPrice(model);
  const priceScore = Math.max(0, 100 - (blended / 30) * 100);
  score += priceScore * weights.price;

  // Capability bonus
  if (model.capabilities.supportsTools) score += 3;
  if (model.capabilities.supportsReasoning) score += 2;
  if (model.capabilities.contextLength >= 200_000) score += 2;

  // Freshness bonus (small tiebreaker)
  score += computeFreshnessBonus(model.metadata.releaseDate);

  return score;
}

/** Small bonus for recently released models */
export function computeFreshnessBonus(releaseDate?: string): number {
  if (!releaseDate) return 0;
  const released = new Date(releaseDate).getTime();
  if (isNaN(released)) return 0;
  const ageMs = Date.now() - released;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 90) return 3;   // Last 3 months
  if (ageDays <= 180) return 1;  // Last 6 months
  return 0;
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
      return getCompositeBenchmarkScore(model, "coding") ?? 0;
    case "math":
      return getCompositeBenchmarkScore(model, "math") ?? 0;
    case "reasoning":
      return getCompositeBenchmarkScore(model, "reasoning") ?? 0;
    case "vision":
      return getCompositeBenchmarkScore(model, "vision") ?? 0;
    case "general":
      return getCompositeBenchmarkScore(model, "general") ?? 0;
    case "creative":
      // Creative reuses the general benchmark composite; there is no dedicated creative leaderboard yet.
      return getCompositeBenchmarkScore(model, "creative") ?? 0;
    case "cost-effective":
      return getOverallBenchmarkScore(model) ?? 0;
    default:
      return getCompositeBenchmarkScore(model, "general") ?? 0;
  }
}

function formatRecommendations(
  scored: Array<{ model: UnifiedModel; score: number }>,
  useCase: string,
  fetchedAt?: number
): string {
  const lines: string[] = [];
  lines.push(`## Recommended for: ${escapeMarkdownInline(useCase)}`);
  lines.push("");

  for (let i = 0; i < scored.length; i++) {
    const { model, score } = scored[i];
    const medal = ["1.", "2.", "3."][i];

    lines.push(
      `### ${medal} ${escapeMarkdownInline(model.id)} (score: ${score.toFixed(0)})`
    );

    // Compact summary line
    const parts: string[] = [];
    parts.push(`Input: ${fmtPrice(model.pricing.input)}/1M`);
    parts.push(`Output: ${fmtPrice(model.pricing.output)}/1M`);
    parts.push(`Context: ${fmtContext(model.capabilities.contextLength)}`);
    if (model.metadata.releaseDate) {
      parts.push(`Released: ${model.metadata.releaseDate}`);
    }
    lines.push(parts.join(" | "));

    // Key benchmarks for this use case
    const benchParts: string[] = [];
    if (model.benchmarks.sweBenchVerified !== undefined) {
      benchParts.push(`SWE-bench: ${fmtScore(model.benchmarks.sweBenchVerified)}`);
    }
    if (model.benchmarks.aiderPolyglot !== undefined) {
      benchParts.push(`Aider: ${fmtScore(model.benchmarks.aiderPolyglot)}`);
    }
    if (model.benchmarks.arenaElo !== undefined) {
      benchParts.push(`Arena: ${fmtElo(model.benchmarks.arenaElo)}`);
    }
    if (model.benchmarks.gpqaDiamond !== undefined) {
      benchParts.push(`GPQA: ${fmtScore(model.benchmarks.gpqaDiamond)}`);
    }
    if (model.benchmarks.mmmu !== undefined) {
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
    if (strengths.length > 0) {
      lines.push(`Strengths: ${strengths.join(", ")}`);
    }

    lines.push("");
  }

  lines.push(freshnessFooter(fetchedAt));
  return lines.join("\n");
}
