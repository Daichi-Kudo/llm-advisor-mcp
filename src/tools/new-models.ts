import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import { buildMarkdownTable, freshnessFooter, fmtPrice, fmtContext, escapeMarkdownTableInline } from "./formatters.js";

export function registerNewModelsTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "list_new_models",
    {
      title: "List new models",
      description:
        `List recently released LLM/VLM models (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Filters by release date or shows models released in the last N days. " +
        "Returns a compact Markdown table (~200-400 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        max_age_days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(90)
          .describe("Maximum age in days (default: 90 — shows models from last ~3 months)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Number of results to return (default: 10)"),
        min_context: z
          .number()
          .int()
          .min(1)
          .max(100_000_000)
          .optional()
          .describe("Minimum context window in tokens"),
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
      },
    },
    async ({ max_age_days, limit, min_context, max_input_price, max_output_price }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const cutoffMs = Date.now() - max_age_days * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(cutoffMs).toISOString().split("T")[0];

      const allModels = registry.getAllModels();
      const recent = allModels
        .filter((m) => {
          if (!m.metadata.releaseDate) return false;
          if (m.metadata.releaseDate < cutoffDate) return false;
          if (min_context !== undefined && m.capabilities.contextLength < min_context) return false;
          if (max_input_price !== undefined && m.pricing.input > max_input_price) return false;
          if (max_output_price !== undefined && m.pricing.output > max_output_price) return false;
          return true;
        })
        .sort((a, b) => {
          // Sort by release date descending (newest first)
          const aDate = a.metadata.releaseDate ?? "";
          const bDate = b.metadata.releaseDate ?? "";
          if (aDate !== bDate) return bDate.localeCompare(aDate);
          return a.id.localeCompare(b.id);
        })
        .slice(0, limit);

      if (recent.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No new models found in the last ${max_age_days} days (since ${cutoffDate}). Try increasing max_age_days.`,
            },
          ],
        };
      }

      const fetchedAt = registry.getCacheFreshnessMs();
      const output = formatNewModelsList(recent, max_age_days, fetchedAt);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function formatNewModelsList(
  models: Array<{
    id: string;
    pricing: { input: number; output: number };
    capabilities: { contextLength: number };
    metadata: { provider: string; releaseDate?: string; isOpenSource: boolean };
  }>,
  maxAgeDays: number,
  fetchedAt?: number
): string {
  const lines: string[] = [];
  lines.push(`## New models (last ${maxAgeDays} days)`);
  lines.push("");

  const headers = ["#", "Model", "Provider", "Released", "Input $/1M", "Output $/1M", "Context", "OSS"];
  const rows = models.map((m, i) => [
    String(i + 1),
    escapeMarkdownTableInline(m.id),
    m.metadata.provider,
    m.metadata.releaseDate ?? "n/a",
    fmtPrice(m.pricing.input),
    fmtPrice(m.pricing.output),
    fmtContext(m.capabilities.contextLength),
    m.metadata.isOpenSource ? "Yes" : "No",
  ]);

  lines.push(buildMarkdownTable(headers, rows, rows.length));
  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}
