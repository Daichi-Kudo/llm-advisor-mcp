import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { escapeMarkdownInline, formatModelDetail } from "./formatters.js";
import { getApiExample } from "../data/static/api-examples.js";
import { MCP_REGISTRY_NAME, SERVER_VERSION } from "../metadata.js";
import { ensureRegistryLoaded } from "./schemas.js";

export function registerModelInfoTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.registerTool(
    "get_model_info",
    {
      title: "Get model info",
      description:
        `Get detailed information about a specific LLM/VLM model from llm-advisor ${SERVER_VERSION} (MCP registry ${MCP_REGISTRY_NAME}): pricing, benchmarks, capabilities, ` +
        "and ready-to-use API code example. Returns structured Markdown (~300 tokens).",
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
            'Model ID or partial name (e.g., "anthropic/claude-sonnet-4.6", "gpt-5.1", "gemini")'
          ),
        include_api_example: z
          .boolean()
          .default(true)
          .describe("Include API usage code example (default: true)"),
        api_format: z
          .enum(["openai_sdk", "curl", "python_requests"])
          .default("openai_sdk")
          .describe("API example format (default: openai_sdk)"),
      },
    },
    async ({ model, include_api_example, api_format }) => {
      const loadError = await ensureRegistryLoaded(registry);
      if (loadError) return loadError;

      const found = registry.getModel(model);

      if (!found) {
        const similar = registry.findSimilar(model);
        return {
          content: [
            {
              type: "text" as const,
              text: `Model "${escapeMarkdownInline(model)}" not found.${similar.length > 0 ? ` Did you mean: ${similar.map(escapeMarkdownInline).join(", ")}?` : ""}`,
            },
          ],
          isError: true,
        };
      }

      const fetchedAt = registry.getCacheFreshnessMs();
      let output = formatModelDetail(found, fetchedAt);

      // Add API example
      if (include_api_example) {
        const format = api_format;
        const example = getApiExample(format, found.id);
        if (example) {
          output += `\n\n### API Example (${format})\n\`\`\`${example.language}\n${example.code}\n\`\`\``;
        }
      }

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
