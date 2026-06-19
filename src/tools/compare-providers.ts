import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";
import { fmtPrice, buildMarkdownTable, escapeMarkdownInline, freshnessFooter } from "./formatters.js";
import { getPerProviderPricing, getProviderDisplayName } from "../data/static/per-provider-pricing.js";

export function registerCompareProvidersTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "compare_providers",
    {
      title: "Compare providers",
      description:
        `Compare pricing for the same model across different API providers (llm-advisor ${SERVER_VERSION}, MCP registry ${MCP_REGISTRY_NAME}). ` +
        "Shows input/output prices on OpenRouter, direct providers (OpenAI, Anthropic, Google), " +
        "and inference platforms (Bedrock, Groq, Together, Fireworks, DeepInfra, Cerebras). " +
        "Highlights the cheapest provider for each price type. " +
        "Returns a compact Markdown table (~200-400 tokens).",
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
            'Model ID or partial name (e.g., "anthropic/claude-sonnet-4.6", "gpt-5.5", "gemini")'
          ),
      },
    },
    async ({ model: modelQuery }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      // Resolve the model via the registry (for validation + display)
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

      // Look up per-provider pricing
      const allPricing = getPerProviderPricing();
      const modelPricing = allPricing[found.id];

      if (!modelPricing) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No per-provider pricing data available for "${found.id}". Only OpenRouter pricing is known ($${fmtPrice(found.pricing.input)} input, $${fmtPrice(found.pricing.output)} output per 1M tokens).`,
            },
          ],
        };
      }

      const output = formatProviderComparison(found.id, modelPricing);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

interface ProviderEntry {
  name: string;
  inputPrice: number;
  outputPrice: number;
}

function formatProviderComparison(
  modelId: string,
  pricing: Record<string, { input: number; output: number }>
): string {
  const lines: string[] = [];
  lines.push(`## Provider pricing: ${escapeMarkdownInline(modelId)}`);
  lines.push("");

  // Build sorted provider list
  const providers: ProviderEntry[] = Object.entries(pricing)
    .filter(([key]) => key !== "openrouter" || true) // include OpenRouter
    .map(([key, prices]) => ({
      name: getProviderDisplayName(key),
      inputPrice: prices.input,
      outputPrice: prices.output,
    }))
    .sort((a, b) => {
      // Sort OpenRouter first, then by input price
      if (a.name === "OpenRouter") return -1;
      if (b.name === "OpenRouter") return 1;
      return a.inputPrice - b.inputPrice || a.name.localeCompare(b.name);
    });

  // Find cheapest for input and output
  const minInput = Math.min(...providers.map((p) => p.inputPrice));
  const minOutput = Math.min(...providers.map((p) => p.outputPrice));

  const headers = ["Provider", "Input $/1M", "Output $/1M", "Blended $/1M"];
  const rows = providers.map((p) => {
    const blended = p.inputPrice * 0.75 + p.outputPrice * 0.25;
    return [
      p.name,
      p.inputPrice === minInput ? `**${fmtPrice(p.inputPrice)}**` : fmtPrice(p.inputPrice),
      p.outputPrice === minOutput ? `**${fmtPrice(p.outputPrice)}**` : fmtPrice(p.outputPrice),
      fmtPrice(blended),
    ];
  });

  lines.push(buildMarkdownTable(headers, rows, rows.length));
  lines.push("");
  lines.push(`> **Bold** = cheapest. Blended = 75% input + 25% output weighting.`);

  // Compute savings
  const openrouterEntry = providers.find((p) => p.name === "OpenRouter");
  const cheapestEntry = providers.reduce((best, p) => {
    const bestBlended = best.inputPrice * 0.75 + best.outputPrice * 0.25;
    const pBlended = p.inputPrice * 0.75 + p.outputPrice * 0.25;
    return pBlended < bestBlended ? p : best;
  }, providers[0]);

  if (openrouterEntry && cheapestEntry.name !== "OpenRouter") {
    const orBlended = openrouterEntry.inputPrice * 0.75 + openrouterEntry.outputPrice * 0.25;
    const chBlended = cheapestEntry.inputPrice * 0.75 + cheapestEntry.outputPrice * 0.25;
    const savings = ((orBlended - chBlended) / orBlended) * 100;
    if (savings > 1) {
      lines.push("");
      lines.push(`💡 **Save ~${savings.toFixed(0)}%** by using **${cheapestEntry.name}** instead of OpenRouter.`);
    }
  }

  lines.push(freshnessFooter());

  return lines.join("\n");
}
