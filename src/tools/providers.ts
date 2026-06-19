import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import type { UnifiedModel } from "../types.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import { buildMarkdownTable, freshnessFooter, fmtPrice, escapeMarkdownTableInline } from "./formatters.js";
import { getBlendedTokenPrice } from "../data/percentiles.js";

export function registerProvidersTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "list_providers",
    {
      title: "List providers",
      description:
        `List all LLM/VLM providers with model counts, price ranges, and top models (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Optionally filter by provider name. Returns a compact Markdown table (~200-400 tokens).",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        provider: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            'Filter by provider name (e.g., "anthropic", "openai", "google")'
          ),
      },
    },
    async ({ provider }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const allModels = registry.getAllModels();
      const providerFilter = provider?.toLowerCase().trim();

      // Aggregate models by provider
      const providerMap = new Map<
        string,
        {
          modelCount: number;
          minInputPrice: number;
          maxInputPrice: number;
          minOutputPrice: number;
          maxOutputPrice: number;
          models: UnifiedModel[];
        }
      >();

      for (const model of allModels) {
        const prov = model.metadata.provider.toLowerCase();
        if (providerFilter && !prov.includes(providerFilter)) continue;

        let entry = providerMap.get(prov);
        if (!entry) {
          entry = {
            modelCount: 0,
            minInputPrice: Infinity,
            maxInputPrice: -Infinity,
            minOutputPrice: Infinity,
            maxOutputPrice: -Infinity,
            models: [],
          };
          providerMap.set(prov, entry);
        }
        entry.modelCount++;
        entry.minInputPrice = Math.min(entry.minInputPrice, model.pricing.input);
        entry.maxInputPrice = Math.max(entry.maxInputPrice, model.pricing.input);
        entry.minOutputPrice = Math.min(entry.minOutputPrice, model.pricing.output);
        entry.maxOutputPrice = Math.max(entry.maxOutputPrice, model.pricing.output);
        entry.models.push(model);
      }

      if (providerFilter && providerMap.size === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No providers found matching "${provider}".`,
            },
          ],
        };
      }

      const sortedProviders = Array.from(providerMap.entries())
        .map(([name, data]) => {
          // Find cheapest and top model by overall score
          const cheapest = data.models.reduce((best, m) =>
            getBlendedTokenPrice(m) < getBlendedTokenPrice(best) ? m : best
          );
          return {
            name,
            modelCount: data.modelCount,
            inputPriceRange:
              data.minInputPrice === data.maxInputPrice
                ? fmtPrice(data.minInputPrice)
                : `${fmtPrice(data.minInputPrice)}–${fmtPrice(data.maxInputPrice)}`,
            outputPriceRange:
              data.minOutputPrice === data.maxOutputPrice
                ? fmtPrice(data.minOutputPrice)
                : `${fmtPrice(data.minOutputPrice)}–${fmtPrice(data.maxOutputPrice)}`,
            cheapestModel: cheapest.id,
          };
        })
        .sort((a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));

      const fetchedAt = registry.getCacheFreshnessMs();
      const output = formatProvidersList(sortedProviders, fetchedAt);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function formatProvidersList(
  providers: Array<{
    name: string;
    modelCount: number;
    inputPriceRange: string;
    outputPriceRange: string;
    cheapestModel: string;
  }>,
  fetchedAt?: number
): string {
  const lines: string[] = [];
  lines.push(`## Providers (${providers.length})`);
  lines.push("");

  const headers = ["Provider", "Models", "Input $/1M", "Output $/1M", "Cheapest Model"];
  const rows = providers.map((p) => [
    escapeMarkdownTableInline(p.name),
    String(p.modelCount),
    p.inputPriceRange,
    p.outputPriceRange,
    escapeMarkdownTableInline(p.cheapestModel),
  ]);

  lines.push(buildMarkdownTable(headers, rows, rows.length));
  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}
