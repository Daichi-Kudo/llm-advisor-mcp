import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MODEL_CATEGORIES, type ModelCategory } from "../types.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import {
  getCompositeBenchmarkScore,
  type CompositeScoreCategory,
} from "../data/percentiles.js";
import { buildMarkdownTable, freshnessFooter, fmtPrice, fmtContext, escapeMarkdownTableInline } from "./formatters.js";

export function registerSearchTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "search_models",
    {
      title: "Search models",
      description:
        `Search for LLM/VLM models by name, provider, or natural-language query (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Optionally filter by category, price, context, or capabilities. " +
        "Returns up to 10 ranked results in a compact Markdown table (~250-500 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(
            'Search query — model name, provider, or description (e.g., "cheap vision model", "claude", "fast coding")'
          ),
        category: z
          .enum(MODEL_CATEGORIES)
          .optional()
          .describe("Optional category to rank results by"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Number of results to return (default: 10)"),
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
      },
    },
    async ({
      query,
      category,
      limit,
      max_input_price,
      max_output_price,
      min_context,
      require_vision,
      require_tools,
      require_open_source,
    }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const allModels = registry.getAllModels();
      const queryLower = query.toLowerCase().trim();

      // Score each model by text-match relevance
      const scored = allModels
        .map((m) => ({
          model: m,
          relevance: computeRelevance(m, queryLower),
        }))
        .filter(({ relevance }) => relevance > 0)
        .filter(({ model }) => {
          if (max_input_price !== undefined && model.pricing.input > max_input_price) return false;
          if (max_output_price !== undefined && model.pricing.output > max_output_price) return false;
          if (min_context !== undefined && model.capabilities.contextLength < min_context) return false;
          if (require_vision && !model.capabilities.inputModalities.includes("image")) return false;
          if (require_tools && !model.capabilities.supportsTools) return false;
          if (require_open_source && !model.metadata.isOpenSource) return false;
          return true;
        })
        .sort((a, b) => {
          // Primary sort by relevance
          if (a.relevance !== b.relevance) return b.relevance - a.relevance;
          // Tie-breaker: category benchmark if specified
          if (category) {
            const compositeCat = categoryToComposite(category);
            if (compositeCat) {
              const aScore = getCompositeBenchmarkScore(a.model, compositeCat);
              const bScore = getCompositeBenchmarkScore(b.model, compositeCat);
              if (aScore !== undefined && bScore !== undefined && aScore !== bScore) {
                return bScore - aScore;
              }
            }
          }
          return a.model.id.localeCompare(b.model.id);
        })
        .slice(0, limit);

      if (scored.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No models found matching "${query}". Try a broader search term or fewer filters.`,
            },
          ],
        };
      }

      const fetchedAt = registry.getCacheFreshnessMs();
      const output = formatSearchResults(scored, query, category, fetchedAt);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

/** Map ModelCategory to CompositeScoreCategory where applicable. */
function categoryToComposite(category: ModelCategory): CompositeScoreCategory | undefined {
  switch (category) {
    case "coding":
    case "math":
    case "vision":
    case "general":
    case "reasoning":
      return category;
    case "open-source":
    case "cost-effective":
    case "speed":
    case "context-window":
      return undefined;
  }
}

/** Compute a text-relevance score against the query (0-100). */
function computeRelevance(
  model: { id: string; name: string; metadata: { provider: string; family: string } },
  query: string
): number {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  const provider = model.metadata.provider.toLowerCase();
  const family = model.metadata.family.toLowerCase();

  let score = 0;

  // Exact match on full ID
  if (id === query) score += 100;
  // Provider prefix match (e.g., "anthropic/" matches "anthropic/claude-...")
  else if (id.startsWith(query) || id.startsWith(query + "/")) score += 80;
  // Provider name match
  else if (provider === query) score += 70;
  // Family name match
  else if (family === query) score += 60;
  // Contains match on ID
  else if (id.includes(query)) score += 40;
  // Contains match on display name
  else if (name.includes(query)) score += 30;

  // Boost for keyword matches in name
  const keywords = query.split(/\s+/);
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    if (id.includes(kw) || name.includes(kw)) {
      score += kw.length > 3 ? 15 : 5;
    }
  }

  return score;
}

function formatSearchResults(
  scored: Array<{
    model: {
      id: string;
      pricing: { input: number; output: number };
      capabilities: { contextLength: number };
      metadata: { releaseDate?: string };
    };
    relevance: number;
  }>,
  query: string,
  category?: string,
  fetchedAt?: number
): string {
  const lines: string[] = [];
  const label = category ? ` (ranked by ${category})` : "";
  lines.push(`## Search results for "${query}"${label}`);
  lines.push("");

  const headers = ["#", "Model", "Relevance", "Input $/1M", "Output $/1M", "Context", "Released"];
  const rows = scored.map(({ model, relevance }, i) => [
    String(i + 1),
    escapeMarkdownTableInline(model.id),
    `${relevance}%`,
    fmtPrice(model.pricing.input),
    fmtPrice(model.pricing.output),
    fmtContext(model.capabilities.contextLength),
    model.metadata.releaseDate ?? "n/a",
  ]);

  lines.push(buildMarkdownTable(headers, rows, rows.length));
  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}
