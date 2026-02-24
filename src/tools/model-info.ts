import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import { formatModelDetail } from "./formatters.js";
import { getApiExample } from "../data/static/api-examples.js";

export function registerModelInfoTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.tool(
    "get_model_info",
    "Get detailed information about a specific LLM/VLM model: pricing, benchmarks, capabilities, " +
      "and ready-to-use API code example. Returns structured Markdown (~300 tokens).",
    {
      model: z
        .string()
        .describe(
          'Model ID or partial name (e.g., "anthropic/claude-sonnet-4.6", "gpt-5.1", "gemini")'
        ),
      include_api_example: z
        .boolean()
        .optional()
        .describe("Include API usage code example (default: true)"),
      api_format: z
        .enum(["openai_sdk", "curl", "python_requests"])
        .optional()
        .describe("API example format (default: openai_sdk)"),
    },
    async ({ model, include_api_example, api_format }) => {
      await registry.ensureLoaded();

      const found = registry.getModel(model);

      if (!found) {
        const similar = registry.findSimilar(model);
        return {
          content: [
            {
              type: "text" as const,
              text: `Model "${model}" not found.${similar.length > 0 ? ` Did you mean: ${similar.join(", ")}?` : ""}`,
            },
          ],
          isError: true,
        };
      }

      const fetchedAt = registry.getCacheFreshnessMs();
      let output = formatModelDetail(found, fetchedAt);

      // Add API example
      if (include_api_example !== false) {
        const format = api_format ?? "openai_sdk";
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
