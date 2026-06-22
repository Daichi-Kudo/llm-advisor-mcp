import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MODEL_CATEGORIES, type UnifiedModel, type ModelCategory } from "../types.js";
import { formatTopList, fmtScore, fmtElo, fmtContext, fmtPrice, escapeMarkdownInline } from "./formatters.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded, isoDateSchema } from "./schemas.js";
import {
  getBlendedTokenPrice,
  getCompositeBenchmarkScore,
  getCostEfficiencyScore,
  getOverallBenchmarkScore,
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
        `List top-ranked LLM/VLM models for a category or single benchmark (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Categories: coding, math, vision, general, cost-effective, open-source, speed, context-window, reasoning, quality, image-gen. " +
        "Use the benchmark parameter to rank by a specific test (e.g., swe_bench_verified, gpqa_diamond). " +
        "quality uses the Overall Quality Index (0-100 composite across all benchmarks). " +
        "speed uses measured tok/s where available, otherwise heuristic estimates (from pricing and model family). " +
        "Returns a compact Markdown table (~250-500 tokens depending on limit).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        category: z
          .enum(MODEL_CATEGORIES)
          .describe(
            'Category to rank models by. Note: "speed" uses output price as a proxy because live latency data is not available.'
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Number of models to return (default: 10)"),
        min_context: z
          .number()
          .int()
          .min(1)
          .max(100_000_000)
          .optional()
          .describe("Minimum context window in tokens"),
        min_release_date: isoDateSchema
          .optional()
          .describe("Minimum release date (YYYY-MM-DD). Excludes older models"),
        max_input_price: z
          .number()
          .min(0)
          .max(1_000_000)
          .optional()
          .describe("Maximum input price in USD per 1M tokens"),
        max_output_price: z
          .number()
          .min(0)
          .max(1_000_000)
          .optional()
          .describe("Maximum output price in USD per 1M tokens"),
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
        benchmark: z
          .enum([
            "swe_bench_verified", "aider_polyglot", "arena_elo",
            "mmlu_pro", "gpqa_diamond", "math_500", "aime_2024",
            "mmmu", "mm_bench", "ocr_bench", "ai2d", "math_vista",
            "bfcl_v4_overall", "bfcl_v4_agentic",
            "output_speed", "time_to_first_token",
          ])
          .optional()
          .describe(
            'Optional specific benchmark to rank by (e.g., "swe_bench_verified", "gpqa_diamond"). ' +
            "Overrides category-based composite scoring. Shows only models with that benchmark data."
          ),
      },
    },
    async ({ category, limit, min_context, min_release_date, max_input_price, max_output_price, require_vision, require_tools, require_open_source, benchmark }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const effectiveLimit = limit;

      // If a specific benchmark is requested, rank by that directly
      if (benchmark) {
        const allModels = registry.getAllModels();
        const benchmarkAccessor = getBenchmarkAccessor(benchmark);
        const benchmarkLabel = getBenchmarkLabel(benchmark);

        // Filter: must have the benchmark value and pass filters
        const candidates = allModels
          .filter((m) => {
            const val = benchmarkAccessor(m);
            if (val === undefined || val === null) return false;
            if (min_context !== undefined && m.capabilities.contextLength < min_context) return false;
            if (max_input_price !== undefined && m.pricing.input > max_input_price) return false;
            if (max_output_price !== undefined && m.pricing.output > max_output_price) return false;
            if (require_vision && !m.capabilities.inputModalities.includes("image")) return false;
            if (require_tools && !m.capabilities.supportsTools) return false;
            if (require_open_source && !m.metadata.isOpenSource) return false;
            if (min_release_date !== undefined && (m.metadata.releaseDate === undefined || m.metadata.releaseDate < min_release_date)) return false;
            return true;
          })
          .sort((a, b) => {
            const aVal = benchmarkAccessor(a) ?? -Infinity;
            const bVal = benchmarkAccessor(b) ?? -Infinity;
            return bVal - aVal || a.id.localeCompare(b.id);
          })
          .slice(0, effectiveLimit);

        if (candidates.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No models found with benchmark "${benchmarkLabel}".` }],
          };
        }

        const fetchedAt = registry.getCacheFreshnessMs();
        const output = formatTopList(
          `${benchmarkLabel}`,
          candidates,
          (m) => {
            const val = benchmarkAccessor(m);
            if (val === undefined) return "n/a";
            return benchmark === "arena_elo" ? fmtElo(val) : fmtScore(val);
          },
          effectiveLimit,
          fetchedAt
        );

        return { content: [{ type: "text" as const, text: output }] };
      }

      const models = registry.getTopModels(category, effectiveLimit, {
        minContext: min_context,
        minReleaseDate: min_release_date,
        maxInputPrice: max_input_price,
        maxOutputPrice: max_output_price,
        requireVision: require_vision,
        requireTools: require_tools,
        requireOpenSource: require_open_source,
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

      const keyScoreExtractor = getKeyScoreExtractor(category);
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
          ["AI2D", fmtScore(m.benchmarks.ai2d)],
          ["MathVista", fmtScore(m.benchmarks.mathVista)],
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
      return (m) => {
        const tokPerSec = m.speed.outputTokensPerSecond;
        if (tokPerSec !== undefined) {
          return `${tokPerSec} tok/s`;
        }
        return `${fmtPrice(m.pricing.output)}/1M out (price proxy)`;
      };

    case "context-window":
      return (m) => fmtContext(m.capabilities.contextLength);

    case "reasoning":
      return (m) =>
        fmtCompositeWithParts(getCompositeBenchmarkScore(m, "reasoning"), [
          ["GPQA", fmtScore(m.benchmarks.gpqaDiamond)],
          ["MATH", fmtScore(m.benchmarks.math500)],
          ["AIME", fmtScore(m.benchmarks.aime2024)],
        ]);

    case "quality":
      return (m) => {
        const overall = getOverallBenchmarkScore(m);
        if (overall === undefined) return "n/a";
        return `Quality ${fmtScore(overall)}`;
      };

    case "image-gen":
      return (m) => {
        const iPrice = m.pricing.image;
        if (iPrice !== undefined) return `$${iPrice.toFixed(3)}/image`;
        return `${fmtPrice(m.pricing.output)}/1M out`;
      };

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

/**
 * Map a benchmark enum string to a function that extracts the value from a model.
 */
function getBenchmarkAccessor(benchmark: string): (m: UnifiedModel) => number | undefined {
  const accessors: Record<string, (m: UnifiedModel) => number | undefined> = {
    swe_bench_verified: (m) => m.benchmarks.sweBenchVerified,
    aider_polyglot: (m) => m.benchmarks.aiderPolyglot,
    arena_elo: (m) => m.benchmarks.arenaElo,
    mmlu_pro: (m) => m.benchmarks.mmluPro,
    gpqa_diamond: (m) => m.benchmarks.gpqaDiamond,
    math_500: (m) => m.benchmarks.math500,
    aime_2024: (m) => m.benchmarks.aime2024,
    mmmu: (m) => m.benchmarks.mmmu,
    mm_bench: (m) => m.benchmarks.mmBench,
    ocr_bench: (m) => m.benchmarks.ocrBench,
    ai2d: (m) => m.benchmarks.ai2d,
    math_vista: (m) => m.benchmarks.mathVista,
    bfcl_v4_overall: (m) => m.benchmarks.bfclV4Overall,
    bfcl_v4_agentic: (m) => m.benchmarks.bfclV4Agentic,
    output_speed: (m) => m.speed.outputTokensPerSecond,
    time_to_first_token: (m) => m.speed.timeToFirstToken,
  };
  return accessors[benchmark] ?? (() => undefined);
}

function getBenchmarkLabel(benchmark: string): string {
  const labels: Record<string, string> = {
    swe_bench_verified: "SWE-bench Verified",
    aider_polyglot: "Aider Polyglot",
    arena_elo: "Arena Elo",
    mmlu_pro: "MMLU-Pro",
    gpqa_diamond: "GPQA Diamond",
    math_500: "MATH-500",
    aime_2024: "AIME 2024",
    mmmu: "MMMU",
    mm_bench: "MMBench",
    ocr_bench: "OCRBench",
    ai2d: "AI2D",
    math_vista: "MathVista",
    bfcl_v4_overall: "BFCL V4 Overall",
    bfcl_v4_agentic: "BFCL V4 Agentic",
    output_speed: "Output Speed",
    time_to_first_token: "TTFT",
  };
  return labels[benchmark] ?? benchmark.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
